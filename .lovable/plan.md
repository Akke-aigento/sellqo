

# Implementatieplan: Uitgebreide Content Bibliotheek met Agenda

## Overzicht

Dit plan transformeert de bestaande Content Bibliotheek naar een **centrale content hub** waar alle marketing assets samenkomen - zowel AI-gegenereerd als handmatig geüpload. Het voegt een **kalenderweergave** toe voor geplande content en een **volledige historiek** in lijstvorm.

---

## Huidige Situatie

| Component | Status | Opmerking |
|-----------|--------|-----------|
| `ai_generated_content` tabel | ✅ Bestaat | Bevat AI content met scheduling velden |
| `social_posts` tabel | ✅ Bestaat | Social media posts met status tracking |
| `AIContentLibrary.tsx` | ✅ Bestaat | Basis lijst-view, alleen AI content |
| Storage buckets | ✅ Bestaan | `ai-images`, `product-images`, `tenant-logos` |
| Kalender component | ✅ Bestaat | `react-day-picker` basis |
| Agenda/Timeline view | ❌ Ontbreekt | Geen maandoverzicht |
| Asset upload naar library | ❌ Ontbreekt | Alleen per-tool uploads |
| AI toegang tot library | ❌ Ontbreekt | AI kent geüploade assets niet |
| Unified content hub | ❌ Ontbreekt | Verspreid over meerdere plekken |

---

## Nieuwe Architectuur

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTENT BIBLIOTHEEK                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│  │ Agenda  │  │ Lijst   │  │ Assets  │  │ AI      │                        │
│  │ (week)  │  │ (all)   │  │ (media) │  │ Suggest │                        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                        │
│       │            │            │            │                              │
│       └────────────┴────────────┴────────────┘                              │
│                         │                                                   │
│                         ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │  Unified Data Layer │                                        │
│              │  - ai_generated     │                                        │
│              │  - social_posts     │                                        │
│              │  - media_assets     │                                        │
│              │  - email_campaigns  │                                        │
│              └─────────────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deel 1: Content Agenda (Kalender View)

### Weekweergave met Geplande Content

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📅 Content Agenda                           ◀ Week 4 ▶    [Maand] [Week]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  MA 20        DI 21        WO 22        DO 23        VR 24        ZA 25    │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────────┤
│  ┌─────────┐ │              │ ┌─────────┐  │              │                │
│  │ 📱 IG   │ │              │ │ 📧 News │  │              │                │
│  │ 10:00   │ │              │ │ 09:00   │  │              │                │
│  │ Product │ │              │ │ Februari│  │              │                │
│  └─────────┘ │              │ └─────────┘  │              │                │
│              │ ┌─────────┐  │              │ ┌─────────┐  │                │
│              │ │ 📱 FB   │  │              │ │ 📱 LI   │  │                │
│              │ │ 14:00   │  │              │ │ 11:00   │  │                │
│              │ │ Aanbie..│  │              │ │ Blog..  │  │                │
│              │ └─────────┘  │              │ └─────────┘  │                │
├──────────────┴──────────────┴──────────────┴──────────────┴────────────────┤
│  + Nieuwe content toevoegen                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Features
- **Week/Maand toggle** - Schakelen tussen views
- **Drag & drop** - Content herschikken (met dnd-kit, al geïnstalleerd)
- **Quick actions** - Hover voor bewerken/verwijderen
- **Status badges** - Draft (geel), Gepland (blauw), Gepubliceerd (groen)
- **Platform icons** - Instagram, Facebook, LinkedIn, Email

---

## Deel 2: Media Assets Library

### Doel
Centrale plek voor **alle visuele assets** die door AI of gebruiker zijn geüpload.

### Nieuwe Tabel: `media_assets`

