CREATE TABLE IF NOT EXISTS practice_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_key TEXT NOT NULL UNIQUE,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('cambridge_practice', 'speaking_mock', 'intensive_listening')
  ),
  source_path TEXT NOT NULL,
  item_title TEXT NOT NULL,
  item_subtitle TEXT,
  module TEXT,
  book_no INTEGER,
  test_no INTEGER,
  part_no INTEGER,
  topic_id TEXT,
  topic_group TEXT,
  question_count INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_practice_activity_logs_user_ended
  ON practice_activity_logs(user_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_activity_logs_user_started
  ON practice_activity_logs(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_activity_logs_type
  ON practice_activity_logs(activity_type, ended_at DESC);
