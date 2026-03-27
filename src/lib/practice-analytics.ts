import { getDatabase } from "@/lib/db";

export type PracticeActivityType =
  | "cambridge_practice"
  | "speaking_mock"
  | "intensive_listening";

export type PracticeActivityRecord = {
  id: number;
  activityType: PracticeActivityType;
  sourcePath: string;
  itemTitle: string;
  itemSubtitle: string | null;
  module: string | null;
  bookNo: number | null;
  testNo: number | null;
  partNo: number | null;
  topicId: string | null;
  topicGroup: string | null;
  questionCount: number;
  durationSeconds: number;
  startedAt: number;
  endedAt: number;
};

type PracticeActivityRow = {
  id: number;
  activity_type: PracticeActivityType;
  source_path: string;
  item_title: string;
  item_subtitle: string | null;
  module: string | null;
  book_no: number | null;
  test_no: number | null;
  part_no: number | null;
  topic_id: string | null;
  topic_group: string | null;
  question_count: number;
  duration_seconds: number;
  started_at: number;
  ended_at: number;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export async function upsertPracticeActivityLog(
  userId: string,
  payload: {
    sessionKey: string;
    activityType: PracticeActivityType;
    sourcePath: string;
    itemTitle: string;
    itemSubtitle?: string | null;
    module?: string | null;
    bookNo?: number | null;
    testNo?: number | null;
    partNo?: number | null;
    topicId?: string | null;
    topicGroup?: string | null;
    questionCount?: number | null;
    startedAt: number;
    endedAt: number;
  },
) {
  const sessionKey = normalizeText(payload.sessionKey, 120);
  const sourcePath = normalizeText(payload.sourcePath, 500);
  const itemTitle = normalizeText(payload.itemTitle, 200);

  if (!sessionKey || !sourcePath || !itemTitle) {
    throw new Error("Missing required practice activity fields.");
  }

  const startedAt = Math.max(0, Math.floor(payload.startedAt));
  const endedAt = Math.max(startedAt, Math.floor(payload.endedAt));
  const durationSeconds = Math.max(0, endedAt - startedAt);
  const now = Math.floor(Date.now() / 1000);

  const db = await getDatabase();
  await db
    .prepare(
      `
        INSERT INTO practice_activity_logs (
          user_id,
          session_key,
          activity_type,
          source_path,
          item_title,
          item_subtitle,
          module,
          book_no,
          test_no,
          part_no,
          topic_id,
          topic_group,
          question_count,
          duration_seconds,
          started_at,
          ended_at,
          created_at,
          updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
        )
        ON CONFLICT(session_key) DO UPDATE SET
          source_path = excluded.source_path,
          item_title = excluded.item_title,
          item_subtitle = excluded.item_subtitle,
          module = excluded.module,
          book_no = excluded.book_no,
          test_no = excluded.test_no,
          part_no = excluded.part_no,
          topic_id = excluded.topic_id,
          topic_group = excluded.topic_group,
          question_count = MAX(practice_activity_logs.question_count, excluded.question_count),
          duration_seconds = MAX(practice_activity_logs.duration_seconds, excluded.duration_seconds),
          started_at = MIN(practice_activity_logs.started_at, excluded.started_at),
          ended_at = MAX(practice_activity_logs.ended_at, excluded.ended_at),
          updated_at = excluded.updated_at
      `,
    )
    .bind(
      userId,
      sessionKey,
      payload.activityType,
      sourcePath,
      itemTitle,
      normalizeText(payload.itemSubtitle ?? "", 300) || null,
      normalizeText(payload.module ?? "", 40) || null,
      normalizeInteger(payload.bookNo),
      normalizeInteger(payload.testNo),
      normalizeInteger(payload.partNo),
      normalizeText(payload.topicId ?? "", 120) || null,
      normalizeText(payload.topicGroup ?? "", 40) || null,
      Math.max(0, Math.floor(payload.questionCount ?? 0)),
      durationSeconds,
      startedAt,
      endedAt,
      now,
      now,
    )
    .run();
}

export async function getPracticeActivityOverview(userId: string) {
  const db = await getDatabase();

  const [todayRow, totalRow, recentRows] = await Promise.all([
    db
      .prepare(
        `
          SELECT COALESCE(SUM(duration_seconds), 0) AS total
          FROM practice_activity_logs
          WHERE user_id = ?1
            AND date(started_at, 'unixepoch', '+8 hours') = date('now', '+8 hours')
        `,
      )
      .bind(userId)
      .first<{ total: number | null }>(),
    db
      .prepare(
        `
          SELECT COALESCE(SUM(duration_seconds), 0) AS total
          FROM practice_activity_logs
          WHERE user_id = ?1
        `,
      )
      .bind(userId)
      .first<{ total: number | null }>(),
    db
      .prepare(
        `
          SELECT
            id,
            activity_type,
            source_path,
            item_title,
            item_subtitle,
            module,
            book_no,
            test_no,
            part_no,
            topic_id,
            topic_group,
            question_count,
            duration_seconds,
            started_at,
            ended_at
          FROM practice_activity_logs
          WHERE user_id = ?1
          ORDER BY ended_at DESC, id DESC
          LIMIT 8
        `,
      )
      .bind(userId)
      .all<PracticeActivityRow>(),
  ]);

  return {
    todayDurationSeconds: Number(todayRow?.total ?? 0),
    totalDurationSeconds: Number(totalRow?.total ?? 0),
    recentRecords: (recentRows.results ?? []).map((row) => ({
      id: row.id,
      activityType: row.activity_type,
      sourcePath: row.source_path,
      itemTitle: row.item_title,
      itemSubtitle: row.item_subtitle,
      module: row.module,
      bookNo: row.book_no,
      testNo: row.test_no,
      partNo: row.part_no,
      topicId: row.topic_id,
      topicGroup: row.topic_group,
      questionCount: row.question_count,
      durationSeconds: row.duration_seconds,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    })),
  };
}
