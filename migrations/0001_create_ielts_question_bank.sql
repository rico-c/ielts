-- IELTS question bank schema for Cloudflare D1 (SQLite)
-- Designed to store structured output from scripts/ielts.js

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ielts_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL,
  source_page_id INTEGER,
  title TEXT NOT NULL,
  scraped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_url)
);

CREATE TABLE IF NOT EXISTS ielts_test_audio_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES ielts_tests(id) ON DELETE CASCADE,
  UNIQUE(test_id, url)
);

CREATE TABLE IF NOT EXISTS ielts_test_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  part_no INTEGER,
  part_title TEXT NOT NULL,
  question_from INTEGER,
  question_to INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES ielts_tests(id) ON DELETE CASCADE,
  UNIQUE(test_id, part_title)
);

CREATE TABLE IF NOT EXISTS ielts_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  part_id INTEGER,
  question_no INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK (
    question_type IN ('single_choice', 'multiple_choice', 'fill_blank', 'matching', 'unknown')
  ),
  subtitle TEXT,
  instruction TEXT,
  prompt TEXT,
  answer TEXT,
  table_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES ielts_tests(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ielts_test_parts(id) ON DELETE SET NULL,
  UNIQUE(test_id, question_no)
);

CREATE TABLE IF NOT EXISTS ielts_question_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  option_label TEXT NOT NULL,
  option_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES ielts_questions(id) ON DELETE CASCADE,
  UNIQUE(question_id, option_label)
);

CREATE TABLE IF NOT EXISTS ielts_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  part_id INTEGER,
  table_ref TEXT NOT NULL,
  question_numbers_json TEXT NOT NULL,
  text_content TEXT,
  raw_html TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_id) REFERENCES ielts_tests(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ielts_test_parts(id) ON DELETE SET NULL,
  UNIQUE(test_id, table_ref)
);

CREATE TABLE IF NOT EXISTS ielts_table_cells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  tag TEXT NOT NULL,
  text_content TEXT,
  cell_html TEXT,
  colspan INTEGER NOT NULL DEFAULT 1,
  rowspan INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (table_id) REFERENCES ielts_tables(id) ON DELETE CASCADE,
  UNIQUE(table_id, row_index, col_index)
);

CREATE INDEX IF NOT EXISTS idx_ielts_audio_test_id ON ielts_test_audio_urls(test_id);
CREATE INDEX IF NOT EXISTS idx_ielts_parts_test_id ON ielts_test_parts(test_id);
CREATE INDEX IF NOT EXISTS idx_ielts_questions_test_id ON ielts_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_ielts_questions_part_id ON ielts_questions(part_id);
CREATE INDEX IF NOT EXISTS idx_ielts_questions_type ON ielts_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_ielts_options_question_id ON ielts_question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_ielts_tables_test_id ON ielts_tables(test_id);
CREATE INDEX IF NOT EXISTS idx_ielts_tables_part_id ON ielts_tables(part_id);
CREATE INDEX IF NOT EXISTS idx_ielts_cells_table_id ON ielts_table_cells(table_id);
