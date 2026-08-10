UPDATE public.blog_posts
SET status = 'published',
    published_at = COALESCE(published_at, now()),
    reading_minutes = COALESCE(
      reading_minutes,
      GREATEST(1, CEIL(array_length(regexp_split_to_array(regexp_replace(COALESCE(content,''), '<[^>]*>', ' ', 'g'), '\s+'), 1) / 200.0))::int
    )
WHERE status = 'draft';