
-- ============================================
-- DOCUMENTATIE SYSTEEM: Tabellen, RLS, Seed Data
-- ============================================

-- doc_categories
CREATE TABLE public.doc_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_level TEXT NOT NULL CHECK (doc_level IN ('tenant', 'platform')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES public.doc_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_level, slug)
);

-- doc_articles
CREATE TABLE public.doc_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.doc_categories(id) ON DELETE CASCADE,
  doc_level TEXT NOT NULL CHECK (doc_level IN ('tenant', 'platform')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  tags TEXT[] DEFAULT '{}',
  context_path TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_level, slug)
);

-- Indexes
CREATE INDEX idx_doc_articles_category ON public.doc_articles(category_id);
CREATE INDEX idx_doc_articles_level ON public.doc_articles(doc_level);
CREATE INDEX idx_doc_articles_context ON public.doc_articles(context_path) WHERE context_path IS NOT NULL;
CREATE INDEX idx_doc_categories_level ON public.doc_categories(doc_level);

-- Triggers
CREATE TRIGGER update_doc_categories_updated_at BEFORE UPDATE ON public.doc_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doc_articles_updated_at BEFORE UPDATE ON public.doc_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.doc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_articles ENABLE ROW LEVEL SECURITY;

-- Tenant docs: leesbaar voor alle authenticated
CREATE POLICY "Anyone can read tenant doc categories"
  ON public.doc_categories FOR SELECT TO authenticated
  USING (doc_level = 'tenant');

CREATE POLICY "Anyone can read tenant doc articles"
  ON public.doc_articles FOR SELECT TO authenticated
  USING (doc_level = 'tenant' AND is_published = true);

