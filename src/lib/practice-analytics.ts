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

export type PracticeActivityDailyStat = {
  dateKey: string;
  durationSeconds: number;
  sessionCount: number;
  questionCount: number;
};

export type PracticeActivityDistributionStat = {
  key: string;
  durationSeconds: number;
  sessionCount: number;
  questionCount: number;
};

export type PracticeActivityHourStat = {
  hour: number;
  durationSeconds: number;
  sessionCount: number;
};

export type PracticeActivityDashboard = {
  summary: {
    todayDurationSeconds: number;
    totalDurationSeconds: number;
    totalSessionCount: number;
    totalQuestionCount: number;
    averageSessionDurationSeconds: number;
    longestSessionDurationSeconds: number;
    activeDayCount: number;
  };
  recentRecords: PracticeActivityRecord[];
  dailyStats: PracticeActivityDailyStat[];
  activityTypeStats: PracticeActivityDistributionStat[];
  moduleStats: PracticeActivityDistributionStat[];
  hourStats: PracticeActivityHourStat[];
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

type PracticeActivitySummaryRow = {
  today_duration_seconds: number | null;
  total_duration_seconds: number | null;
  total_session_count: number | null;
  total_question_count: number | null;
  average_session_duration_seconds: number | null;
  longest_session_duration_seconds: number | null;
  active_day_count: number | null;
};

type PracticeActivityDailyRow = {
  date_key: string;
  duration_seconds: number | null;
  session_count: number | null;
  question_count: number | null;
};

type PracticeActivityDistributionRow = {
  stat_key: string;
  duration_seconds: number | null;
  session_count: number | null;
  question_count: number | null;
};

type PracticeActivityHourRow = {
  hour: number | null;
  duration_seconds: number | null;
  session_count: number | null;
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
    recentRecords: (recentRows.results ?? []).map(mapPracticeActivityRecord),
  };
}

function mapPracticeActivityRecord(row: PracticeActivityRow): PracticeActivityRecord {
  return {
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
  };
}

