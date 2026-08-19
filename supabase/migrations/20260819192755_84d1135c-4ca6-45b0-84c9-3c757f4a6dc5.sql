UPDATE public.products
SET featured_image = CASE WHEN coalesce(array_length(images,1),0) > 0 THEN images[1] ELSE NULL END
WHERE featured_image IS NOT NULL
  AND NOT (featured_image = ANY(coalesce(images,'{}')));