-- Add internal tenant flag to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_internal_tenant BOOLEAN DEFAULT false;

-- =====================
-- Support Tickets System
-- =====================
CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE support_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE support_ticket_category AS ENUM ('billing', 'technical', 'feature', 'bug', 'other');
CREATE TYPE support_sender_type AS ENUM ('merchant', 'support', 'system', 'ai');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  subject TEXT NOT NULL,
  status support_ticket_status NOT NULL DEFAULT 'open',
  priority support_ticket_priority NOT NULL DEFAULT 'medium',
  category support_ticket_category NOT NULL DEFAULT 'other',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type support_sender_type NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email TEXT,
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for support_tickets (platform admins only)
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all support tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- RLS for support_messages
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all support messages"
ON public.support_messages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
    AND public.is_platform_admin(auth.uid())
  )
);

-- =====================
-- Platform Changelogs
-- =====================
CREATE TYPE changelog_platform AS ENUM ('bol_com', 'amazon', 'stripe', 'ebay', 'shopify', 'woocommerce', 'meta', 'resend', 'other');
CREATE TYPE changelog_change_type AS ENUM ('breaking', 'feature', 'deprecation', 'security', 'bugfix', 'enhancement');
CREATE TYPE changelog_impact_level AS ENUM ('none', 'low', 'medium', 'high', 'critical');

CREATE TABLE public.platform_changelogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform changelog_platform NOT NULL,
  version TEXT,
  change_type changelog_change_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  impact_level changelog_impact_level NOT NULL DEFAULT 'low',
  affected_features TEXT[] DEFAULT '{}',
  source_url TEXT,
  deadline_date DATE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_required BOOLEAN DEFAULT false,
  action_taken TEXT,
  action_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_changelogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage changelogs"
ON public.platform_changelogs FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- =====================
-- Platform Health Metrics
-- =====================
CREATE TYPE health_status AS ENUM ('healthy', 'warning', 'critical', 'unknown');
CREATE TYPE health_component AS ENUM ('edge_function', 'sync', 'api', 'database', 'storage', 'auth', 'webhook');

CREATE TABLE public.platform_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  component health_component NOT NULL,
  current_value NUMERIC,
  threshold_warning NUMERIC,
  threshold_critical NUMERIC,
  status health_status NOT NULL DEFAULT 'unknown',
  details JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_metrics_recorded ON public.platform_health_metrics(recorded_at DESC);
CREATE INDEX idx_health_metrics_component ON public.platform_health_metrics(component);

ALTER TABLE public.platform_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view health metrics"
ON public.platform_health_metrics FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- =====================
-- Platform Incidents
-- =====================
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('detected', 'investigating', 'identified', 'monitoring', 'resolved');

CREATE TABLE public.platform_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL DEFAULT 'medium',
  status incident_status NOT NULL DEFAULT 'detected',
  affected_tenants UUID[] DEFAULT '{}',
  affected_components health_component[] DEFAULT '{}',
  root_cause TEXT,
  resolution TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  identified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  postmortem_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage incidents"
ON public.platform_incidents FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- =====================
-- SellQo Legal Pages
-- =====================
CREATE TABLE public.sellqo_legal_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  effective_date DATE,
  is_published BOOLEAN DEFAULT false,
  last_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read access for published legal pages
ALTER TABLE public.sellqo_legal_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published legal pages"
ON public.sellqo_legal_pages FOR SELECT
USING (is_published = true);

CREATE POLICY "Platform admins can manage legal pages"
ON public.sellqo_legal_pages FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- =====================
-- Platform Feedback RLS update
-- =====================
-- Allow platform admins to see all feedback
DROP POLICY IF EXISTS "Platform admins can view all feedback" ON public.app_feedback;
CREATE POLICY "Platform admins can view all feedback"
ON public.app_feedback FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- =====================
-- Updated_at triggers
-- =====================
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_changelogs_updated_at
  BEFORE UPDATE ON public.platform_changelogs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_incidents_updated_at
  BEFORE UPDATE ON public.platform_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sellqo_legal_pages_updated_at
  BEFORE UPDATE ON public.sellqo_legal_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- Insert default legal pages
