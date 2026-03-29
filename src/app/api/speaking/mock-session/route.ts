import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import {
  generateSpeakingAiReview,
  generateTurnPronunciationAssessment,
  type SpeakingPronunciationTurnInput,
  type SpeakingReviewEnv,
} from "@/lib/speaking-review.server";
import type {
  SpeakingAiReview,
  SpeakingMockSubmissionRequestPayload,
  SpeakingMockSubmissionTurnPayload,
  SpeakingMockRecordStatus,
  SpeakingMockSubmitResponse,
} from "@/lib/speaking-mock-review";

const DEFAULT_PUBLIC_R2_BASE_URL = "https://ieltsfile.youshowedu.com";

type SessionInsertResult = D1Result<never>;

type InsertedSpeakingTurnRecord = SpeakingPronunciationTurnInput & {
  pronunciationJobId: number;
};

type InsertSpeakingMockSessionResult = SpeakingMockSubmitResponse & {
  turns: InsertedSpeakingTurnRecord[];
  overallJobId: number;
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

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildPublicAudioUrl(objectKey: string) {
  const baseUrl = ensureTrailingSlash(
    process.env.PUBLIC_R2_BASE_URL || DEFAULT_PUBLIC_R2_BASE_URL,
  );
  return `${baseUrl}${objectKey}`;
}

function buildTimestampLabel(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function inferUploadedAudioExtension(file: File) {
  const normalizedName =
    typeof file.name === "string" ? file.name.trim().toLowerCase() : "";
  const normalizedType =
    typeof file.type === "string" ? file.type.trim().toLowerCase() : "";

  if (normalizedName.endsWith(".wav") || normalizedType === "audio/wav") {
    return "wav";
  }

  if (normalizedName.endsWith(".webm") || normalizedType === "audio/webm") {
    return "webm";
  }

  if (
    normalizedName.endsWith(".m4a") ||
    normalizedType === "audio/mp4" ||
    normalizedType === "audio/m4a"
  ) {
    return "m4a";
  }

  return "wav";
}

function buildErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 2000) || "Unknown scoring error.";
}

function stringifyForStorage(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function isValidTurnPhase(value: unknown): value is SpeakingMockSubmissionTurnPayload["phase"] {
  return value === "part1" || value === "part2" || value === "part3";
}

function isValidGroup(value: unknown): value is SpeakingMockSubmissionRequestPayload["group"] {
  return value === "part1" || value === "part23";
}

function normalizeRequirementList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function parseSubmissionPayload(raw: unknown): SpeakingMockSubmissionRequestPayload | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const group = record.group;
  const topicId = typeof record.topicId === "string" ? record.topicId.trim() : "";
  const topic = typeof record.topic === "string" ? record.topic.trim() : "";
  const turns = Array.isArray(record.turns) ? record.turns : [];

  if (!isValidGroup(group) || !topicId || !topic || turns.length === 0) {
    return null;
  }

  const normalizedTurns = turns
    .map((turn) => {
      if (!turn || typeof turn !== "object") {
        return null;
      }

      const turnRecord = turn as Record<string, unknown>;
      const phase = turnRecord.phase;
      const questionId = Number(turnRecord.questionId);
      const question =
        typeof turnRecord.question === "string" ? turnRecord.question.trim() : "";
      const userAudioField =
        typeof turnRecord.userAudioField === "string"
          ? turnRecord.userAudioField.trim()
          : "";
      const examinerAudioUrl =
        typeof turnRecord.examinerAudioUrl === "string" &&
        turnRecord.examinerAudioUrl.trim().length > 0
          ? turnRecord.examinerAudioUrl.trim()
          : null;

      if (
        !isValidTurnPhase(phase) ||
        !Number.isInteger(questionId) ||
        questionId <= 0 ||
        !question ||
        !userAudioField
      ) {
        return null;
      }

      return {
        phase,
        questionId,
        question,
        requirements: normalizeRequirementList(turnRecord.requirements),
        examinerAudioUrl,
        userAudioField,
      } satisfies SpeakingMockSubmissionTurnPayload;
    })
    .filter(
      (turn): turn is SpeakingMockSubmissionTurnPayload => turn !== null,
    );

  if (normalizedTurns.length !== turns.length) {
    return null;
  }

  return {
    group,
    topicId,
    topic,
    turns: normalizedTurns,
  };
}

