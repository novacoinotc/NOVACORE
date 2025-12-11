-- Migration: Add grace period support for SPEI transfers
-- Date: 2024-12-10
-- Description: Adds confirmation_deadline column to support 20-second grace period before transfer confirmation

-- Add confirmation_deadline column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ DEFAULT NULL;

-- Add pending_order_data column to store the full OPM order request
-- This is used to defer the OPM API call until after the grace period
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS pending_order_data JSONB DEFAULT NULL;

-- Create index for efficient querying of pending confirmations
CREATE INDEX IF NOT EXISTS idx_transactions_pending_confirmation
ON transactions (status, confirmation_deadline)
WHERE status = 'pending_confirmation';

-- Comment on the new columns
COMMENT ON COLUMN transactions.confirmation_deadline IS 'Deadline for the 20-second grace period. After this time, transaction is auto-confirmed.';
COMMENT ON COLUMN transactions.pending_order_data IS 'Full OPM order request data, stored to send after grace period expires.';

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name IN ('confirmation_deadline', 'pending_order_data');
