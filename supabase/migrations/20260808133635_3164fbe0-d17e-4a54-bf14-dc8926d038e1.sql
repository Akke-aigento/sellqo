INSERT INTO public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, tags, is_published, sort_order)
VALUES (
  'platform',
  'publieke-security-compliance-sectie',
  'Publieke Security & Compliance sectie beheren',
  'Waar de publieke /security sectie leeft, hoe je een policy bijwerkt en waar de PDF-versies horen.',
  '<h2>Waar staat het?</h2><p>De publieke Security &amp; Compliance sectie is bereikbaar op <strong>/security</strong> (overzicht) en <strong>/security/&lt;slug&gt;</strong> (detailpagina per policy). De routes staan in <code>src/App.tsx</code> in het blok "Public Pages", naast <code>/about</code> en <code>/contact</code>. De pagina-componenten staan in <code>src/pages/public/security/</code>: <code>SecurityOverview.tsx</code> en <code>SecurityPolicyPage.tsx</code>. Beide gebruiken <code>PublicPageLayout</code> en <code>PageMeta</code>, dus header, footer en SEO volgen automatisch het bestaande publieke patroon. In de footer staat een link "Security" bij de legal-links.</p><h2>Een policy bijwerken</h2><p>Alle policy-teksten staan als constante content-map in <code>src/data/securityPolicies.ts</code>. Per policy: <code>slug</code>, <code>title</code>, <code>icon</code> (lucide), <code>summary</code> (gebruikt op de overzichtskaart en als meta-description), <code>version</code>, <code>effectiveDate</code> en <code>markdown</code>. De markdown wordt gerenderd met <code>react-markdown</code> binnen prose-styling.</p><ul><li>Tekst wijzigen: pas het <code>markdown</code>-veld aan.</li><li>Nieuwe versie: verhoog <code>version</code> en pas <code>effectiveDate</code> aan (of de gedeelde constanten <code>SECURITY_POLICY_VERSION</code> / <code>SECURITY_POLICY_EFFECTIVE_DATE</code> als alle policies mee gaan).</li><li>Nieuwe policy toevoegen: voeg een object toe aan <code>securityPolicies</code>; de route <code>/security/:slug</code> en de overzichtskaart werken dan automatisch.</li><li>Wijzig een bestaande <code>slug</code> niet — die staat in externe links en in de PDF-bestandsnaam.</li></ul><h2>PDF-versies</h2><p>Elke detailpagina heeft een "Download PDF"-knop die verwijst naar de storage-bucket <strong>marketing-assets</strong>, map <strong>security/</strong>, met bestandsnaam <code>&lt;slug&gt;.pdf</code>. De PDF''s worden los geüpload; ontbreekt er een, dan is de knop simpelweg een dode link (er is bewust geen bestandscheck). Werk je een policy-tekst bij, upload dan ook een nieuwe PDF met dezelfde bestandsnaam zodat tekst en PDF gelijk blijven.</p><h2>Niet aanraken</h2><p>Deze sectie is volledig additief en staat los van de bestaande legal-structuur (<code>sellqo_legal_pages</code>, /privacy, /terms, /cookies, /dpa, /sla), van de storefront-routing en van tenant-domeinen.</p>',
  '/security',
  'b0000001-0000-0000-0000-000000000003',
  ARRAY['security','compliance','policies','pdf','publieke pagina'],
  true,
  50
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    context_path = EXCLUDED.context_path,
    category_id = EXCLUDED.category_id,
    tags = EXCLUDED.tags,
    is_published = EXCLUDED.is_published,
    updated_at = now();