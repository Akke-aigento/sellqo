-- 1) Column + indexes
ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS shipping_class text DEFAULT NULL;

COMMENT ON COLUMN public.shipping_methods.shipping_class IS
  'NULL = universeel (geldt voor producten zonder klasse). Ingevuld = alleen voor producten met exact deze shipping_class in product_specifications.';

CREATE INDEX IF NOT EXISTS idx_shipping_methods_tenant_class
  ON public.shipping_methods (tenant_id, shipping_class);

CREATE INDEX IF NOT EXISTS idx_product_specifications_shipping_class
  ON public.product_specifications (product_id, shipping_class)
  WHERE shipping_class IS NOT NULL;

-- 2) Astra Sleep seed
UPDATE public.shipping_methods SET shipping_class = 'boxspring'
WHERE tenant_id = '169cf7b9-b22a-4a94-87d1-fb4b9cc948f9'
  AND name = 'Levering en montage boxspring';

INSERT INTO public.product_specifications (product_id, tenant_id, shipping_class)
SELECT p.id, p.tenant_id, 'boxspring'
FROM public.products p
WHERE p.tenant_id = '169cf7b9-b22a-4a94-87d1-fb4b9cc948f9'
  AND p.slug IN ('astra-sleep-boxspring-comfort','astra-sleep-boxspring-opberg')
ON CONFLICT (product_id) DO UPDATE
  SET shipping_class = EXCLUDED.shipping_class;

-- 3) Tenant doc article
INSERT INTO public.doc_articles (doc_level, slug, category_id, title, excerpt, content, context_path, tags, is_published)
VALUES (
  'tenant',
  'verzendklassen',
  'a0000001-0000-0000-0000-000000000004',
  'Verzendklassen: verzendmethodes koppelen aan specifieke producten',
  'Zorg dat grote of speciale producten alleen een passende verzendmethode aangeboden krijgen tijdens de checkout.',
  '<h2>Wat is een verzendklasse?</h2>'
  || '<p>Een verzendklasse is een label dat je koppelt aan zowel een product als een verzendmethode. Tijdens de checkout toont SellQo alleen de verzendmethodes waarvan de klasse past bij wat er in de winkelwagen ligt.</p>'
  || '<h2>Voorbeeld: boxsprings</h2>'
  || '<p>Stel je verkoopt matrassen (standaard pakketpost) én boxsprings (moeten met een vrachtwagen geleverd worden, met montage aan huis, €100). Zonder verzendklassen zou een klant bij een boxspring óók "Gratis verzending" te zien krijgen — wat onmogelijk is.</p>'
  || '<h3>Zo stel je het in</h3>'
  || '<ol>'
  || '<li>Ga naar <strong>Instellingen → Verzending</strong> en open de verzendmethode "Levering en montage boxspring". Vul bij <em>Verzendklasse</em> het woord <code>boxspring</code> in.</li>'
  || '<li>Open elk boxspring-product, ga naar <strong>Specificaties → Logistiek</strong> en vul bij <em>Verzendklasse</em> hetzelfde woord <code>boxspring</code> in.</li>'
  || '<li>Klaar. Een klant met alleen matrassen ziet enkel "Gratis verzending". Een klant met een boxspring (al dan niet samen met matrassen) ziet enkel de boxspring-levering van €100.</li>'
  || '</ol>'
  || '<h2>Belangrijk om te weten</h2>'
  || '<ul>'
  || '<li><strong>Leeg = universeel.</strong> Een verzendmethode zonder klasse geldt voor producten die óók geen klasse hebben. Zodra er een product met een klasse in de winkelwagen zit, verdwijnen universele methodes uit de keuze.</li>'
  || '<li><strong>Klassen zijn exacte match.</strong> Gebruik dezelfde spelling op product én methode. "Boxspring" en "boxspring" zijn niet hetzelfde.</li>'
  || '<li><strong>Vangnet.</strong> Vindt SellQo geen enkele geldige methode voor de winkelwagen? Dan tonen we alle methodes zodat de klant niet vastloopt. Controleer in dat geval je klasse-instellingen.</li>'
  || '</ul>'
  || '<p>Verzendklassen zijn beschikbaar vanaf het <strong>Starter</strong>-abonnement.</p>',
  '/admin/settings/shipping',
  ARRAY['verzending','verzendklasse','shipping','boxspring','checkout'],
  true
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    context_path = EXCLUDED.context_path,
    tags = EXCLUDED.tags,
    category_id = EXCLUDED.category_id,
    is_published = EXCLUDED.is_published,
    updated_at = now();