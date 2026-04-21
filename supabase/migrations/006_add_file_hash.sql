-- Add file_hash column for duplicate detection
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for fast duplicate lookup
CREATE INDEX IF NOT EXISTS idx_receipts_file_hash ON receipts(user_id, file_hash);

-- Add comment
COMMENT ON COLUMN receipts.file_hash IS 'SHA256 hash of file content for duplicate detection';
