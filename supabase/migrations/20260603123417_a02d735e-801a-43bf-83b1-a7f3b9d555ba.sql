DROP POLICY IF EXISTS "Service role can manage config" ON public.ai_assistant_config;
DROP POLICY IF EXISTS "Service role can manage knowledge" ON public.ai_knowledge_index;
DROP POLICY IF EXISTS "Service role can manage all suggestions" ON public.ai_reply_suggestions;
DROP POLICY IF EXISTS "Service role can manage behavior" ON public.ai_user_behavior_log;
DROP POLICY IF EXISTS "Service role can manage patterns" ON public.ai_user_learning_patterns;
DROP POLICY IF EXISTS "Service role can manage all addons" ON public.tenant_addons;
DROP POLICY IF EXISTS "Service role only" ON public.oauth_states;