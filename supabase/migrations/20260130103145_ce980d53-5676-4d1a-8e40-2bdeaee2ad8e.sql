-- Rename the status column to message_status to avoid confusion with email delivery status
ALTER TABLE customer_messages RENAME COLUMN status TO delivery_status;

-- Add the message_status column for inbox management
ALTER TABLE customer_messages 
ADD COLUMN IF NOT EXISTS message_status TEXT DEFAULT 'active';

-- Set all existing messages to 'active' status
UPDATE customer_messages SET message_status = 'active' WHERE message_status IS NULL;

-- Update the index to use the new column name
DROP INDEX IF EXISTS idx_messages_status;
CREATE INDEX IF NOT EXISTS idx_messages_message_status ON customer_messages(tenant_id, message_status);