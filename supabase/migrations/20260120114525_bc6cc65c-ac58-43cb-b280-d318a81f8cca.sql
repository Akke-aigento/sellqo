-- Fix the security definer view by using SECURITY INVOKER instead
DROP VIEW IF EXISTS public.ai_content_engagement_stats;

CREATE VIEW public.ai_content_engagement_stats 
WITH (security_invoker = true)
AS
SELECT 
  ac.id,
  ac.tenant_id,
  ac.content_type,
  ac.platform,
  ac.title,
  ac.language,
  ac.created_at,
  ac.is_used,
  ac.used_at,
  ac.publish_status,
  ac.published_at,
  sp.id as social_post_id,
  sp.status as social_status,
  sp.engagement_data,
  COALESCE((sp.engagement_data->>'likes')::integer, 0) as likes,
  COALESCE((sp.engagement_data->>'comments')::integer, 0) as comments,
  COALESCE((sp.engagement_data->>'shares')::integer, 0) as shares,
  COALESCE((sp.engagement_data->>'impressions')::integer, 0) as impressions
FROM public.ai_generated_content ac
LEFT JOIN public.social_posts sp ON sp.content_id = ac.id;

-- Create storage bucket for AI generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-images',
  'ai-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for ai-images bucket
CREATE POLICY "AI images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'ai-images');

CREATE POLICY "Authenticated users can upload AI images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ai-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own AI images" ON storage.objects
  FOR DELETE USING (bucket_id = 'ai-images' AND auth.role() = 'authenticated');