CREATE TABLE IF NOT EXISTS vocabulary_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL COLLATE NOCASE,
  lemma TEXT,
  phonetic TEXT,
  part_of_speech TEXT,
  definition TEXT,
  translation TEXT,
  example_sentence TEXT,
  audio_url TEXT,
  level TEXT,
  source TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(word)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_words_level ON vocabulary_words(level);
CREATE INDEX IF NOT EXISTS idx_vocabulary_words_source ON vocabulary_words(source);

CREATE TABLE IF NOT EXISTS word_review_deck_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_code TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  frequency_score REAL,
  extra_data TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(deck_code, word_id),
  FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_word_review_deck_words_deck_order
  ON word_review_deck_words(deck_code, sort_order);
CREATE INDEX IF NOT EXISTS idx_word_review_deck_words_word_id
  ON word_review_deck_words(word_id);

CREATE TABLE IF NOT EXISTS user_wordbook_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  word_id INTEGER,
  word_text TEXT NOT NULL COLLATE NOCASE,
  phonetic TEXT,
  definition TEXT,
  translation TEXT,
  example_sentence TEXT,
  audio_url TEXT,
  source_question_id TEXT,
  source_question_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, word_text),
  FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_wordbook_entries_user_id
  ON user_wordbook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wordbook_entries_created_at
  ON user_wordbook_entries(created_at);

CREATE TABLE IF NOT EXISTS user_word_review_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  deck_code TEXT NOT NULL,
  current_position INTEGER NOT NULL DEFAULT 0,
  reviewed_count INTEGER NOT NULL DEFAULT 0,
  mastered_count INTEGER NOT NULL DEFAULT 0,
  total_count_snapshot INTEGER NOT NULL DEFAULT 0,
  last_word_id INTEGER,
  last_reviewed_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, deck_code),
  FOREIGN KEY (last_word_id) REFERENCES vocabulary_words(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_word_review_progress_user_id
  ON user_word_review_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_word_review_progress_last_reviewed_at
  ON user_word_review_progress(last_reviewed_at);

CREATE TABLE IF NOT EXISTS user_word_review_word_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  deck_code TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  last_result TEXT,
  last_reviewed_at INTEGER,
  next_review_at INTEGER,
  mastered_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, deck_code, word_id),
  FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_word_review_word_progress_user_deck_status
  ON user_word_review_word_progress(user_id, deck_code, status);
CREATE INDEX IF NOT EXISTS idx_user_word_review_word_progress_next_review_at
  ON user_word_review_word_progress(next_review_at);