```sql
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File info
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- image/jpeg, image/png, video/mp4
  file_size INTEGER,
  
  -- Metadata
  title TEXT,
  description TEXT,
  alt_text TEXT,  -- Voor SEO/accessibility
  tags TEXT[] DEFAULT '{}',  -- ["product", "zomer", "korting"]
  
  -- AI context
  ai_description TEXT,  -- AI gegenereerde beschrijving
  is_ai_generated BOOLEAN DEFAULT false,
  source TEXT, -- 'upload', 'ai_generated', 'product_import'
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Organization
  folder TEXT DEFAULT 'general', -- 'products', 'campaigns', 'social', 'general'
  is_favorite BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### UI: Asset Grid met Upload

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🖼️ Media Assets                    [+ Upload]  [AI Genereer]  🔍 Zoeken    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Folders: [Alles] [Producten] [Campagnes] [Social] [Favorieten]             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  🖼️    │  │  🖼️    │  │  🖼️    │  │  🖼️    │  │  🖼️    │           │
│  │         │  │    ⭐   │  │         │  │   🤖   │  │         │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│  product-1    banner-zomer  social-fb    ai-gen-3     promo-...            │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                                     │
│  │  🖼️    │  │  🖼️    │  │  ➕     │   ← Drop zone                       │
│  │   🤖   │  │         │  │  Upload │                                      │
│  └─────────┘  └─────────┘  └─────────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Features
- **Drag & drop upload** - Bestanden direct uploaden
- **Folder organisatie** - Categoriseer assets
- **Favorieten** - Snel toegang tot veelgebruikte assets
- **Tags** - Flexibele tagging voor AI context
- **AI beschrijving** - Automatische beschrijving bij upload (via Gemini Vision)
- **Usage tracking** - Zie welke assets veel gebruikt worden

---

## Deel 3: Volledige Historiek (Lijst View)

### Uitgebreide Content Lijst

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 Content Historiek                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filters: [Alle types ▼] [Alle statussen ▼] [Afgelopen 30 dagen ▼]          │
│           [Alle platforms ▼]                               🔍 Zoeken        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Type    │ Titel                    │ Platform │ Status    │ Datum    │ ⋮  │
│──────────┼──────────────────────────┼──────────┼───────────┼──────────┼────│
│  📱      │ Zomer collectie lancering│ Instagram│ ✅ Posted │ 20 jan   │ ⋮  │
│  📧      │ Nieuwsbrief februari     │ Email    │ 📅 Planned│ 22 jan   │ ⋮  │
│  📱      │ Korting weekend          │ Facebook │ ✅ Posted │ 18 jan   │ ⋮  │
│  💡      │ Black Friday ideeën      │ -        │ 📝 Draft  │ 15 jan   │ ⋮  │
│  📱      │ Product spotlight        │ LinkedIn │ ✅ Posted │ 14 jan   │ ⋮  │
│  📧      │ Welkom nieuwe klanten    │ Email    │ ✅ Sent   │ 10 jan   │ ⋮  │
├─────────────────────────────────────────────────────────────────────────────┤
│                         [Load more...]                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Sources (Unified Query)
- `ai_generated_content` - AI gegenereerde teksten/suggesties
- `social_posts` - Social media posts (scheduled, posted)
- `email_campaigns` - Verstuurde email campagnes
- `media_assets` - Geüploade/gegenereerde afbeeldingen

---

## Deel 4: AI Integratie met Library

### Context voor AI Generatie

Wanneer AI content genereert, kan het nu:
1. **Toegang tot media assets** - "Gebruik bestaande productfoto's"
2. **Leren van historiek** - "Genereer in dezelfde stijl als vorige posts"
3. **Brand assets herkennen** - Logo's, kleuren, fonts

### AI Asset Beschrijving bij Upload

```typescript
// Edge function: describe-asset
// Input: image URL
// Output: { description, tags[], suggested_alt_text }

