PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exam_papers (
  id TEXT PRIMARY KEY,
  source_paper_id TEXT,
  title TEXT NOT NULL,
  book TEXT,
  test_no INTEGER,
  year INTEGER,
  version TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS paper_parts (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('listening', 'reading', 'writing')),
  part_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  instruction_html TEXT,
  content_html TEXT,
  audio_url TEXT,
  sort_order INTEGER NOT NULL,
  meta_json TEXT,
  FOREIGN KEY (paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_groups (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL,
  group_no INTEGER NOT NULL,
  title TEXT,
  instruction_html TEXT,
  content_html TEXT,
  question_type TEXT NOT NULL,
  answer_rule TEXT,
  question_range_start INTEGER,
  question_range_end INTEGER,
  shared_options_json TEXT,
  meta_json TEXT,
  FOREIGN KEY (part_id) REFERENCES paper_parts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  question_no INTEGER NOT NULL,
  stem TEXT NOT NULL,
  sub_label TEXT,
  answer_text TEXT,
  answer_json TEXT,
  explanation_html TEXT,
  sort_order INTEGER NOT NULL,
  meta_json TEXT,
  FOREIGN KEY (group_id) REFERENCES question_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  option_key TEXT,
  option_text TEXT NOT NULL,
  is_correct INTEGER,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parts_paper_module
  ON paper_parts(paper_id, module, part_no);

CREATE INDEX IF NOT EXISTS idx_groups_part_order
  ON question_groups(part_id, group_no);

CREATE INDEX IF NOT EXISTS idx_questions_group_order
  ON questions(group_id, question_no);

CREATE INDEX IF NOT EXISTS idx_options_question_order
  ON question_options(question_id, sort_order);
