-- Migration: Security Enhancements
-- Date: 2024-12-19
-- Description: Adds transaction signatures and webhook idempotency

-- =============================================================================
-- 1. Transaction Signature Column
-- =============================================================================
-- SECURITY: Cryptographic signature to detect transaction tampering
-- Each transaction is signed at creation with HMAC-SHA256
-- The signature covers: id, type, amount, accounts, tracking_key, created_at

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT NULL;

COMMENT ON COLUMN transactions.signature IS 'HMAC-SHA256 signature of critical transaction fields for tamper detection';

-- Create index for transactions that need signature verification
CREATE INDEX IF NOT EXISTS idx_transactions_signature_check
ON transactions (id, signature)
WHERE signature IS NOT NULL;

-- =============================================================================
-- 2. Webhook Idempotency Table
-- =============================================================================
-- SECURITY: Prevents duplicate webhook processing (replay attacks)
-- Each webhook has a unique identifier (tracking_key + type)
-- We store processed webhooks for 30 days

CREATE TABLE IF NOT EXISTS processed_webhooks (
    id TEXT PRIMARY KEY,
    webhook_type TEXT NOT NULL CHECK (webhook_type IN ('deposit', 'order-status', 'cash')),
    tracking_key TEXT NOT NULL,
    opm_order_id TEXT,
    received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    source_ip TEXT,
    payload_hash TEXT NOT NULL,
    result TEXT CHECK (result IN ('success', 'failed', 'duplicate')),
    UNIQUE (webhook_type, tracking_key)
);

COMMENT ON TABLE processed_webhooks IS 'Idempotency table to prevent duplicate webhook processing';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_lookup
ON processed_webhooks (webhook_type, tracking_key);

-- Index for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_received
ON processed_webhooks (received_at);

-- =============================================================================
-- 3. Transaction State Transition Log
-- =============================================================================
-- SECURITY: Immutable audit log of all state changes
-- Ensures valid state transitions and provides forensic trail

CREATE TABLE IF NOT EXISTS transaction_state_log (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    changed_by TEXT, -- user_id if manual, 'system' if automatic
    change_source TEXT NOT NULL CHECK (change_source IN ('api', 'webhook', 'cron', 'manual')),
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE transaction_state_log IS 'Immutable log of all transaction state transitions';

-- Index for transaction history lookups
CREATE INDEX IF NOT EXISTS idx_state_log_transaction
ON transaction_state_log (transaction_id, changed_at DESC);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_state_log_status
ON transaction_state_log (new_status, changed_at DESC);

-- =============================================================================
-- 4. Valid State Transitions Function
-- =============================================================================
-- Define valid state transitions to prevent invalid status changes

CREATE OR REPLACE FUNCTION is_valid_state_transition(
    p_current_status TEXT,
    p_new_status TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Same status is always valid (idempotent)
    IF p_current_status = p_new_status THEN
        RETURN TRUE;
    END IF;

    -- Define valid transitions
    RETURN CASE p_current_status
        -- From pending_confirmation (during grace period)
        WHEN 'pending_confirmation' THEN
            p_new_status IN ('canceled', 'pending', 'sent', 'failed')
        -- From pending (after grace period, waiting to send)
        WHEN 'pending' THEN
            p_new_status IN ('sent', 'failed', 'canceled')
        -- From sent (waiting for OPM confirmation)
        WHEN 'sent' THEN
            p_new_status IN ('scattered', 'returned', 'failed')
        -- From queued (in OPM queue)
        WHEN 'queued' THEN
            p_new_status IN ('sent', 'scattered', 'failed', 'canceled')
        -- From scattered (completed successfully)
        WHEN 'scattered' THEN
            p_new_status IN ('returned') -- Only refund is valid from completed
        -- Terminal states (no transitions allowed)
        WHEN 'canceled' THEN FALSE
        WHEN 'returned' THEN FALSE
        WHEN 'failed' THEN
            p_new_status IN ('pending') -- Allow retry
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_valid_state_transition IS 'Validates transaction state machine transitions';

-- =============================================================================
-- 5. Cleanup function for old webhook records
-- =============================================================================
-- Run this periodically to clean up old idempotency records

CREATE OR REPLACE FUNCTION cleanup_old_webhooks(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM processed_webhooks
    WHERE received_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_webhooks IS 'Removes webhook idempotency records older than retention period';

-- =============================================================================
-- Verification
-- =============================================================================
SELECT
    'transactions.signature' as column_added,
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'signature'
    ) as exists;

SELECT
    'processed_webhooks table' as table_created,
    EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'processed_webhooks'
    ) as exists;

SELECT
    'transaction_state_log table' as table_created,
    EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'transaction_state_log'
    ) as exists;
