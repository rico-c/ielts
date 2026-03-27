import { getDatabase } from "@/lib/db";
import {
  generateSpeakingAiReview,
  generateTurnPronunciationAssessment,
  type SpeakingPronunciationTurnInput,
  type SpeakingReviewEnv,
} from "@/lib/speaking-review.server";
import type {
  SpeakingAiReview,
  SpeakingMockRecordStatus,
  SpeakingMockSessionGroup,
} from "@/lib/speaking-mock-review";

export type InsertedSpeakingTurnRecord = SpeakingPronunciationTurnInput & {
  pronunciationJobId: number;
};

export type InsertSpeakingMockSessionResult = {
  sessionId: number;
  sessionUuid: string;
  status: SpeakingMockRecordStatus;
  turns: InsertedSpeakingTurnRecord[];
  overallJobId: number;
};

type SpeakingMockScoringPayload = {
  group: SpeakingMockSessionGroup;
  topicId: string;
  topic: string;
};

function stringifyForStorage(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 2000) || "Unknown scoring error.";
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

export async function resetSpeakingMockScoringState(sessionId: number) {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await Promise.all([
    db
      .prepare(
        `
          UPDATE speaking_mock_sessions
          SET
            status = 'queued',
            overall_band = NULL,
            pronunciation_band = NULL,
            fluency_band = NULL,
            lexical_resource_band = NULL,
            grammatical_range_band = NULL,
            coherence_band = NULL,
            overview = NULL,
            criteria_json = NULL,
            strengths_json = NULL,
            suggestions_json = NULL,
            error_message = NULL,
            scoring_started_at = NULL,
            scoring_completed_at = NULL,
            updated_at = ?2
          WHERE id = ?1
        `,
      )
      .bind(sessionId, now)
      .run(),
    db
      .prepare(
        `
          UPDATE speaking_mock_turns
          SET
            transcript_text = NULL,
            transcript_provider = NULL,
            transcript_confidence = NULL,
            pronunciation_overall_score = NULL,
            pronunciation_accuracy_score = NULL,
            pronunciation_fluency_score = NULL,
            pronunciation_completeness_score = NULL,
            pronunciation_prosody_score = NULL,
            pronunciation_result_json = NULL,
            ai_feedback_json = NULL,
            status = 'queued',
            error_message = NULL,
            updated_at = ?2
          WHERE session_id = ?1
        `,
      )
      .bind(sessionId, now)
      .run(),
    db
      .prepare(
        `
          UPDATE speaking_mock_score_jobs
          SET
            status = 'queued',
            result_json = NULL,
            last_error = NULL,
            queued_at = ?2,
            started_at = NULL,
            finished_at = NULL,
            updated_at = ?2
          WHERE session_id = ?1
        `,
      )
      .bind(sessionId, now)
      .run(),
  ]);
}

export async function executeSpeakingMockScoringWorkflow(
  env: SpeakingReviewEnv,
  payload: SpeakingMockScoringPayload,
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
