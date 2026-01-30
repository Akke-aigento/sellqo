-- Step 1: Change conversation_id from UUID to TEXT
ALTER TABLE public.ai_reply_suggestions 
ALTER COLUMN conversation_id TYPE text USING conversation_id::text;

-- Step 2: Drop the old unique constraint (if exists)
ALTER TABLE public.ai_reply_suggestions 
DROP CONSTRAINT IF EXISTS unique_suggestion_per_message;

-- Step 3: Add new unique constraint on (tenant_id, message_id)
ALTER TABLE public.ai_reply_suggestions 
ADD CONSTRAINT unique_suggestion_per_message UNIQUE (tenant_id, message_id);

-- Step 4: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_reply_suggestions_tenant_message 
ON public.ai_reply_suggestions(tenant_id, message_id);

-- Step 5: Optional index on conversation_id for debugging/filtering
CREATE INDEX IF NOT EXISTS idx_ai_reply_suggestions_conversation 
ON public.ai_reply_suggestions(tenant_id, conversation_id);