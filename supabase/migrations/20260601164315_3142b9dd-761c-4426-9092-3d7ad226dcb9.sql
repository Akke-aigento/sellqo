UPDATE public.product_variants v
SET price = p.price,
    updated_at = now()
FROM public.products p
WHERE v.product_id = p.id
  AND p.tenant_id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988';