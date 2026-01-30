-- Add auto_generate toggle for AI reply suggestions
-- When false, suggestions are only generated when user clicks the AI button (saves credits)
ALTER TABLE public.ai_assistant_config 
ADD COLUMN IF NOT EXISTS reply_suggestions_auto_generate boolean DEFAULT false;