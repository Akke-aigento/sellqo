# BLOG-1 — Publiek blogsysteem voor SellQo

Doel: echte, SEO-vindbare blogartikelen op sellqo.app, 4-talig, semi-automatische workflow (concept → review door Akke → published). Platform-admin beheert; tenants raken dit niet.

## 1. Tabel `blog_posts`

```sql
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,                 -- rijke HTML: h2/h3, p, ul/ol, <img>, blockquote
  cover_image_url text,                  -- public URL uit bucket marketing-assets
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

CREATE INDEX blog_posts_status_published_idx ON public.blog_posts (status, published_at DESC);
CREATE INDEX blog_posts_category_idx ON public.blog_posts (category);

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

`translations` per taal (nl is de basiskolom, en/fr/de in jsonb):
```json
{ "en": { "title": "...", "excerpt": "...", "content": "<p>...</p>", "meta_title": "...", "meta_description": "..." } }
```
Fallback in de UI: `translations[lang]?.field ?? kolomwaarde` (zelfde patroon als changelog/legal).

### Advies: categorieën als CHECK of conventie?
**Conventie, geen CHECK** — met een frontend-constant `BLOG_CATEGORIES` als bron van waarheid. Reden: een CHECK op categorie betekent een migratie voor elke nieuwe rubriek, terwijl de labels toch al in i18n moeten staan. Onbekende categorie valt in de UI terug op een neutrale badge. (Op `status` blijft de CHECK wél staan — daar hangt RLS/zichtbaarheid aan.)

Labels (i18n `public.blog.categories.*`):

| key | nl | en | fr | de |
|---|---|---|---|---|
| product-updates | Product-updates | Product updates | Nouveautés produit | Produkt-Updates |
| boekhouding | Boekhouding | Accounting | Comptabilité | Buchhaltung |
| tips | Tips & tricks | Tips & tricks | Astuces | Tipps & Tricks |
| bedrijfsnieuws | Bedrijfsnieuws | Company news | Actualités | Unternehmensnews |

## 2. RLS

```sql
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Publiek: alleen gepubliceerd
CREATE POLICY "Public can read published posts"
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