async function uploadUserAudio(
  env: CloudflareEnv,
  {
    file,
    objectKey,
  }: {
    file: File;
    objectKey: string;
  },
) {
  await env.STORAGE.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "audio/wav",
    },
  });

  return buildPublicAudioUrl(objectKey);
}

async function insertSpeakingMockSession(
  payload: SpeakingMockSubmissionRequestPayload,
  {
    userId,
    sessionUuid,
    audioUploads,
  }: {
    userId: string;
    sessionUuid: string;
    audioUploads: Array<{
      turn: SpeakingMockSubmissionTurnPayload;
      objectKey: string;
      audioUrl: string;
    }>;
  },
) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const status: SpeakingMockRecordStatus = "queued";

  const sessionInsert = (await db
    .prepare(
      `
        INSERT INTO speaking_mock_sessions (
          session_uuid,
          user_id,
          topic_group,
          topic_id,
          topic_title,
          status,
          turn_count,
          answered_count,
          submitted_at,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `,
    )
    .bind(
      sessionUuid,
      userId,
      payload.group,
      payload.topicId,
      payload.topic,
      status,
      payload.turns.length,
      payload.turns.length,
      now,
      now,
      now,
    )
    .run()) as SessionInsertResult;

  const sessionId = Number(sessionInsert.meta.last_row_id ?? 0);
  if (!sessionId) {
    throw new Error("Failed to create speaking mock session.");
  }

  const insertedTurns: InsertedSpeakingTurnRecord[] = [];

  for (let index = 0; index < audioUploads.length; index += 1) {
    const item = audioUploads[index];
    const turnInsert = await db
      .prepare(
        `
          INSERT INTO speaking_mock_turns (
            session_id,
            turn_index,
            phase,
            speaking_question_id,
            question_text,
            requirement_json,
            examiner_audio_url,
            user_audio_r2_key,
            user_audio_url,
            status,
            created_at,
            updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'queued', ?10, ?11)
        `,
      )
      .bind(
        sessionId,
        index,
        item.turn.phase,
        item.turn.questionId,
        item.turn.question,
        JSON.stringify(item.turn.requirements),
        item.turn.examinerAudioUrl,
        item.objectKey,
        item.audioUrl,
        now,
        now,
      )
      .run();

    const turnId = Number(turnInsert.meta.last_row_id ?? 0);
    if (!turnId) {
      throw new Error("Failed to create speaking mock turn record.");
    }

    const pronunciationJobInsert = await db
      .prepare(
        `
          INSERT INTO speaking_mock_score_jobs (
            job_uuid,
            session_id,
            turn_id,
            job_type,
            provider,
            status,
            queued_at,
            request_payload,
            created_at,
            updated_at
          ) VALUES (?1, ?2, ?3, 'pronunciation', 'azure_speech_sdk', 'queued', ?4, ?5, ?6, ?7)
        `,
      )
      .bind(
        crypto.randomUUID(),
        sessionId,
        turnId,
        now,
        stringifyForStorage({
          turnIndex: index,
          phase: item.turn.phase,
          questionId: item.turn.questionId,
          userAudioUrl: item.audioUrl,
        }),
        now,
        now,
      )
      .run();

    const pronunciationJobId = Number(pronunciationJobInsert.meta.last_row_id ?? 0);
    if (!pronunciationJobId) {
      throw new Error("Failed to create pronunciation score job.");
    }

    insertedTurns.push({
      turnId,
      pronunciationJobId,
      turnIndex: index,
      phase: item.turn.phase,
      questionText: item.turn.question,
      requirements: item.turn.requirements,
      userAudioUrl: item.audioUrl,
    });
  }

  const overallJobInsert = await db
    .prepare(
      `
        INSERT INTO speaking_mock_score_jobs (
          job_uuid,
          session_id,
          job_type,
          provider,
          status,
          queued_at,
          request_payload,
          created_at,
          updated_at
        ) VALUES (?1, ?2, 'overall_scoring', 'workers_ai', 'queued', ?3, ?4, ?5, ?6)
      `,
    )
    .bind(
      crypto.randomUUID(),
      sessionId,
      now,
      stringifyForStorage({
        group: payload.group,
        topicId: payload.topicId,
        topic: payload.topic,
        turnCount: payload.turns.length,
      }),
      now,
      now,
    )
    .run();

  const overallJobId = Number(overallJobInsert.meta.last_row_id ?? 0);
  if (!overallJobId) {
    throw new Error("Failed to create overall speaking score job.");
  }

  return {
    sessionId,
    sessionUuid,
    status,
    turns: insertedTurns,
    overallJobId,
  } satisfies InsertSpeakingMockSessionResult;
}

