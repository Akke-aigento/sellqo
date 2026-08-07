CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  cover_image_url text,
  category text NOT NULL DEFAULT 'tips',
  author text NOT NULL DEFAULT 'SellQo',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  reading_minutes int,
  meta_title text,
  meta_description text,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx ON public.blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON public.blog_posts (category);

DROP TRIGGER IF EXISTS blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published posts"
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "Platform admins can read all posts"
  ON public.blog_posts FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert posts"
  ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update posts"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete posts"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));