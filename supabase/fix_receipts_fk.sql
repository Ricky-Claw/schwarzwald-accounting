-- Fix: Remove foreign key constraint on receipts.user_id
-- The hardcoded API user doesn't exist in auth.users

-- Remove the foreign key constraint
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_user_id_fkey;

-- Make user_id nullable (optional but safer)
ALTER TABLE receipts ALTER COLUMN user_id DROP NOT NULL;

-- Verify
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'receipts' AND tc.constraint_type = 'FOREIGN KEY';
