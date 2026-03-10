-- Add Cambridge IELTS metadata fields for easier filtering
-- Example: series='Cambridge IELTS', book_no=20, test_no=1, module='listening'

ALTER TABLE ielts_tests ADD COLUMN series TEXT DEFAULT '';
ALTER TABLE ielts_tests ADD COLUMN book_no INTEGER;
ALTER TABLE ielts_tests ADD COLUMN test_no INTEGER;
ALTER TABLE ielts_tests ADD COLUMN module TEXT DEFAULT '';
ALTER TABLE ielts_tests ADD COLUMN test_code TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ielts_tests_series_book_test_module
  ON ielts_tests(series, book_no, test_no, module);

CREATE INDEX IF NOT EXISTS idx_ielts_tests_test_code
  ON ielts_tests(test_code);
