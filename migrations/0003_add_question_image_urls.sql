-- Store question-level image URLs extracted from HTML prompts
ALTER TABLE ielts_questions ADD COLUMN image_urls_json TEXT DEFAULT '[]';
