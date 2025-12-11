-- Migration: Add grace period support for SPEI transfers
-- Date: 2024-12-10
-- Description: Adds confirmation_deadline column to support 20-second grace period before transfer confirmation

-- Add confirmation_deadline column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient querying of pending confirmations
CREATE INDEX IF NOT EXISTS idx_transactions_pending_confirmation
ON transactions (status, confirmation_deadline)
WHERE status = 'pending_confirmation';

-- Comment on the new column
COMMENT ON COLUMN transactions.confirmation_deadline IS 'Deadline for the 20-second grace period. After this time, transaction is auto-confirmed.';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'confirmation_deadline';
