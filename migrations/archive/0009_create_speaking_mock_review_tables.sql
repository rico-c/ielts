CREATE TABLE IF NOT EXISTS speaking_mock_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_uuid TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  topic_group TEXT NOT NULL CHECK (topic_group IN ('part1', 'part23')),
  topic_id TEXT NOT NULL,
  topic_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  turn_count INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  overall_band REAL,
  pronunciation_band REAL,
  fluency_band REAL,
  lexical_resource_band REAL,
  grammatical_range_band REAL,
  coherence_band REAL,
  overview TEXT,
  criteria_json TEXT,
  strengths_json TEXT,
  suggestions_json TEXT,
  workflow_name TEXT,
  workflow_instance_id TEXT,
  error_message TEXT,
  submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  scoring_started_at INTEGER,
  scoring_completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_sessions_user_submitted
  ON speaking_mock_sessions(user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_sessions_status
  ON speaking_mock_sessions(status);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_sessions_topic
  ON speaking_mock_sessions(topic_group, topic_id);

CREATE TABLE IF NOT EXISTS speaking_mock_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  turn_index INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('part1', 'part2', 'part3')),
  speaking_question_id INTEGER,
  question_text TEXT NOT NULL,
  requirement_json TEXT,
  examiner_audio_url TEXT,
  user_audio_r2_key TEXT NOT NULL,
  user_audio_url TEXT,
  transcript_text TEXT,
  transcript_provider TEXT,
  transcript_confidence REAL,
  pronunciation_overall_score REAL,
  pronunciation_accuracy_score REAL,
  pronunciation_fluency_score REAL,
  pronunciation_completeness_score REAL,
  pronunciation_prosody_score REAL,
  pronunciation_result_json TEXT,
  ai_feedback_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(session_id, turn_index),
  FOREIGN KEY (session_id) REFERENCES speaking_mock_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (speaking_question_id) REFERENCES speaking_questions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_turns_session
  ON speaking_mock_turns(session_id, turn_index);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_turns_status
  ON speaking_mock_turns(status);

CREATE TABLE IF NOT EXISTS speaking_mock_score_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_uuid TEXT NOT NULL UNIQUE,
  session_id INTEGER NOT NULL,
  turn_id INTEGER,
  job_type TEXT NOT NULL CHECK (job_type IN ('pronunciation', 'overall_scoring')),
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  request_payload TEXT,
  result_json TEXT,
  last_error TEXT,
  queued_at INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES speaking_mock_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (turn_id) REFERENCES speaking_mock_turns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_score_jobs_session
  ON speaking_mock_score_jobs(session_id, status);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_score_jobs_turn
  ON speaking_mock_score_jobs(turn_id, status);

CREATE INDEX IF NOT EXISTS idx_speaking_mock_score_jobs_type
  ON speaking_mock_score_jobs(job_type, provider, status);
