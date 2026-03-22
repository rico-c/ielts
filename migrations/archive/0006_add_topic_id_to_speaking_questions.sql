ALTER TABLE speaking_questions
ADD COLUMN topic_id TEXT;

CREATE INDEX IF NOT EXISTS idx_speaking_questions_topic_id
  ON speaking_questions(topic_id);
