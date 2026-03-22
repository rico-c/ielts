ALTER TABLE speaking_questions
ADD COLUMN audio_url TEXT;

CREATE INDEX IF NOT EXISTS idx_speaking_questions_audio_url
  ON speaking_questions(audio_url);