-- Platform admin: alles zien (incl. drafts, voor preview + beheer)
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
```

Twee losse SELECT-policies (OR-semantiek) i.p.v. één samengestelde: de publieke policy blijft leesbaar en apart auditeerbaar. Drafts zijn dus voor anon fysiek onzichtbaar — de 404 op `/blog/:slug` volgt automatisch uit een leeg queryresultaat, niet uit frontend-logica.

## 3. Publieke routes

- `/blog` — bestaande route, `src/pages/public/Blog.tsx` wordt herschreven: grid van published posts (cover, categorie-badge, titel, excerpt, leestijd, datum), sortering `published_at desc`, optionele categorie-filter-chips, bestaande lege staat blijft als er 0 posts zijn.
- `/blog/:slug` — nieuw, `src/pages/public/BlogPost.tsx`: cover, categorie + datum + leestijd, `<h1>` titel, rijke content, "← Terug naar blog", onderaan CTA naar `/changelog`. Onbekende/niet-gepubliceerde slug → `NotFound`-weergave (geen redirect, zodat de URL blijft staan).
- Draft-preview: platform-admin ziet het artikel met een oranje **CONCEPT**-badge bovenaan; de query is identiek — RLS bepaalt wie iets terugkrijgt. `<PageMeta>` zet bij een draft `noindex`.

SEO per artikel: `PageMeta` met `meta_title ?? title`, `meta_description ?? excerpt`, `path=/blog/:slug`, `type="article"`, plus `og:image` = `cover_image_url` (PageMeta wordt hiervoor uitgebreid met een optionele `image`-prop) en Article JSON-LD (headline, image, datePublished, dateModified, author, publisher) via een nieuwe `generateArticleJsonLd` in `src/lib/structuredData.ts`.

Rijke HTML rendert via `dangerouslySetInnerHTML` binnen een `prose`-wrapper. **Risico + mitigatie:** alleen platform-admins kunnen content schrijven, dus dit is geen user-generated input; we saneren met `sanitize-html`/DOMPurify vóór rendering zodat een fout in een geïmporteerd artikel geen script kan uitvoeren.

## 4. Lichte platform-admin

- Nieuwe pagina `src/pages/platform/PlatformBlog.tsx`, route `/admin/platform/blog` achter `<ProtectedRoute requirePlatformAdmin>`.
- Sidebar-item in `platformItems` (`sidebarConfig.ts`): `platform-blog`, titel "Blog", tussen Changelog en Health.
- Inhoud: tabel van alle posts (titel, categorie, status-badge, datum, leestijd) met per rij: publiceer/depubliceer-toggle (zet/wist `published_at`), preview-link naar `/blog/:slug`, inline edit-dialog voor titel/excerpt/categorie/cover/meta, en verwijderen met bevestiging. Mobiel: kaartweergave onder 900px conform de admin-designstandaard.
- Geen WYSIWYG. `content` wordt door jou via SQL/connector ingeschoten; de admin dient om te reviewen en te publiceren.

## 5. Sitemap-integratie — advies

Bevinding: `supabase/functions/generate-sitemap` bestaat, maar die is **tenant-storefront**-scoped (producten/categorieën per tenant, output als JSON-string) — niet bruikbaar voor sellqo.app. De publieke site gebruikt het statische `public/sitemap.xml` (5 handmatige entries) en `robots.txt` verwijst daarnaar.

Advies: `public/sitemap.xml` **niet** vervangen door een runtime-mechanisme (SPA op static hosting kan geen dynamische `/sitemap.xml` serveren). In plaats daarvan een build-time generator, conform het Lovable-patroon:

- `scripts/generate-sitemap.ts` met de statische routes + een fetch van published slugs uit `blog_posts` via de anon key (publieke SELECT-policy volstaat), `lastmod` = `updated_at` van de post (page-specifiek, dus legitiem; geen build-datum-fallback voor de statische routes).
- Wired via `predev`/`prebuild` in `package.json`, output blijft `public/sitemap.xml`.
- Gevolg: nieuwe artikelen komen in de sitemap bij de volgende publish. Dat is voor SEO ruim voldoende; alternatief is een `/blog-sitemap.xml` edge function die we in `robots.txt` als tweede `Sitemap:`-regel opnemen — zeg het als je liever direct-live wil.

## Bestanden

Nieuw:
- migratie: `blog_posts` + GRANTs + RLS + indexen + updated_at-trigger
- `src/pages/public/BlogPost.tsx`
- `src/pages/platform/PlatformBlog.tsx`
- `src/hooks/useBlogPosts.ts` (publieke lijst + detail, en admin-variant met drafts)
- `src/lib/blogCategories.ts` (`BLOG_CATEGORIES` + i18n-keys)
- `scripts/generate-sitemap.ts`

Gewijzigd:
- `src/pages/public/Blog.tsx` (placeholder → echte lijst)
- `src/App.tsx` (`/blog/:slug` + `/admin/platform/blog`)
- `src/components/admin/sidebar/sidebarConfig.ts` (platform-item)
- `src/components/seo/PageMeta.tsx` (optionele `image` + `noindex`)
- `src/lib/structuredData.ts` (`generateArticleJsonLd`)
- `src/i18n/locales/landing.{nl,en,fr,de}.json` (blog-keys)
- `package.json` (predev/prebuild), `public/sitemap.xml` (gegenereerd)

Slottaken volgens Projectregel: role-audit entry (waarom conventie i.p.v. CHECK op categorie, waarom twee SELECT-policies, waarom HTML-sanitatie), changelog-entry `2026.09c` type `feature` in 4 talen. Geen doc_articles: de blog is publiek, geen tenant-admin-functie.

## Open vragen / risico's

1. **Sitemap live-ness**: build-time generator (eenvoudig, vertraagd) of extra edge-function-sitemap (direct live)? Voorstel: build-time.
2. **Inline afbeeldingen**: uploaden jullie zelf naar `marketing-assets` (map `blog/<slug>/`)? Ik plan geen upload-UI in deze batch.
3. **Vertalingen**: worden en/fr/de mee-ingeschoten, of laten we een artikel zonder vertaling terugvallen op NL? Voorstel: fallback op NL, geen blokkade.
4. **reading_minutes**: handmatig zetten, of automatisch berekenen bij publiceren (woorden/200)? Voorstel: automatisch in de admin-toggle als het veld leeg is.
5. Blog-link staat al in de footer/navigatie — geen navigatiewijziging nodig buiten de platform-admin.