-- Platform docs: alleen platform admins
CREATE POLICY "Platform admins can read platform doc categories"
  ON public.doc_categories FOR SELECT TO authenticated
  USING (doc_level = 'platform' AND public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can read platform doc articles"
  ON public.doc_articles FOR SELECT TO authenticated
  USING (doc_level = 'platform' AND public.is_platform_admin(auth.uid()));

-- Platform admins: ook drafts lezen
CREATE POLICY "Platform admins can read all tenant doc articles"
  ON public.doc_articles FOR SELECT TO authenticated
  USING (doc_level = 'tenant' AND public.is_platform_admin(auth.uid()));

-- Schrijfrechten: alleen platform admins
CREATE POLICY "Platform admins can insert doc categories"
  ON public.doc_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update doc categories"
  ON public.doc_categories FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete doc categories"
  ON public.doc_categories FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert doc articles"
  ON public.doc_articles FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update doc articles"
  ON public.doc_articles FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete doc articles"
  ON public.doc_articles FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ============================================
-- SEED DATA: Tenant Categorieën en Artikelen
-- ============================================

-- Tenant Categories
INSERT INTO public.doc_categories (id, doc_level, title, slug, description, icon, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'tenant', 'Producten', 'producten', 'Alles over productbeheer', 'Package', 1),
  ('a0000001-0000-0000-0000-000000000002', 'tenant', 'Bestellingen', 'bestellingen', 'Bestellingen verwerken en beheren', 'ShoppingCart', 2),
  ('a0000001-0000-0000-0000-000000000003', 'tenant', 'Betalingen', 'betalingen', 'Betaalmethoden en BTW', 'Banknote', 3),
  ('a0000001-0000-0000-0000-000000000004', 'tenant', 'Verzending', 'verzending', 'Verzendopties instellen', 'Truck', 4),
  ('a0000001-0000-0000-0000-000000000005', 'tenant', 'Promoties', 'promoties', 'Kortingscodes en acties', 'Percent', 5),
  ('a0000001-0000-0000-0000-000000000006', 'tenant', 'Webshop', 'webshop', 'Theme en domeinen', 'Globe', 6),
  ('a0000001-0000-0000-0000-000000000007', 'tenant', 'Communicatie', 'communicatie', 'Inbox en berichten', 'MessageSquare', 7),
  ('a0000001-0000-0000-0000-000000000008', 'tenant', 'FAQ', 'faq', 'Veelgestelde vragen', 'HelpCircle', 8);

-- Tenant Articles
INSERT INTO public.doc_articles (category_id, doc_level, title, slug, excerpt, content, context_path, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'tenant', 'Hoe voeg ik producten toe?', 'producten-toevoegen',
   'Leer hoe je nieuwe producten aanmaakt in je webshop.',
   '<h2>Producten toevoegen</h2><p>Ga naar <strong>Producten</strong> in het menu en klik op <strong>Nieuw product</strong>. Vul de titel, beschrijving, prijs en voorraad in. Upload productafbeeldingen en klik op <strong>Opslaan</strong>.</p><h3>Tips</h3><ul><li>Gebruik duidelijke productfoto''s op een witte achtergrond</li><li>Schrijf een beschrijving die de voordelen benadrukt</li><li>Stel de juiste categorie in voor betere vindbaarheid</li></ul>',
   '/admin/products', 1),
  ('a0000001-0000-0000-0000-000000000001', 'tenant', 'Varianten beheren', 'varianten-beheren',
   'Leer hoe je productvarianten zoals maat en kleur instelt.',
   '<h2>Varianten beheren</h2><p>Open een product en ga naar het tabblad <strong>Varianten</strong>. Hier kun je opties toevoegen zoals Maat of Kleur, en per combinatie de prijs, SKU en voorraad instellen.</p>',
   '/admin/products', 2),
  ('a0000001-0000-0000-0000-000000000002', 'tenant', 'Bestellingen verwerken', 'bestellingen-verwerken',
   'Stap-voor-stap uitleg over het verwerken van bestellingen.',
   '<h2>Bestellingen verwerken</h2><p>Nieuwe bestellingen verschijnen onder <strong>Bestellingen</strong>. Klik op een bestelling om de details te bekijken. Gebruik de status-knoppen om de bestelling te verwerken: bevestigen, verzenden, en voltooien.</p>',
   '/admin/orders', 1),
  ('a0000001-0000-0000-0000-000000000002', 'tenant', 'Retouren afhandelen', 'retouren-afhandelen',
   'Hoe je retouren en terugbetalingen verwerkt.',
   '<h2>Retouren afhandelen</h2><p>Open de bestelling en klik op <strong>Retour aanmaken</strong>. Selecteer de producten die worden teruggestuurd en kies of je een terugbetaling of tegoed wilt uitgeven.</p>',
   '/admin/orders', 2),
  ('a0000001-0000-0000-0000-000000000003', 'tenant', 'Betaalmethode koppelen', 'betaalmethode-koppelen',
   'Hoe je Stripe of andere betaalmethoden koppelt.',
   '<h2>Betaalmethode koppelen</h2><p>Ga naar <strong>Instellingen → Betalingen</strong> en volg de stappen om je Stripe-account te koppelen. Na het koppelen kunnen klanten direct online betalen.</p>',
   '/admin/settings', 1),
  ('a0000001-0000-0000-0000-000000000003', 'tenant', 'BTW instellen', 'btw-instellen',
   'Hoe je BTW-tarieven configureert.',
   '<h2>BTW instellen</h2><p>Ga naar <strong>Instellingen → BTW</strong>. Hier stel je je standaard BTW-tarief in en kun je afwijkende tarieven per productcategorie configureren.</p>',
   '/admin/settings', 2),
  ('a0000001-0000-0000-0000-000000000004', 'tenant', 'Verzendopties instellen', 'verzendopties-instellen',
   'Configureer verzendmethoden en tarieven.',
   '<h2>Verzendopties instellen</h2><p>Ga naar <strong>Verzending</strong> in het menu. Voeg verzendmethoden toe met naam, prijs en levertijd. Je kunt ook gratis verzending instellen boven een bepaald bedrag.</p>',
   '/admin/shipping', 1),
  ('a0000001-0000-0000-0000-000000000005', 'tenant', 'Kortingscodes aanmaken', 'kortingscodes-aanmaken',
   'Maak kortingscodes aan voor je klanten.',
   '<h2>Kortingscodes aanmaken</h2><p>Ga naar <strong>Promoties → Kortingscodes</strong> en klik op <strong>Nieuwe code</strong>. Stel het kortingspercentage of bedrag in, de geldigheidsperiode, en eventuele beperkingen.</p>',
   '/admin/promotions', 1),
  ('a0000001-0000-0000-0000-000000000006', 'tenant', 'Theme aanpassen', 'theme-aanpassen',
   'Pas het uiterlijk van je webshop aan.',
   '<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om je theme in te stellen. Kies kleuren, lettertypen, en pas de layout van je homepage aan met de visuele editor.</p>',
   '/admin/storefront', 1),
  ('a0000001-0000-0000-0000-000000000006', 'tenant', 'Domeinen instellen', 'domeinen-instellen',
   'Koppel een eigen domeinnaam aan je webshop.',
   '<h2>Domeinen instellen</h2><p>Ga naar <strong>Instellingen → Domeinen</strong>. Voeg je domeinnaam toe en volg de DNS-instructies om de koppeling te voltooien.</p>',
   '/admin/settings', 2),
  ('a0000001-0000-0000-0000-000000000007', 'tenant', 'Inbox gebruiken', 'inbox-gebruiken',
   'Beheer al je klantcommunicatie vanuit één plek.',
   '<h2>Inbox gebruiken</h2><p>De <strong>Gesprekken</strong> inbox bundelt e-mail, WhatsApp en andere kanalen. Klik op een gesprek om te antwoorden. Gebruik labels om gesprekken te organiseren.</p>',
   '/admin/messages', 1),
  ('a0000001-0000-0000-0000-000000000008', 'tenant', 'Veelgestelde vragen', 'veelgestelde-vragen',
   'Antwoorden op de meest gestelde vragen.',
   '<h2>Veelgestelde vragen</h2><h3>Hoe wijzig ik mijn wachtwoord?</h3><p>Ga naar je profielinstellingen rechtsboven en klik op <strong>Wachtwoord wijzigen</strong>.</p><h3>Kan ik meerdere winkels beheren?</h3><p>Ja, neem contact op met support om extra winkels toe te voegen aan je account.</p><h3>Hoe exporteer ik mijn bestellingen?</h3><p>Ga naar Bestellingen en klik op de <strong>Exporteren</strong> knop rechtsboven.</p>',
   NULL, 1);

-- ============================================
-- SEED DATA: Platform Categorieën en Artikelen
-- ============================================

INSERT INTO public.doc_categories (id, doc_level, title, slug, description, icon, sort_order) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'platform', 'Storefront API Referentie', 'storefront-api', 'API endpoints en authenticatie', 'Code', 1),
  ('b0000001-0000-0000-0000-000000000002', 'platform', 'Custom Frontend Gids', 'custom-frontend', 'Startersgids voor custom storefronts', 'BookOpen', 2),
  ('b0000001-0000-0000-0000-000000000003', 'platform', 'Domein & Deployment', 'domein-deployment', 'DNS en SSL configuratie', 'Server', 3),
  ('b0000001-0000-0000-0000-000000000004', 'platform', 'Troubleshooting', 'troubleshooting', 'Debugging en veelvoorkomende problemen', 'Bug', 4);

