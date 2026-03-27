import { getDatabase } from "@/lib/db";
import {
  normalizeSpeakingCriteria,
  normalizeSpeakingBandScore,
  normalizeSpeakingSuggestions,
  type SpeakingMockRecordDetail,
  type SpeakingMockRecordSummary,
  type SpeakingMockRecordStatus,
  type SpeakingMockRecordTurn,
} from "@/lib/speaking-mock-review";

type SpeakingMockRecordSummaryRow = {
  id: number;
  session_uuid: string;
  topic_group: "part1" | "part23";
  topic_id: string;
  topic_title: string;
  status: SpeakingMockRecordStatus;
  turn_count: number;
  answered_count: number;
  overall_band: number | null;
  submitted_at: number;
  scoring_completed_at: number | null;
  created_at: number;
  updated_at: number;
  overview: string | null;
  criteria_json: string | null;
  strengths_json: string | null;
  suggestions_json: string | null;
  error_message: string | null;
};

type SpeakingMockRecordTurnRow = {
  id: number;
  session_id: number;
  turn_index: number;
  phase: "part1" | "part2" | "part3";
  question_text: string;
  user_audio_url: string | null;
  user_audio_r2_key: string;
  transcript_text: string | null;
  pronunciation_overall_score: number | null;
  created_at: number;
  updated_at: number;
};

function parseJsonField(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getSpeakingMockSessionSummaries(
  userId: string,
): Promise<SpeakingMockRecordSummary[]> {
  const db = await getDatabase();
  const { results } = await db
    .prepare(
      `
        SELECT
          id,
          session_uuid,
          topic_group,
          topic_id,
          topic_title,
          status,
          turn_count,
          answered_count,
          overall_band,
          submitted_at,
          scoring_completed_at,
          created_at,
          updated_at,
          overview,
          criteria_json,
          strengths_json,
          suggestions_json,
          error_message
        FROM speaking_mock_sessions
        WHERE user_id = ?1
        ORDER BY submitted_at DESC, id DESC
      `,
    )
    .bind(userId)
    .all<SpeakingMockRecordSummaryRow>();

  return (results ?? []).map((row) => {
    const criteria = normalizeSpeakingCriteria(parseJsonField(row.criteria_json));
    const strengths = parseJsonField(row.strengths_json);
    const suggestions = parseJsonField(row.suggestions_json);

    return {
      id: row.id,
      sessionUuid: row.session_uuid,
      group: row.topic_group,
      topicId: row.topic_id,
      topicTitle: row.topic_title,
      status: row.status,
      turnCount: row.turn_count,
      answeredCount: row.answered_count,
      overallBand: normalizeSpeakingBandScore(row.overall_band),
      submittedAt: row.submitted_at,
      scoringCompletedAt: row.scoring_completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      overview: row.overview,
      criteria,
      strengths: Array.isArray(strengths)
        ? strengths
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .slice(0, 4)
        : [],
      suggestions: normalizeSpeakingSuggestions(suggestions),
      errorMessage: row.error_message,
    };
  });
}

export async function getSpeakingMockSessionDetails(
  userId: string,
): Promise<SpeakingMockRecordDetail[]> {
  const [summaries, turns] = await Promise.all([
    getSpeakingMockSessionSummaries(userId),
    getSpeakingMockTurnsByUserId(userId),
  ]);

  const turnsBySessionId = new Map<number, SpeakingMockRecordTurn[]>();
  for (const turn of turns) {
    const current = turnsBySessionId.get(turn.sessionId) ?? [];
    current.push(turn.value);
    turnsBySessionId.set(turn.sessionId, current);
  }

  return summaries.map((summary) => ({
    ...summary,
    turns: turnsBySessionId.get(summary.id) ?? [],
  }));
}

async function getSpeakingMockTurnsByUserId(userId: string) {
  const db = await getDatabase();
  const { results } = await db
    .prepare(
      `
        SELECT
          t.id,
          t.session_id,
          t.turn_index,
          t.phase,
          t.question_text,
          t.user_audio_url,
          t.user_audio_r2_key,
          t.transcript_text,
          t.pronunciation_overall_score,
          t.created_at,
          t.updated_at
        FROM speaking_mock_turns t
        INNER JOIN speaking_mock_sessions s
          ON s.id = t.session_id
        WHERE s.user_id = ?1
        ORDER BY s.submitted_at DESC, t.turn_index ASC
      `,
    )
    .bind(userId)
    .all<SpeakingMockRecordTurnRow>();

  return (results ?? []).map((row) => ({
    sessionId: row.session_id,
    value: {
      id: row.id,
      turnIndex: row.turn_index,
      phase: row.phase,
      questionText: row.question_text,
      userAudioUrl: row.user_audio_url,
      isHistoryAudio: row.user_audio_r2_key.startsWith("speaking-mock-history/"),
      transcriptText: row.transcript_text,
      pronunciationScore: row.pronunciation_overall_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies SpeakingMockRecordTurn,
  }));
}
