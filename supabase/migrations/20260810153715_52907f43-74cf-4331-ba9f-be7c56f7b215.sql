UPDATE public.blog_posts
SET cover_image_url = 'https://gczmfcabnoofnmfpzeop.supabase.co/storage/v1/object/public/marketing-assets/blog/' || slug || '/cover.png',
    updated_at = now()
WHERE cover_image_url IS NULL
  AND slug IN (
    'btw-in-de-checkout-klopt-met-je-factuur',
    'verkoopkanalen-zichtbaar-in-je-boekhouding',
    'meerdere-fotos-per-variant',
    'shop-health-score',
    'bol-com-vvb-labels-vanuit-sellqo',
    'verzendlanden-per-verzendmethode',
    'je-voorraad-klopt-op-elke-datum',
    'verzendklassen-de-juiste-verzendmethode'
  );