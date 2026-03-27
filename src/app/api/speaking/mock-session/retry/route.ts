import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import {
  executeSpeakingMockScoringWorkflow,
  resetSpeakingMockScoringState,
  type InsertSpeakingMockSessionResult,
} from "@/lib/speaking-mock-scoring.server";
import type {
  SpeakingMockRecordStatus,
  SpeakingMockSessionGroup,
  SpeakingMockSubmitResponse,
  SpeakingMockTurnPhase,
} from "@/lib/speaking-mock-review";
import type { SpeakingReviewEnv } from "@/lib/speaking-review.server";

type RetrySessionRow = {
  id: number;
  session_uuid: string;
  user_id: string;
  topic_group: SpeakingMockSessionGroup;
  topic_id: string;
  topic_title: string;
  status: SpeakingMockRecordStatus;
};

type RetryTurnRow = {
  id: number;
  turn_index: number;
  phase: SpeakingMockTurnPhase;
  speaking_question_id: number | null;
  question_text: string;
  requirement_json: string | null;
  user_audio_url: string | null;
};

type RetryJobRow = {
  id: number;
  turn_id: number | null;
  job_type: "pronunciation" | "overall_scoring";
};

async function isProMember(userId: string) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const membership = await db
    .prepare(
      `
        SELECT id
        FROM members
        WHERE user_id = ?1
          AND status = 'active'
          AND end_date > ?2
        ORDER BY end_date DESC
        LIMIT 1
      `,
    )
    .bind(userId, now)
    .first<{ id: number }>();

  return Boolean(membership?.id);
}

function parseRequirementList(value: string | null) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isVip = await isProMember(userId);
    if (!isVip) {
      return NextResponse.json(
        { error: "AI评分仅限PRO会员使用，请升级后再重试。" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { sessionUuid?: unknown };
    const sessionUuid =
      typeof body?.sessionUuid === "string" ? body.sessionUuid.trim() : "";

    if (!sessionUuid) {
      return NextResponse.json({ error: "Missing sessionUuid." }, { status: 400 });
    }

    const db = await getDatabase();
    const session = await db
      .prepare(
        `
          SELECT
            id,
            session_uuid,
            user_id,
            topic_group,
            topic_id,
            topic_title,
            status
          FROM speaking_mock_sessions
          WHERE session_uuid = ?1
            AND user_id = ?2
          LIMIT 1
        `,
      )
      .bind(sessionUuid, userId)
      .first<RetrySessionRow>();

    if (!session) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    if (session.status !== "failed" && session.status !== "queued") {
      return NextResponse.json(
        { error: "当前仅支持对已提交或评分失败的记录重新评分。" },
        { status: 400 },
      );
    }

    const [{ results: turns }, { results: jobs }] = await Promise.all([
      db
        .prepare(
          `
            SELECT
              id,
              turn_index,
              phase,
              speaking_question_id,
              question_text,
              requirement_json,
              user_audio_url
            FROM speaking_mock_turns
            WHERE session_id = ?1
            ORDER BY turn_index ASC
          `,
        )
        .bind(session.id)
        .all<RetryTurnRow>(),
      db
        .prepare(
          `
            SELECT
              id,
              turn_id,
              job_type
            FROM speaking_mock_score_jobs
            WHERE session_id = ?1
          `,
        )
        .bind(session.id)
        .all<RetryJobRow>(),
    ]);

    if (!turns?.length) {
      return NextResponse.json(
        { error: "当前记录缺少题目数据，无法重新评分。" },
        { status: 400 },
      );
    }

    const pronunciationJobsByTurnId = new Map<number, number>();
    let overallJobId = 0;

    for (const job of jobs ?? []) {
      if (job.job_type === "overall_scoring") {
        overallJobId = job.id;
        continue;
      }

      if (job.turn_id) {
        pronunciationJobsByTurnId.set(job.turn_id, job.id);
      }
    }

    if (!overallJobId) {
      return NextResponse.json(
        { error: "当前记录缺少整场评分任务，无法重新评分。" },
        { status: 500 },
      );
    }

    const insertedTurns = turns.map((turn) => {
      const pronunciationJobId = pronunciationJobsByTurnId.get(turn.id) ?? 0;
      if (!pronunciationJobId || !turn.user_audio_url) {
        throw new Error("当前记录缺少重评分所需的音频或任务信息。");
      }

      return {
        turnId: turn.id,
        pronunciationJobId,
        turnIndex: turn.turn_index,
        phase: turn.phase,
        questionText: turn.question_text,
        requirements: parseRequirementList(turn.requirement_json),
        userAudioUrl: turn.user_audio_url,
      };
    });

    await resetSpeakingMockScoringState(session.id);

    const { env } = await getCloudflareContext({ async: true });
    const finalStatus = await executeSpeakingMockScoringWorkflow(
      env as SpeakingReviewEnv,
      {
        group: session.topic_group,
        topicId: session.topic_id,
        topic: session.topic_title,
      },
      {
        sessionId: session.id,
        sessionUuid: session.session_uuid,
        status: "queued",
        turns: insertedTurns,
        overallJobId,
      } satisfies InsertSpeakingMockSessionResult,
    );

    return NextResponse.json({
      sessionId: session.id,
      sessionUuid: session.session_uuid,
      status: finalStatus,
    } satisfies SpeakingMockSubmitResponse);
  } catch (error) {
    console.error("Failed to retry speaking mock scoring:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retry speaking mock scoring.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