async function markSessionProcessing(sessionId: number) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_sessions
        SET
          status = 'processing',
          scoring_started_at = COALESCE(scoring_started_at, ?2),
          error_message = NULL,
          updated_at = ?2
        WHERE id = ?1
      `,
    )
    .bind(sessionId, now)
    .run();
}

async function markSessionFailed(sessionId: number, errorMessage: string) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_sessions
        SET
          status = 'failed',
          error_message = ?2,
          scoring_completed_at = ?3,
          updated_at = ?3
        WHERE id = ?1
      `,
    )
    .bind(sessionId, errorMessage, now)
    .run();
}

async function markSessionCompleted(sessionId: number, review: SpeakingAiReview) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_sessions
        SET
          status = 'completed',
          overall_band = ?2,
          pronunciation_band = ?3,
          fluency_band = ?4,
          lexical_resource_band = ?5,
          grammatical_range_band = ?6,
          coherence_band = ?4,
          overview = ?7,
          criteria_json = ?8,
          strengths_json = ?9,
          suggestions_json = ?10,
          error_message = NULL,
          scoring_completed_at = ?11,
          updated_at = ?11
        WHERE id = ?1
      `,
    )
    .bind(
      sessionId,
      review.overallBand,
      review.criteria.pronunciation.band,
      review.criteria.fluencyAndCoherence.band,
      review.criteria.lexicalResource.band,
      review.criteria.grammaticalRangeAndAccuracy.band,
      review.overview,
      JSON.stringify(review.criteria),
      JSON.stringify(review.strengths),
      JSON.stringify(review.suggestions),
      now,
    )
    .run();
}

async function markTurnProcessing(turnId: number) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_turns
        SET
          status = 'processing',
          error_message = NULL,
          updated_at = ?2
        WHERE id = ?1
      `,
    )
    .bind(turnId, now)
    .run();
}

async function markTurnCompleted(
  turnId: number,
  result: Awaited<ReturnType<typeof generateTurnPronunciationAssessment>>,
) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_turns
        SET
          transcript_text = ?2,
          transcript_provider = 'azure_speech_sdk',
          transcript_confidence = ?3,
          pronunciation_overall_score = ?4,
          pronunciation_accuracy_score = ?5,
          pronunciation_fluency_score = ?6,
          pronunciation_completeness_score = ?7,
          pronunciation_prosody_score = ?8,
          pronunciation_result_json = ?9,
          status = 'completed',
          error_message = NULL,
          updated_at = ?10
        WHERE id = ?1
      `,
    )
    .bind(
      turnId,
      result.transcriptText,
      result.transcriptConfidence,
      result.pronunciationOverallScore,
      result.pronunciationAccuracyScore,
      result.pronunciationFluencyScore,
      result.pronunciationCompletenessScore,
      result.pronunciationProsodyScore,
      result.pronunciationResultJson,
      now,
    )
    .run();
}

async function markTurnFailed(turnId: number, errorMessage: string) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_turns
        SET
          status = 'failed',
          error_message = ?2,
          updated_at = ?3
        WHERE id = ?1
      `,
    )
    .bind(turnId, errorMessage, now)
    .run();
}

async function markJobProcessing(jobId: number) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_score_jobs
        SET
          status = 'processing',
          attempt_count = attempt_count + 1,
          started_at = ?2,
          last_error = NULL,
          updated_at = ?2
        WHERE id = ?1
      `,
    )
    .bind(jobId, now)
    .run();
}

async function markJobCompleted(jobId: number, result: unknown) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_score_jobs
        SET
          status = 'completed',
          result_json = ?2,
          last_error = NULL,
          finished_at = ?3,
          updated_at = ?3
        WHERE id = ?1
      `,
    )
    .bind(jobId, stringifyForStorage(result), now)
    .run();
}