-- =====================
INSERT INTO public.sellqo_legal_pages (page_type, slug, title, content, is_published, effective_date) VALUES
('terms', 'terms', 'Algemene Voorwaarden', '# Algemene Voorwaarden SellQo

*Versie 1.0 - Ingangsdatum: [datum]*

## Artikel 1 - Definities

**SellQo**: SellQo, gevestigd te [adres], ingeschreven bij de KvK onder nummer [nummer].

**Klant**: De natuurlijke persoon of rechtspersoon die een overeenkomst aangaat met SellQo.

**Platform**: De SellQo webapplicatie en alle bijbehorende diensten.

**Diensten**: Alle door SellQo aangeboden functionaliteiten inclusief maar niet beperkt tot orderverwerking, voorraad beheer, marketplace integraties, en e-commerce tools.

## Artikel 2 - Toepasselijkheid

2.1 Deze algemene voorwaarden zijn van toepassing op alle aanbiedingen, offertes en overeenkomsten tussen SellQo en de Klant.

2.2 Afwijkingen van deze voorwaarden zijn slechts geldig indien schriftelijk overeengekomen.

## Artikel 3 - Prijzen en Betaling

3.1 Alle prijzen zijn exclusief BTW tenzij anders vermeld.

3.2 **Prijsindexatie**: SellQo behoudt zich het recht voor om tarieven jaarlijks te indexeren conform de CBS consumentenprijsindex (CPI). Bestaande klanten worden minimaal 60 dagen vooraf schriftelijk geïnformeerd over eventuele prijswijzigingen.

3.3 Betaling geschiedt via automatische incasso of de door SellQo aangeboden betaalmethodes.

## Artikel 4 - Gebruik van het Platform

4.1 De Klant verkrijgt een niet-exclusief, niet-overdraagbaar gebruiksrecht op het Platform.

4.2 Het is niet toegestaan het Platform te gebruiken voor illegale activiteiten.

## Artikel 5 - Beschikbaarheid en SLA

5.1 SellQo streeft naar een uptime van 99,5% op maandbasis.

5.2 Gepland onderhoud wordt minimaal 24 uur van tevoren aangekondigd.

## Artikel 6 - Aansprakelijkheid

6.1 SellQo is niet aansprakelijk voor indirecte schade, waaronder gevolgschade, gederfde winst of gemiste besparingen.

6.2 De totale aansprakelijkheid van SellQo is beperkt tot het bedrag dat de Klant in de 12 maanden voorafgaand aan het schadeverwekkend feit aan SellQo heeft betaald.

## Artikel 7 - Data en Privacy

7.1 SellQo verwerkt persoonsgegevens conform de AVG en het Privacybeleid.

7.2 De Klant blijft eigenaar van alle ingevoerde data.

## Artikel 8 - Beëindiging

8.1 De overeenkomst kan door beide partijen worden opgezegd met inachtneming van een opzegtermijn van 30 dagen.

8.2 Bij beëindiging heeft de Klant 30 dagen om data te exporteren.

## Artikel 9 - Slotbepalingen

9.1 Op deze overeenkomst is Nederlands recht van toepassing.

9.2 Geschillen worden voorgelegd aan de bevoegde rechter te [plaats].

---

*Laatst bijgewerkt: [datum]*', false, CURRENT_DATE),

('privacy', 'privacy', 'Privacybeleid', '# Privacybeleid SellQo

*Versie 1.0 - Ingangsdatum: [datum]*

## 1. Wie zijn wij?

SellQo is verantwoordelijk voor de verwerking van persoonsgegevens zoals beschreven in dit privacybeleid.

**Contactgegevens:**
- Naam: SellQo
- Adres: [adres]
- E-mail: privacy@sellqo.ai

## 2. Welke persoonsgegevens verwerken wij?

### 2.1 Accountgegevens
- Naam en e-mailadres
- Bedrijfsnaam en KvK-nummer
- Factuuradres

### 2.2 Gebruiksgegevens
- Inloggegevens en sessie-informatie
- Platformgebruik en voorkeuren

### 2.3 Transactiegegevens
- Bestellingen en facturatiegegevens
- Betalingsinformatie (via Stripe)

## 3. Doeleinden van verwerking

Wij verwerken persoonsgegevens voor:
- Het leveren van onze diensten
- Facturatie en administratie
- Klantenservice en support
- Verbetering van het platform
- Wettelijke verplichtingen

## 4. Bewaartermijnen

- Accountgegevens: tot 2 jaar na beëindiging account
- Factuurgegevens: 7 jaar (wettelijke verplichting)
- Loggegevens: maximaal 12 maanden

## 5. Uw rechten

U heeft recht op:
- Inzage in uw persoonsgegevens
- Correctie van onjuiste gegevens
- Verwijdering van gegevens
- Beperking van verwerking
- Overdraagbaarheid van gegevens
- Bezwaar tegen verwerking

## 6. Beveiliging

Wij nemen passende technische en organisatorische maatregelen om uw gegevens te beschermen.

## 7. Contact

Voor vragen over dit privacybeleid kunt u contact opnemen via privacy@sellqo.ai.

---

*Laatst bijgewerkt: [datum]*', false, CURRENT_DATE),

('cookies', 'cookies', 'Cookiebeleid', '# Cookiebeleid SellQo

## Wat zijn cookies?

Cookies zijn kleine tekstbestanden die op uw apparaat worden opgeslagen wanneer u onze website bezoekt.

## Welke cookies gebruiken wij?

### Noodzakelijke cookies
Deze cookies zijn essentieel voor het functioneren van het platform:
- Sessiecookies voor inloggen
- Beveiligingscookies

### Analytische cookies
Met uw toestemming gebruiken wij analytische cookies om het gebruik van ons platform te analyseren.

### Functionele cookies
Deze cookies onthouden uw voorkeuren zoals taalinstelling.

## Cookiebeheer

U kunt cookies beheren via uw browserinstellingen. Het uitschakelen van noodzakelijke cookies kan de werking van het platform beïnvloeden.

---

*Laatst bijgewerkt: [datum]*', false, CURRENT_DATE),

('sla', 'sla', 'Service Level Agreement', '# Service Level Agreement (SLA)

## 1. Beschikbaarheid

### 1.1 Uptime garantie
SellQo garandeert een beschikbaarheid van 99,5% op maandbasis voor het Platform.

### 1.2 Uitgesloten van uptime berekening
- Gepland onderhoud (vooraf aangekondigd)
- Force majeure situaties
- Problemen bij derden (Bol.com, Amazon, etc.)

## 2. Support

### 2.1 Supportkanalen
- E-mail: support@sellqo.ai
- In-app chat tijdens kantooruren

### 2.2 Responstijden

| Prioriteit | Eerste reactie | Oplossing |
|------------|----------------|-----------|
| Kritiek | 4 uur | 24 uur |
| Hoog | 8 uur | 48 uur |
| Normaal | 24 uur | 5 werkdagen |
| Laag | 48 uur | Best effort |

## 3. Compensatie

Bij niet-nakoming van de uptime garantie:
- 99,0-99,5%: 10% korting op maandfactuur
- 98,0-99,0%: 25% korting op maandfactuur
- <98,0%: 50% korting op maandfactuur

---

*Laatst bijgewerkt: [datum]*', false, CURRENT_DATE),

('acceptable-use', 'acceptable-use', 'Acceptable Use Policy', '# Acceptable Use Policy

## 1. Toegestaan gebruik

Het SellQo platform mag uitsluitend worden gebruikt voor:
- Legitieme e-commerce activiteiten
- Beheer van orders en voorraad
- Integratie met toegestane marktplaatsen

## 2. Verboden gebruik

Het is niet toegestaan om:
- Illegale producten te verkopen
- Het platform te gebruiken voor frauduleuze activiteiten
- De beveiliging van het platform te omzeilen
- Overmatige serverbelasting te veroorzaken
- Intellectuele eigendomsrechten te schenden

## 3. Fair Use Limieten

Per plan gelden de volgende fair use limieten:
- **API calls**: Maximaal 1000 requests per minuut
- **Storage**: Conform uw abonnement
- **Transacties**: Conform uw abonnement

## 4. Handhaving

Bij overtreding van dit beleid kan SellQo:
- Een waarschuwing geven
- Functionaliteit beperken
- Het account opschorten of beëindigen

---

*Laatst bijgewerkt: [datum]*', false, CURRENT_DATE),

('dpa', 'dpa', 'Data Processing Agreement', '# Data Processing Agreement (Verwerkersovereenkomst)

## 1. Partijen

Deze verwerkersovereenkomst is van toepassing tussen:
- **Verwerkingsverantwoordelijke**: De Klant
- **Verwerker**: SellQo

## 2. Onderwerp

SellQo verwerkt persoonsgegevens namens de Klant in het kader van de dienstverlening.

## 3. Categorieën persoonsgegevens

- Klantgegevens (naam, adres, e-mail)
- Ordergegevens
- Betalingsgegevens (via sub-verwerker Stripe)

## 4. Beveiligingsmaatregelen

SellQo implementeert passende technische en organisatorische maatregelen:
- Versleuteling van data in transit en at rest
- Toegangscontrole en authenticatie
- Regelmatige beveiligingsaudits
- Incidentresponsprocedures

## 5. Sub-verwerkers

SellQo maakt gebruik van de volgende sub-verwerkers:
- Supabase (database en authenticatie)
- Stripe (betalingsverwerking)
- Resend (e-mailverzending)

## 6. Rechten betrokkenen

SellQo ondersteunt de Klant bij het uitvoeren van verzoeken van betrokkenen.

## 7. Datalekken

Bij een datalek informeert SellQo de Klant binnen 24 uur.

---

*Laatst bijgewerkt: [datum]*', false, CURRENT_DATE)

ON CONFLICT (page_type) DO NOTHING;