INSERT INTO public.doc_articles (category_id, doc_level, title, slug, excerpt, content, sort_order) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'platform', 'Endpoints overzicht', 'endpoints-overzicht',
   'Alle beschikbare Storefront API endpoints.',
   '<h2>Storefront API Endpoints</h2><p>De Storefront API is beschikbaar als een edge function op <code>/functions/v1/storefront-api</code>.</p><h3>Producten</h3><ul><li><code>GET /products</code> — Productlijst met filters</li><li><code>GET /products/:slug</code> — Product detail</li></ul><h3>Categorieën</h3><ul><li><code>GET /categories</code> — Categorieboom</li></ul><h3>Winkelwagen</h3><ul><li><code>POST /cart</code> — Cart aanmaken</li><li><code>PUT /cart/:id</code> — Cart updaten</li></ul><h3>Checkout</h3><ul><li><code>POST /checkout</code> — Checkout starten</li></ul>', 1),
  ('b0000001-0000-0000-0000-000000000001', 'platform', 'Authenticatie', 'authenticatie',
   'Hoe authenticatie werkt met de Storefront API.',
   '<h2>Authenticatie</h2><p>Alle requests vereisen een <code>x-tenant-id</code> header met de UUID van de tenant. Klant-authenticatie gebruikt JWT tokens via de standaard auth flow.</p><h3>Headers</h3><pre><code>x-tenant-id: uuid\nAuthorization: Bearer &lt;jwt&gt; (optioneel, voor klant-specifieke data)</code></pre>', 2),
  ('b0000001-0000-0000-0000-000000000001', 'platform', 'Error codes', 'error-codes',
   'Overzicht van API error codes en hun betekenis.',
   '<h2>Error Codes</h2><table><thead><tr><th>Code</th><th>Betekenis</th></tr></thead><tbody><tr><td>400</td><td>Ongeldige request parameters</td></tr><tr><td>401</td><td>Niet geauthenticeerd</td></tr><tr><td>403</td><td>Geen toegang</td></tr><tr><td>404</td><td>Resource niet gevonden</td></tr><tr><td>429</td><td>Rate limit bereikt</td></tr><tr><td>500</td><td>Server error</td></tr></tbody></table>', 3),
  ('b0000001-0000-0000-0000-000000000002', 'platform', 'Startersgids', 'startersgids',
   'Stap-voor-stap een custom storefront opzetten.',
   '<h2>Custom Storefront Startersgids</h2><p>Volg deze stappen om een nieuw Lovable project op te zetten als custom storefront voor een SellQo tenant.</p><h3>Stap 1: Project aanmaken</h3><p>Maak een nieuw Lovable project aan.</p><h3>Stap 2: API configuratie</h3><p>Stel de Storefront API URL en Tenant ID in als environment variables.</p><h3>Stap 3: Basis routing</h3><p>Maak routes aan voor: homepage, productlijst, productdetail, winkelwagen, checkout.</p>', 1),
  ('b0000001-0000-0000-0000-000000000002', 'platform', 'Eerste Lovable prompt', 'eerste-lovable-prompt',
   'De optimale eerste prompt voor een custom storefront project.',
   '<h2>Eerste Lovable Prompt</h2><p>Gebruik deze prompt als startpunt voor je custom storefront project:</p><pre><code>Bouw een moderne webshop als React SPA die verbindt met de SellQo Storefront API. De API base URL is [URL] en de tenant ID is [UUID]. Implementeer: productoverzicht met filters, productdetailpagina, winkelwagen met localStorage, en een checkout flow die redirect naar Stripe.</code></pre>', 2),
  ('b0000001-0000-0000-0000-000000000002', 'platform', 'Checkout flow', 'checkout-flow',
   'Hoe de checkout flow werkt met Stripe.',
   '<h2>Checkout Flow</h2><p>De checkout flow bestaat uit drie stappen:</p><ol><li><strong>Cart validatie</strong>: POST naar <code>/checkout/validate</code></li><li><strong>Stripe session</strong>: POST naar <code>/checkout/create-session</code></li><li><strong>Redirect</strong>: Stuur de klant naar de Stripe Checkout URL</li></ol>', 3),
  ('b0000001-0000-0000-0000-000000000003', 'platform', 'DNS configuratie', 'dns-configuratie',
   'Hoe je DNS instelt voor een custom storefront.',
   '<h2>DNS Configuratie</h2><p>Voeg een CNAME record toe dat wijst naar het Lovable deploy domein. Voor apex domeinen gebruik je een ALIAS of ANAME record.</p><h3>Voorbeeld</h3><pre><code>shop.example.com  CNAME  project-slug.lovable.app</code></pre>', 1),
  ('b0000001-0000-0000-0000-000000000003', 'platform', 'SSL setup', 'ssl-setup',
   'SSL certificaten worden automatisch geregeld.',
   '<h2>SSL Setup</h2><p>SSL certificaten worden automatisch aangemaakt via Let''s Encrypt zodra het DNS correct is geconfigureerd. Dit duurt meestal 5-10 minuten na DNS propagatie.</p>', 2),
  ('b0000001-0000-0000-0000-000000000004', 'platform', 'API debugging', 'api-debugging',
   'Tips voor het debuggen van API problemen.',
   '<h2>API Debugging</h2><h3>Veelvoorkomende problemen</h3><ul><li><strong>404 op producten</strong>: Controleer of de tenant_id correct is en of producten gepubliceerd zijn</li><li><strong>CORS errors</strong>: Voeg het domein toe aan de allowed origins in de tenant instellingen</li><li><strong>Lege responses</strong>: Check of de locale header correct is ingesteld</li></ul>', 1),
  ('b0000001-0000-0000-0000-000000000004', 'platform', 'Checkout testen', 'checkout-testen',
   'Hoe je de checkout flow test in development.',
   '<h2>Checkout Testen</h2><p>Gebruik Stripe''s test modus met de volgende testkaart:</p><pre><code>Kaartnummer: 4242 4242 4242 4242\nVervaldatum: 12/34\nCVC: 123</code></pre><p>Zorg dat de tenant''s Stripe account in test modus staat.</p>', 2);