async function markJobFailed(jobId: number, errorMessage: string, result?: unknown) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
        UPDATE speaking_mock_score_jobs
        SET
          status = 'failed',
          result_json = COALESCE(?2, result_json),
          last_error = ?3,
          finished_at = ?4,
          updated_at = ?4
        WHERE id = ?1
      `,
    )
    .bind(jobId, result === undefined ? null : stringifyForStorage(result), errorMessage, now)
    .run();
}

async function executeSpeakingMockScoring(
  env: SpeakingReviewEnv,
  payload: SpeakingMockSubmissionRequestPayload,
  inserted: InsertSpeakingMockSessionResult,
) {
  await markSessionProcessing(inserted.sessionId);

  const completedTurns: Array<Awaited<ReturnType<typeof generateTurnPronunciationAssessment>>> = [];

  for (const turn of inserted.turns) {
    await Promise.all([
      markTurnProcessing(turn.turnId),
      markJobProcessing(turn.pronunciationJobId),
    ]);

    try {
      const pronunciationResult = await generateTurnPronunciationAssessment(env, turn);
      completedTurns.push(pronunciationResult);

      await Promise.all([
        markTurnCompleted(turn.turnId, pronunciationResult),
        markJobCompleted(turn.pronunciationJobId, pronunciationResult),
      ]);
    } catch (error) {
      const errorMessage = buildErrorMessage(error);

      await Promise.all([
        markTurnFailed(turn.turnId, errorMessage),
        markJobFailed(turn.pronunciationJobId, errorMessage),
        markJobFailed(inserted.overallJobId, errorMessage, {
          reason: "pronunciation_scoring_failed",
        }),
        markSessionFailed(inserted.sessionId, errorMessage),
      ]);

      return "failed" satisfies SpeakingMockRecordStatus;
    }
  }

  await markJobProcessing(inserted.overallJobId);

  try {
    const review = await generateSpeakingAiReview(env, {
      group: payload.group,
      topicId: payload.topicId,
      topicTitle: payload.topic,
      turns: completedTurns,
    });

    await Promise.all([
      markSessionCompleted(inserted.sessionId, review),
      markJobCompleted(inserted.overallJobId, review),
    ]);

    return "completed" satisfies SpeakingMockRecordStatus;
  } catch (error) {
    const errorMessage = buildErrorMessage(error);

    await Promise.all([
      markJobFailed(inserted.overallJobId, errorMessage),
      markSessionFailed(inserted.sessionId, errorMessage),
    ]);

    return "failed" satisfies SpeakingMockRecordStatus;
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
        { error: "AI评分仅限PRO会员使用，请升级后再提交。" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const metadataRaw = formData.get("metadata");
    if (typeof metadataRaw !== "string" || !metadataRaw.trim()) {
      return NextResponse.json({ error: "Missing metadata." }, { status: 400 });
    }

    const payload = parseSubmissionPayload(JSON.parse(metadataRaw));
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid speaking mock submission payload." },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const sessionUuid = crypto.randomUUID();
    const safeUserId = sanitizePathSegment(userId) || "user";
    const safeTopicId = sanitizePathSegment(payload.topicId) || "topic";
    const audioUploads: Array<{
      turn: SpeakingMockSubmissionTurnPayload;
      objectKey: string;
      audioUrl: string;
    }> = [];

    for (let index = 0; index < payload.turns.length; index += 1) {
      const turn = payload.turns[index];
      const fileEntry = formData.get(turn.userAudioField);
      if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
        return NextResponse.json(
          { error: `Missing audio file for turn ${index + 1}.` },
          { status: 400 },
        );
      }

      const fileTimestamp = buildTimestampLabel();
      const objectKey = [
        "speaking-mock-history",
        safeUserId,
        safeTopicId,
        sessionUuid,
        `${String(index + 1).padStart(2, "0")}_${turn.phase}_${turn.questionId}_${fileTimestamp}.${inferUploadedAudioExtension(fileEntry)}`,
      ].join("/");

      const audioUrl = await uploadUserAudio(env, {
        file: fileEntry,
        objectKey,
      });

      audioUploads.push({ turn, objectKey, audioUrl });
    }

    const inserted = await insertSpeakingMockSession(payload, {
      userId,
      sessionUuid,
      audioUploads,
    });
    const finalStatus = await executeSpeakingMockScoring(
      env as SpeakingReviewEnv,
      payload,
      inserted,
    );

    return NextResponse.json({
      sessionId: inserted.sessionId,
      sessionUuid: inserted.sessionUuid,
      status: finalStatus,
    } satisfies SpeakingMockSubmitResponse);
  } catch (error) {
    console.error("Failed to submit speaking mock session:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit speaking mock session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