// Voorbeeld response:
{
  "description": "Zwarte leren handtas met gouden details, gefotografeerd op witte achtergrond",
  "tags": ["handtas", "leer", "zwart", "accessoire", "productfoto"],
  "suggested_alt_text": "Zwarte leren dameshandtas met gouden sluiting"
}
```

### AI Suggesties in Library

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💡 AI Suggesties                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Op basis van je content historiek:                                          │
│                                                                             │
│  • Je postte vorige week over "zomer collectie" - tijd voor een follow-up?  │
│  • Asset "banner-zomer.jpg" is al 14 dagen niet gebruikt                    │
│  • Je hebt 3 drafts klaarstaan - wil je ze plannen?                         │
│                                                                             │
│  [Genereer social post]  [Plan bestaande drafts]                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deel 5: Nieuwe Pagina Structuur

### Tab Navigatie in AIMarketingHub

De bestaande "Bibliotheek" tab wordt uitgebreid:

```typescript
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="create">Creëren</TabsTrigger>
    <TabsTrigger value="calendar">📅 Agenda</TabsTrigger>
    <TabsTrigger value="library">📚 Bibliotheek</TabsTrigger>
    <TabsTrigger value="assets">🖼️ Assets</TabsTrigger>
  </TabsList>
  
  <TabsContent value="calendar">
    <ContentCalendar />
  </TabsContent>
  
  <TabsContent value="library">
    <ContentHistoryList />
  </TabsContent>
  
  <TabsContent value="assets">
    <MediaAssetsLibrary />
  </TabsContent>
</Tabs>
```

---

## Technische Implementatie

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| **Database** | | |
| Migratie | SQL | `media_assets` tabel met RLS |
| Migratie | SQL | Index op `tags` voor full-text search |
| **Components** | | |
| `ContentCalendar.tsx` | Nieuw | Week/maand kalender view |
| `ContentCalendarDay.tsx` | Nieuw | Individuele dag met content items |
| `ContentHistoryList.tsx` | Nieuw | Uitgebreide lijst met alle content |
| `MediaAssetsLibrary.tsx` | Nieuw | Grid view voor media assets |
| `AssetUploader.tsx` | Nieuw | Drag & drop upload component |
| `AssetDetailDialog.tsx` | Nieuw | Asset preview met metadata |
| `AIAssetSuggestions.tsx` | Nieuw | AI suggesties sidebar |
| **Hooks** | | |
| `useMediaAssets.ts` | Nieuw | CRUD voor media assets |
| `useContentCalendar.ts` | Nieuw | Unified content data voor kalender |
| **Edge Functions** | | |
| `describe-asset/index.ts` | Nieuw | AI beschrijving van geüploade afbeeldingen |
| **Updates** | | |
| `AIMarketingHub.tsx` | Update | Nieuwe tabs toevoegen |
| `useImageUpload.ts` | Update | `marketing-assets` bucket support |

---

## Content Types & Statussen

### Types
| Type | Icon | Bron |
|------|------|------|
| Social Post | 📱 | `social_posts` |
| Email Campaign | 📧 | `email_campaigns` |
| AI Suggestie | 💡 | `ai_generated_content` (suggestion) |
| AI Content | 🤖 | `ai_generated_content` (social/email) |
| Media Asset | 🖼️ | `media_assets` |

### Statussen
| Status | Badge | Betekenis |
|--------|-------|-----------|
| Draft | 📝 Geel | Nog niet gepland |
| Scheduled | 📅 Blauw | Gepland voor toekomst |
| Published | ✅ Groen | Succesvol gepost |
| Sent | ✅ Groen | Email verzonden |
| Failed | ❌ Rood | Publicatie mislukt |

---

## Resultaat

Na implementatie heeft de merchant:

| Feature | Beschrijving |
|---------|-------------|
| **Content Agenda** | Kalender met alle geplande content op één plek |
| **Historiek** | Volledige lijst van alle gegenereerde/geposte content |
| **Media Assets** | Centrale plek voor alle visuele assets |
| **Upload functie** | Direct uploaden naar library voor AI gebruik |
| **AI Context** | AI heeft toegang tot bestaande assets en stijl |
| **Drag & drop** | Content plannen door te slepen in kalender |
| **Search & filter** | Snel terugvinden van eerdere content |
| **Usage tracking** | Inzicht in welke assets/content goed presteren |

De AI kan nu ook:
- Bestaande productfoto's voorstellen bij social posts
- Stijl leren van eerdere succesvolle content
- Waarschuwen voor ongebruikte assets
- Suggesties doen op basis van content historiek

