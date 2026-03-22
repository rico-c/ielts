CREATE TABLE IF NOT EXISTS speaking_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part INTEGER NOT NULL CHECK (part IN (1, 2, 3)),
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  requirement TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_speaking_questions_part
  ON speaking_questions(part);

CREATE INDEX IF NOT EXISTS idx_speaking_questions_topic
  ON speaking_questions(topic);