export async function getPracticeActivityDashboard(
  userId: string,
  options?: {
    dailyDays?: number;
    recentLimit?: number;
  },
): Promise<PracticeActivityDashboard> {
  const dailyDays = Math.max(7, Math.min(90, Math.floor(options?.dailyDays ?? 28)));
  const recentLimit = Math.max(6, Math.min(30, Math.floor(options?.recentLimit ?? 12)));
  const db = await getDatabase();

  const [summaryRow, recentRows, dailyRows, activityTypeRows, moduleRows, hourRows] =
    await Promise.all([
      db
        .prepare(
          `
            SELECT
              COALESCE(SUM(CASE
                WHEN date(started_at, 'unixepoch', '+8 hours') = date('now', '+8 hours')
                THEN duration_seconds
                ELSE 0
              END), 0) AS today_duration_seconds,
              COALESCE(SUM(duration_seconds), 0) AS total_duration_seconds,
              COUNT(*) AS total_session_count,
              COALESCE(SUM(question_count), 0) AS total_question_count,
              COALESCE(AVG(duration_seconds), 0) AS average_session_duration_seconds,
              COALESCE(MAX(duration_seconds), 0) AS longest_session_duration_seconds,
              COUNT(DISTINCT date(started_at, 'unixepoch', '+8 hours')) AS active_day_count
            FROM practice_activity_logs
            WHERE user_id = ?1
          `,
        )
        .bind(userId)
        .first<PracticeActivitySummaryRow>(),
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
            LIMIT ?2
          `,
        )
        .bind(userId, recentLimit)
        .all<PracticeActivityRow>(),
      db
        .prepare(
          `
            SELECT
              date(started_at, 'unixepoch', '+8 hours') AS date_key,
              COALESCE(SUM(duration_seconds), 0) AS duration_seconds,
              COUNT(*) AS session_count,
              COALESCE(SUM(question_count), 0) AS question_count
            FROM practice_activity_logs
            WHERE user_id = ?1
              AND started_at >= unixepoch('now', '-${dailyDays - 1} days', '+8 hours', '-8 hours', 'start of day')
            GROUP BY date_key
            ORDER BY date_key ASC
          `,
        )
        .bind(userId)
        .all<PracticeActivityDailyRow>(),
      db
        .prepare(
          `
            SELECT
              activity_type AS stat_key,
              COALESCE(SUM(duration_seconds), 0) AS duration_seconds,
              COUNT(*) AS session_count,
              COALESCE(SUM(question_count), 0) AS question_count
            FROM practice_activity_logs
            WHERE user_id = ?1
            GROUP BY activity_type
            ORDER BY duration_seconds DESC, session_count DESC
          `,
        )
        .bind(userId)
        .all<PracticeActivityDistributionRow>(),
      db
        .prepare(
          `
            SELECT
              CASE
                WHEN activity_type = 'cambridge_practice' AND module IS NOT NULL AND module != '' THEN module
                WHEN activity_type = 'speaking_mock' THEN 'speaking_mock'
                WHEN activity_type = 'intensive_listening' THEN 'intensive_listening'
                ELSE 'other'
              END AS stat_key,
              COALESCE(SUM(duration_seconds), 0) AS duration_seconds,
              COUNT(*) AS session_count,
              COALESCE(SUM(question_count), 0) AS question_count
            FROM practice_activity_logs
            WHERE user_id = ?1
            GROUP BY stat_key
            ORDER BY duration_seconds DESC, session_count DESC
          `,
        )
        .bind(userId)
        .all<PracticeActivityDistributionRow>(),
      db
        .prepare(
          `
            SELECT
              CAST(strftime('%H', datetime(started_at, 'unixepoch', '+8 hours')) AS INTEGER) AS hour,
              COALESCE(SUM(duration_seconds), 0) AS duration_seconds,
              COUNT(*) AS session_count
            FROM practice_activity_logs
            WHERE user_id = ?1
            GROUP BY hour
            ORDER BY hour ASC
          `,
        )
        .bind(userId)
        .all<PracticeActivityHourRow>(),
    ]);

  return {
    summary: {
      todayDurationSeconds: Number(summaryRow?.today_duration_seconds ?? 0),
      totalDurationSeconds: Number(summaryRow?.total_duration_seconds ?? 0),
      totalSessionCount: Number(summaryRow?.total_session_count ?? 0),
      totalQuestionCount: Number(summaryRow?.total_question_count ?? 0),
      averageSessionDurationSeconds: Math.round(
        Number(summaryRow?.average_session_duration_seconds ?? 0),
      ),
      longestSessionDurationSeconds: Number(summaryRow?.longest_session_duration_seconds ?? 0),
      activeDayCount: Number(summaryRow?.active_day_count ?? 0),
    },
    recentRecords: (recentRows.results ?? []).map(mapPracticeActivityRecord),
    dailyStats: (dailyRows.results ?? []).map((row) => ({
      dateKey: row.date_key,
      durationSeconds: Number(row.duration_seconds ?? 0),
      sessionCount: Number(row.session_count ?? 0),
      questionCount: Number(row.question_count ?? 0),
    })),
    activityTypeStats: (activityTypeRows.results ?? []).map((row) => ({
      key: row.stat_key,
      durationSeconds: Number(row.duration_seconds ?? 0),
      sessionCount: Number(row.session_count ?? 0),
      questionCount: Number(row.question_count ?? 0),
    })),
    moduleStats: (moduleRows.results ?? []).map((row) => ({
      key: row.stat_key,
      durationSeconds: Number(row.duration_seconds ?? 0),
      sessionCount: Number(row.session_count ?? 0),
      questionCount: Number(row.question_count ?? 0),
    })),
    hourStats: (hourRows.results ?? []).map((row) => ({
      hour: Number(row.hour ?? 0),
      durationSeconds: Number(row.duration_seconds ?? 0),
      sessionCount: Number(row.session_count ?? 0),
    })),
  };
}
