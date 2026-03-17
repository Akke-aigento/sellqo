-- 1. Close all old open sessions except the most recent per terminal
WITH RankedSessions AS (
    SELECT
        id,
        terminal_id,
        ROW_NUMBER() OVER(PARTITION BY terminal_id ORDER BY opened_at DESC) as rn
    FROM pos_sessions
    WHERE status = 'open'
)
UPDATE pos_sessions
SET status = 'closed', closed_at = NOW(), notes = 'Automatisch gesloten (cleanup)'
WHERE id IN (SELECT id FROM RankedSessions WHERE rn > 1);

-- 2. Add partial unique index to prevent multiple open sessions per terminal
CREATE UNIQUE INDEX unique_open_pos_session_per_terminal
ON pos_sessions (terminal_id)
WHERE status = 'open';