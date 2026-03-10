-- Reading-oriented structural extensions:
-- 1) passage-level storage (IELTS Reading Passage 1/2/3)
-- 2) question-group storage (shared instruction/options across a range)
-- 3) question-level extension fields for subtype/group/passage mapping

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ielts_passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  part_id INTEGER,
  passage_no INTEGER NOT NULL,
  title TEXT,
  text_content TEXT,
  raw_html TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES ielts_tests(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ielts_test_parts(id) ON DELETE SET NULL,
  UNIQUE(test_id, passage_no)
);

CREATE TABLE IF NOT EXISTS ielts_question_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  part_id INTEGER,
  passage_no INTEGER,
  group_ref TEXT NOT NULL,
  heading TEXT,
  instruction TEXT,
  question_type TEXT NOT NULL DEFAULT 'unknown' CHECK (
    question_type IN ('single_choice', 'multiple_choice', 'fill_blank', 'matching', 'unknown')
  ),
  question_subtype TEXT DEFAULT '',
  question_from INTEGER,
  question_to INTEGER,
  shared_prompt TEXT,
  option_set_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES ielts_tests(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ielts_test_parts(id) ON DELETE SET NULL,
  UNIQUE(test_id, group_ref)
);

ALTER TABLE ielts_questions ADD COLUMN question_subtype TEXT DEFAULT '';
ALTER TABLE ielts_questions ADD COLUMN group_ref TEXT;
ALTER TABLE ielts_questions ADD COLUMN passage_no INTEGER;
ALTER TABLE ielts_questions ADD COLUMN question_meta_json TEXT DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ielts_passages_test_id ON ielts_passages(test_id);
CREATE INDEX IF NOT EXISTS idx_ielts_passages_part_id ON ielts_passages(part_id);
CREATE INDEX IF NOT EXISTS idx_ielts_question_groups_test_id ON ielts_question_groups(test_id);
CREATE INDEX IF NOT EXISTS idx_ielts_question_groups_part_id ON ielts_question_groups(part_id);
CREATE INDEX IF NOT EXISTS idx_ielts_questions_group_ref ON ielts_questions(test_id, group_ref);
CREATE INDEX IF NOT EXISTS idx_ielts_questions_passage_no ON ielts_questions(test_id, passage_no);
CREATE INDEX IF NOT EXISTS idx_ielts_questions_subtype ON ielts_questions(question_subtype);
