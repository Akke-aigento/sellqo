// EDITOR-1 — "Aanpassen": de webshop bewerken zoals in Shopify. Links de secties en het
// thema, rechts de echte winkel (<slug>.sellqo.shop) die meteen meebeweegt. Wijzigingen
// gaan via postMessage naar het voorbeeld en worden pas opgeslagen met "Opslaan".
// Schrijft alleen naar tenant_theme_settings en homepage_sections (dezelfde bronnen
// als de andere webshopschermen).
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ChevronRight, Eye, EyeOff, ExternalLink, GripVertical, Image, LayoutList, Loader2,
  Mail, Megaphone, MessageSquare, Monitor, Palette, PanelBottom, Play, Plus, Smartphone, Star, Grid3X3, Trash2,
  BadgeCheck, HelpCircle, Clock, Menu as MenuIcon, ShoppingBag, Activity, Pipette, UtensilsCrossed, CalendarDays,
  GalleryHorizontalEnd, Award, Columns3, Type,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { SectionEditor } from '@/components/admin/storefront/SectionEditor';
import { BrandingUploader } from '@/components/admin/storefront/BrandingUploader';
import { GOOGLE_FONTS, type HomepageSection, type HomepageSectionType } from '@/types/storefront';
import { useCategories } from '@/hooks/useCategories';
import { BlocksEditor, SchemaForm } from '@/components/admin/storefront/schema/SchemaForm';
import { schemaDefaults, type ThemeSchema } from '@/components/admin/storefront/schema/schemaTypes';
import { MenuEditor, type MenuItem } from '@/components/admin/storefront/schema/MenuEditor';
import { ThemeGallery } from '@/components/admin/storefront/schema/ThemeGallery';
import type { ThemePreset } from '@/components/admin/storefront/schema/schemaTypes';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { schemaText } from '@/components/admin/storefront/schema/schemaText';

// Thema-velden die de standaardshop echt gebruikt. Andere instellingen staan hier
// bewust niet: een knop die niets doet, is erger dan geen knop.
const THEME_FIELDS = [
  'brand_color', 'primary_color', 'logo_url', 'favicon_url', 'heading_font', 'body_font',
  'header_sticky', 'product_stock_indicator', 'show_announcement_bar', 'announcement_text',
  'announcement_link', 'footer_text', 'theme_config',
] as const;
type ThemeField = (typeof THEME_FIELDS)[number];
type ThemeDraft = Partial<Record<ThemeField, unknown>>;
type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
// Sectietypes die volledig uit het themaschema komen (geen eigen formulier in SectionEditor).
const PRODUCT_TYPES = ['featured_products', 'collection'];

// Sectietypes met een eigen formulier in SectionEditor. Alle andere secties (voordelen, FAQ,
// winkelreviews, diavoorstelling, logo's, kolommen, tekstblok, …) komen uit het themaschema.
// Labels als i18n-key (admin.storefrontCustomize.sec_<type> / hint_<type>); `type` is de enum-waarde.
const ADDABLE: Array<{ type: HomepageSectionType; icon: typeof Image }> = [
  { type: 'hero', icon: Image },
  { type: 'featured_products', icon: Star },
  { type: 'collection', icon: Grid3X3 },
  { type: 'text_image', icon: LayoutList },
  { type: 'testimonials', icon: MessageSquare },
  { type: 'newsletter', icon: Mail },
  { type: 'video', icon: Play },
  { type: 'announcement', icon: Megaphone },
];
const SCHEMA_ICONS: Record<string, typeof Image> = {
  usp_bar: BadgeCheck, faq: HelpCircle, contact_hours: Clock, menu_card: UtensilsCrossed, event_agenda: CalendarDays,
  external_reviews: Star, slideshow: GalleryHorizontalEnd, logo_list: Award, multicolumn: Columns3, rich_text: Type,
};
const ICONS: Record<string, typeof Image> = { ...Object.fromEntries(ADDABLE.map((a) => [a.type, a.icon])), ...SCHEMA_ICONS };
// Vaste sectietypes met een vertaalde naam; schema-secties gebruiken hun schemalabel (schemaText).
// external_reviews staat ook in het schema ("Winkelreviews"); sec_external_reviews heeft dezelfde
// vertaling, zodat sectielijst en toevoegmenu gelijk zijn, ook als het schema niet laadt.
const LABELED = new Set<string>([...ADDABLE.map((a) => a.type), 'external_reviews']);
const sectionLabel = (type: string, t: TFunction, schemaLabel?: string | null) =>
  LABELED.has(type) ? t(`admin.storefrontCustomize.sec_${type}`) : schemaLabel ? schemaText(t, schemaLabel) : type;

const SWATCHES = ['#0d9488', '#00a0a8', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#374151'];

type Panel = { kind: 'list' } | { kind: 'section'; id: string } | { kind: 'announcement' } | { kind: 'footer' }
  | { kind: 'menu' } | { kind: 'product' } | { kind: 'tracking' } | { kind: 'themes' };

// Meest voorkomende, verzadigde kleur uit het logo (wit, zwart en grijs tellen niet mee).
async function colorFromLogo(url: string): Promise<string | null> {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 40 || min > 225 || max - min < 40) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  if (!best) return null;
  return '#' + [best.r, best.g, best.b].map((v) => Math.round(v / best.n).toString(16).padStart(2, '0')).join('');
}

const sectionTitle = (s: HomepageSection, t: TFunction, schemaLabel?: string | null) =>
  (s.title && s.title !== 'Hero Banner' ? s.title : sectionLabel(s.section_type, t, schemaLabel));
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tempId = () => `nieuw-${Math.random().toString(36).slice(2, 10)}`;

function pickTheme(src: Record<string, unknown> | null | undefined): ThemeDraft {
  const out: ThemeDraft = {};
  for (const k of THEME_FIELDS) out[k] = k === 'theme_config' ? asObj(src?.[k]) : (src?.[k] ?? null);
  return out;
}

// Wat het voorbeeld (de standaardshop) als thema verwacht.
function themeForShop(t: ThemeDraft) {
  return {
    primary_color: (t.brand_color as string) || (t.primary_color as string) || null,
    // Leeg = niets meesturen: de winkel valt dan terug op het logo uit de winkelinstellingen.
    ...(t.logo_url ? { logo_url: t.logo_url } : {}),
    ...(t.favicon_url ? { favicon_url: t.favicon_url } : {}),
    heading_font: t.heading_font ?? null,
    body_font: t.body_font ?? null,
    header_sticky: t.header_sticky !== false,
    product_stock_indicator: t.product_stock_indicator !== false,
    show_announcement_bar: !!t.show_announcement_bar,
    announcement_text: t.announcement_text ?? null,
    announcement_link: t.announcement_link ?? null,
    footer_text: t.footer_text ?? null,
    theme_config: asObj(t.theme_config),
  };
}

function shopOrigin(slug: string): string {
  // ?shop=http://localhost:4321 voor lokaal testen van de standaardshop.
  try {
    const o = new URLSearchParams(window.location.search).get('shop');
    if (o && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
  } catch { /* ignore */ }
  return `https://${slug}.sellqo.shop`;
}

function SortableRow({ section, schemaLabel, active, onOpen, onToggle }: {
  section: HomepageSection; schemaLabel?: string | null; active: boolean; onOpen: () => void; onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const Icon = ICONS[section.section_type] || LayoutList;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group flex items-center gap-1 rounded-md pr-1', isDragging && 'z-10 bg-muted shadow', active && 'bg-muted')}>
      <button type="button" {...attributes} {...listeners} aria-label={t('admin.storefrontCustomize.drag_section', { name: sectionTitle(section, t, schemaLabel) })}
        className="flex h-9 w-7 cursor-grab items-center justify-center text-muted-foreground opacity-60 group-hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left text-sm">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('truncate', !section.is_visible && 'text-muted-foreground')}>{sectionTitle(section, t, schemaLabel)}</span>
        {!section.is_visible ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('admin.products.verborgen')}</span> : null}
      </button>
      <button type="button" onClick={onToggle} aria-label={section.is_visible ? t('admin.storefrontCustomize.verbergen') : t('admin.storefrontCustomize.tonen')}
        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-background group-hover:opacity-100 focus:opacity-100">
        {section.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  );
}

function RowButton({ icon: Icon, label, hint, onClick }: { icon: typeof Image; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

// Titel, ondertitel, velden en blokken van een sectie die volledig uit het schema komt.
function SchemaSectionFields({ section, def, icons, onChange }: {
  section: HomepageSection; def: NonNullable<ThemeSchema['sections'][string]>; icons: string[];
  onChange: (patch: Partial<HomepageSection>) => void;
}) {
  const { t } = useTranslation();
  const content = asObj(section.content);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`t-${section.id}`}>{t('admin.storefrontCustomize.titel_optioneel')}</Label>
        <Input id={`t-${section.id}`} value={section.title || ''} onChange={(e) => onChange({ title: e.target.value || null })} />
      </div>
      {def.fields.length ? (
        <SchemaForm idPrefix={`c-${section.id}`} fields={def.fields} values={content} icons={icons}
          onChange={(v) => onChange({ content: { ...content, ...v } as HomepageSection['content'] })} />
      ) : null}
      {def.blocks ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-semibold">{schemaText(t, def.blocks.plural || def.blocks.label)}</p>
          <BlocksEditor blocks={def.blocks} icons={icons}
            items={(Array.isArray(content[def.blocks.key]) ? content[def.blocks.key] : []) as Record<string, unknown>[]}
            onChange={(items) => onChange({ content: { ...content, [def.blocks!.key]: items } as HomepageSection['content'] })} />
        </div>
      ) : null}
    </div>
  );
}

export default function StorefrontCustomizePage() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { themeSettings, sections: serverSections, pages, settingsLoading, sectionsLoading } = useStorefront();
  const { categories } = useCategories();
  const [schema, setSchema] = useState<ThemeSchema | null>(null);
  const [schemaError, setSchemaError] = useState(false);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'sections' | 'theme'>('sections');
  // ?panel=themes (vanaf de Webshop-pagina) opent meteen "Thema kiezen".
  const [panel, setPanel] = useState<Panel>(() => {
    try { return new URLSearchParams(window.location.search).get('panel') === 'themes' ? { kind: 'themes' } : { kind: 'list' }; } catch { return { kind: 'list' }; }
  });
  const [tried, setTried] = useState<string | null>(null);
  // Gsm: bewerken en voorbeeld wisselen elkaar af (geen plaats voor beide naast elkaar).
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [theme, setTheme] = useState<ThemeDraft>({});
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frameState, setFrameState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [frameKey, setFrameKey] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const slug = currentTenant?.slug || '';
  const origin = slug ? shopOrigin(slug) : '';
  const baseTheme = useMemo(() => pickTheme(themeSettings as unknown as Record<string, unknown>), [themeSettings]);

  // Het themaschema komt van de shop zelf: één bron voor shop en editor.
  useEffect(() => {
    if (!origin) return;
    let stop = false;
    fetch(`${origin}/theme/schema.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ThemeSchema) => { if (!stop) { setSchema(j); setSchemaError(false); } })
      .catch(() => { if (!stop) setSchemaError(true); });
    return () => { stop = true; };
  }, [origin]);

  // Concept vullen zodra de gegevens er zijn, en opnieuw na elke opslag (resync),
  // zonder het scherm of het voorbeeld weg te halen.
  const [resync, setResync] = useState(false);
  useEffect(() => {
    if (settingsLoading || sectionsLoading || (loaded && !resync)) return;
    setTheme(baseTheme);
    setSections(serverSections);
    setDeleted([]);
    setLoaded(true);
    setResync(false);
  }, [settingsLoading, sectionsLoading, loaded, resync, baseTheme, serverSections]);

  const themeDirty = loaded && !sameJson(theme, baseTheme);
  const sectionsDirty = loaded && (deleted.length > 0 || !sameJson(
    sections.map((s, i) => ({ ...s, sort_order: i })),
    serverSections.map((s, i) => ({ ...s, sort_order: i })),
  ) || !sameJson(sections.map((s) => s.id), serverSections.map((s) => s.id)));
  const dirty = themeDirty || sectionsDirty;

  // Wegnavigeren met niet-opgeslagen wijzigingen: eerst vragen. (BrowserRouter kent
  // geen useBlocker; de enige uitgangen hier zijn de links met confirmLeave.)
  const confirmLeave = (e: ReactMouseEvent) => {
    if (dirty && !window.confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Toch weggaan?')) e.preventDefault();
  };
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ---------- Voorbeeld (iframe) ----------
  const post = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(msg, origin || '*');
  }, [origin]);

  const sendPreview = useCallback(() => {
    post({
      type: 'sellqo:preview',
      theme: themeForShop(theme),
      sections: sections.map((s, i) => ({
        id: s.id, section_type: s.section_type, title: s.title, subtitle: s.subtitle,
        content: s.content, settings: s.settings, sort_order: i, is_visible: s.is_visible,
      })),
    });
  }, [post, theme, sections]);

  useEffect(() => { if (frameState === 'ready' && loaded) sendPreview(); }, [frameState, loaded, sendPreview]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string; sectionId?: string } | null;
      if (!d || d.source !== 'sellqo-shop') return;
      if (d.type === 'sellqo:ready') setFrameState('ready');
      if (d.type === 'sellqo:select' && d.sectionId) { setTab('sections'); setPanel({ kind: 'section', id: d.sectionId }); setMobileView('edit'); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin]);

  // Geen antwoord van de winkel binnen 12 s: hij staat (nog) niet online.
  useEffect(() => {
    if (frameState !== 'loading') return;
    const t = setTimeout(() => setFrameState((s) => (s === 'loading' ? 'unavailable' : s)), 12000);
    return () => clearTimeout(t);
  }, [frameState, frameKey]);

  useEffect(() => {
    if (panel.kind === 'section' && frameState === 'ready') post({ type: 'sellqo:focus', sectionId: panel.id });
  }, [panel, frameState, post]);

  // Productpagina-instellingen: toon in het voorbeeld een productpagina, daarna terug naar home.
  const onProductPage = useRef(false);
  useEffect(() => {
    if (frameState !== 'ready') return;
    if (panel.kind === 'product') { onProductPage.current = true; post({ type: 'sellqo:goto', target: 'product' }); }
    else if (onProductPage.current) { onProductPage.current = false; post({ type: 'sellqo:goto', target: 'home' }); }
  }, [panel, frameState, post]);

  // ---------- Bewerken ----------
  const setField = (k: ThemeField, v: unknown) => setTheme((t) => ({ ...t, [k]: v }));
  const cfg = asObj(theme.theme_config);
  const setCfg = (part: string, v: unknown) => setTheme((t) => ({ ...t, theme_config: { ...asObj(t.theme_config), [part]: v } }));
  const [pickingColor, setPickingColor] = useState(false);
  const pickFromLogo = async () => {
    const url = (theme.logo_url as string) || currentTenant?.logo_url;
    if (!url) { toast.error(t('admin.storefrontCustomize.upload_logo_first')); return; }
    setPickingColor(true);
    try {
      const c = await colorFromLogo(url);
      if (c) { setField('brand_color', c); toast.success(t('admin.storefrontCustomize.brand_from_logo', { color: c })); }
      else toast.error(t('admin.storefrontCustomize.no_logo_color'));
    } catch {
      toast.error(t('admin.storefrontCustomize.logo_unreadable'));
    } finally {
      setPickingColor(false);
    }
  };
  const updateSection = (s: HomepageSection) => setSections((list) => list.map((x) => (x.id === s.id ? { ...s } : x)));
  // SectionEditor kent alleen titel en inhoud; stijl en zichtbaarheid komen uit de editor zelf.
  const updateFromEditor = (s: HomepageSection) => setSections((list) => list.map((x) => (x.id === s.id ? { ...s, settings: x.settings, is_visible: x.is_visible } : x)));
  const toggleSection = (id: string) => setSections((list) => list.map((x) => (x.id === id ? { ...x, is_visible: !x.is_visible } : x)));
  const removeSection = (id: string) => {
    setSections((list) => list.filter((x) => x.id !== id));
    if (!id.startsWith('nieuw-')) setDeleted((d) => [...d, id]);
    setPanel({ kind: 'list' });
  };
  const addSection = (type: HomepageSectionType | string) => {
    const label = sectionLabel(type, t, schema?.sections[type]?.label);
    const def = schema?.sections[type];
    // Schema-secties krijgen meteen hun standaardinhoud (bv. drie voorbeeldvoordelen).
    const schemaContent = def ? { ...schemaDefaults(def.fields), ...(def.blocks ? { [def.blocks.key]: def.blocks.default || [] } : {}) } : null;
    const s = {
      id: tempId(), tenant_id: currentTenant!.id, section_type: type, title: type === 'hero' ? t('admin.storefrontCustomize.default_hero_title') : def ? null : label,
      subtitle: null, content: schemaContent || (type === 'featured_products' || type === 'collection' ? { max_products: 8 } : {}),
      settings: {}, sort_order: sections.length, is_visible: true, created_at: '', updated_at: '',
    } as unknown as HomepageSection;
    setSections((list) => [...list, s]);
    setPanel({ kind: 'section', id: s.id });
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setSections((list) => {
      const from = list.findIndex((x) => x.id === e.active.id);
      const to = list.findIndex((x) => x.id === e.over!.id);
      return arrayMove(list, from, to);
    });
  };

  // Thema toepassen op het concept (nog niet opgeslagen).
  const applyPreset = (p: ThemePreset, opts: { homepage: boolean; keepBrand: boolean }) => {
    setTheme((t) => {
      const tc = asObj(t.theme_config);
      return {
        ...t,
        ...(!opts.keepBrand && p.theme.brand_color ? { brand_color: p.theme.brand_color } : {}),
        heading_font: p.theme.heading_font ?? null,
        body_font: p.theme.body_font ?? null,
        theme_config: { ...tc, preset: p.id, settings: { ...p.settings }, product_page: { ...asObj(tc.product_page), ...p.product_page } },
      };
    });
    if (opts.homepage) {
      setDeleted((d) => [...new Set([...d, ...sections.filter((x) => !x.id.startsWith('nieuw-')).map((x) => x.id)])]);
      setSections(p.sections.map((x, i) => ({
        id: tempId(), tenant_id: currentTenant!.id, section_type: x.section_type, title: x.title, subtitle: x.subtitle ?? null,
        content: x.content, settings: x.settings, sort_order: i, is_visible: true, created_at: '', updated_at: '',
      }) as unknown as HomepageSection));
    }
    setTried(p.name);
  };

  const discard = () => {
    setTried(null);
    setTheme(baseTheme);
    setSections(serverSections);
    setDeleted([]);
    setPanel({ kind: 'list' });
  };

  // ---------- Opslaan ----------
  const save = async () => {
    if (!currentTenant) return;
    setSaving(true);
    try {
      if (themeDirty) {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of THEME_FIELDS) if (!sameJson(theme[k], baseTheme[k])) payload[k] = theme[k];
        // De standaardshop leest primary_color; merkkleur en primaire kleur blijven gelijk.
        if ('brand_color' in payload && theme.brand_color) payload.primary_color = theme.brand_color;
        const { data: existing } = await supabase.from('tenant_theme_settings').select('id').eq('tenant_id', currentTenant.id).maybeSingle();
        const { error } = existing
          ? await supabase.from('tenant_theme_settings').update(payload as never).eq('tenant_id', currentTenant.id)
          : await supabase.from('tenant_theme_settings').insert({ ...payload, tenant_id: currentTenant.id } as never);
        if (error) throw error;
      }
      if (sectionsDirty) {
        for (const id of deleted) {
          const { error } = await supabase.from('homepage_sections').delete().eq('id', id).eq('tenant_id', currentTenant.id);
          if (error) throw error;
        }
        const before = new Map(serverSections.map((s, i) => [s.id, { ...s, sort_order: i }]));
        for (const [i, s] of sections.entries()) {
          const row = {
            section_type: s.section_type, title: s.title, subtitle: s.subtitle,
            content: s.content as unknown as Json, settings: s.settings as unknown as Json,
            sort_order: i, is_visible: s.is_visible,
          };
          if (s.id.startsWith('nieuw-')) {
            const { error } = await supabase.from('homepage_sections').insert({ ...row, tenant_id: currentTenant.id });
            if (error) throw error;
          } else {
            const prev = before.get(s.id);
            const changed = !prev || prev.sort_order !== i || prev.is_visible !== s.is_visible || prev.title !== s.title
              || prev.subtitle !== s.subtitle || !sameJson(prev.content, s.content) || !sameJson(prev.settings, s.settings);
            if (!changed) continue;
            const { error } = await supabase.from('homepage_sections')
              .update({ ...row, updated_at: new Date().toISOString() }).eq('id', s.id).eq('tenant_id', currentTenant.id);
            if (error) throw error;
          }
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant-theme-settings', currentTenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['homepage-sections', currentTenant.id] }),
      ]);
      // Concept opnieuw vullen uit de verse gegevens (nieuwe secties krijgen hun echte ID).
      setResync(true);
      setTried(null);
      setPanel({ kind: 'list' });
      post({ type: 'sellqo:reload' });
      toast.success(t('admin.storefrontCustomize.saved'));
    } catch (err) {
      console.error('EDITOR-1 opslaan', err);
      toast.error(t('admin.storefrontCustomize.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Weergave ----------
  if (!currentTenant || !loaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = panel.kind === 'section' ? sections.find((s) => s.id === panel.id) : undefined;
  const brand = (theme.brand_color as string) || (theme.primary_color as string) || '#0d9488';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Bovenbalk */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:gap-3 sm:px-3">
        <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3">
          <Link to="/admin/storefront" onClick={confirmLeave} aria-label={t('admin.storefrontCustomize.terug_naar_webshop')}><ArrowLeft className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{t('admin.odooChannels.channels.webshop')}</span></Link>
        </Button>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold leading-tight">{currentTenant.name}</p>
          <p className="truncate text-xs text-muted-foreground">Aanpassen · {slug}.sellqo.shop</p>
        </div>
        <div className="mx-auto hidden items-center rounded-md border p-0.5 sm:flex" role="group" aria-label={t('admin.storefrontCustomize.voorbeeldformaat')}>
          <button type="button" onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'}
            className={cn('flex h-8 items-center gap-1.5 rounded px-2.5 text-xs', device === 'desktop' ? 'bg-muted font-medium' : 'text-muted-foreground')}>
            <Monitor className="h-4 w-4" />{t('admin.storefrontCustomize.computer')}
          </button>
          <button type="button" onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'}
            className={cn('flex h-8 items-center gap-1.5 rounded px-2.5 text-xs', device === 'mobile' ? 'bg-muted font-medium' : 'text-muted-foreground')}>
            <Smartphone className="h-4 w-4" />{t('admin.storefrontCustomize.gsm')}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <a href={`https://${slug}.sellqo.shop`} target="_blank" rel="noreferrer">{t('admin.storefrontCustomize.bekijk_winkel')}<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
          </Button>
          {dirty ? <Button variant="outline" size="sm" onClick={discard} disabled={saving}><span className="sm:hidden">{t('admin.storefrontCustomize.herstel')}</span><span className="hidden sm:inline">{t('admin.products.productDescriptionEditor.ongedaan_maken')}</span></Button> : null}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}
          </Button>
        </div>
      </header>

      {tried && dirty ? (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span>{t('admin.storefrontCustomize.je_bekijkt_het_thema')} <strong>{schemaText(t, tried)}</strong>{t('admin.storefrontCustomize.klik_op_opslaan_om_het_te')}</span>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {/* Zijpaneel */}
        <aside className={cn('w-full shrink-0 flex-col border-r md:flex md:max-w-[380px]', mobileView === 'edit' ? 'flex' : 'hidden')}>
          {panel.kind === 'list' ? (
            <>
              <div className="grid shrink-0 grid-cols-2 gap-1 border-b p-2" role="tablist">
                {(['sections', 'theme'] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={cn('h-9 rounded-md text-sm font-medium', tab === k ? 'bg-muted' : 'text-muted-foreground hover:bg-muted/60')}>
                    {k === 'sections' ? t('admin.storefrontCustomize.secties') : t('admin.promotions.giftCardDesignDialog.thema')}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {tab === 'sections' ? (
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.storefrontCustomize.bovenaan')}</p>
                      <RowButton icon={Megaphone} label={t('admin.storefrontCustomize.aankondigingsbalk')} hint={theme.show_announcement_bar ? t('admin.orderingHub.aan') : t('admin.adsProductMap.uit')} onClick={() => setPanel({ kind: 'announcement' })} />
                      <RowButton icon={MenuIcon} label={t('admin.storefrontCustomize.menu')} hint={Array.isArray(cfg.menu) && cfg.menu.length ? `${cfg.menu.length} items` : 'Automatisch'} onClick={() => setPanel({ kind: 'menu' })} />
                    </div>
                    <div>
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.storefrontCustomize.homepage')}</p>
                      {sections.length === 0 ? <p className="px-2 py-2 text-sm text-muted-foreground">{t('admin.storefrontCustomize.nog_geen_secties_je_winkel_toont')}</p> : null}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                          {sections.map((s) => (
                            <SortableRow key={s.id} section={s} schemaLabel={schema?.sections[s.section_type]?.label} active={false}
                              onOpen={() => setPanel({ kind: 'section', id: s.id })} onToggle={() => toggleSection(s.id)} />
                          ))}
                        </SortableContext>
                      </DndContext>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-primary">
                            <Plus className="mr-1.5 h-4 w-4" />{t('admin.storefrontCustomize.sectie_toevoegen')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[340px] p-1.5">
                          {[...ADDABLE.map((a) => ({ ...a, label: t(`admin.storefrontCustomize.sec_${a.type}`), hint: t(`admin.storefrontCustomize.hint_${a.type}`) })),
                            ...Object.entries(schema?.sections || {}).map(([type, d]) => ({ type, label: schemaText(t, d.label), hint: schemaText(t, d.hint), icon: SCHEMA_ICONS[type] || LayoutList }))].map((a) => (
                            <button key={a.type} type="button" onClick={() => addSection(a.type)}
                              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-muted">
                              <a.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <span><span className="block text-sm font-medium">{a.label}</span><span className="block text-xs text-muted-foreground">{a.hint}</span></span>
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.storefrontCustomize.onderaan')}</p>
                      <RowButton icon={PanelBottom} label={t('admin.marketing.emailBlockPalette.footer')} onClick={() => setPanel({ kind: 'footer' })} />
                    </div>
                    <div>
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.storefrontCustomize.overal_in_je_winkel')}</p>
                      <RowButton icon={ShoppingBag} label={t('admin.storefrontCustomize.productpagina')} onClick={() => setPanel({ kind: 'product' })} />
                      <RowButton icon={Activity} label={t('admin.storefrontCustomize.tracking_en_pixels')} hint={[cfg.tracking].some((t) => Object.values(asObj(t)).some((v) => typeof v === 'string' && v)) ? t('admin.marketing.aBTestingPanel.actief') : t('admin.adsProductMap.uit')} onClick={() => setPanel({ kind: 'tracking' })} />
                    </div>
                    <p className="px-2 text-xs text-muted-foreground">{t('admin.storefrontCustomize.tip_klik_in_het_voorbeeld_op')}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button type="button" onClick={() => setPanel({ kind: 'themes' })}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted">
                      <span>
                        <span className="block text-xs text-muted-foreground">{t('admin.promotions.giftCardDesignDialog.thema')}</span>
                        <span className="block font-semibold">{schema?.presets?.find((x) => x.id === cfg.preset)?.name || 'Standaard'}</span>
                      </span>
                      <span className="text-sm font-medium text-primary">{t('admin.storefrontCustomize.thema_kiezen')}</span>
                    </button>
                    <div className="space-y-2.5">
                      <Label className="flex items-center gap-1.5"><Palette className="h-4 w-4" />{t('admin.storefrontCustomize.merkkleur')}</Label>
                      <div className="flex flex-wrap gap-2">
                        {SWATCHES.map((hex) => (
                          <button key={hex} type="button" aria-label={hex} onClick={() => setField('brand_color', hex)}
                            className={cn('h-8 w-8 rounded-full border-2', brand.toLowerCase() === hex ? 'border-foreground' : 'border-transparent')}
                            style={{ background: hex }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(brand) ? brand : '#0d9488'} aria-label={t('admin.products.imageEditorDialog.presets.custom_color')}
                          onChange={(e) => setField('brand_color', e.target.value)} className="h-9 w-11 cursor-pointer rounded border bg-transparent p-0" />
                        <Input value={brand} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setField('brand_color', e.target.value)}
                          className="h-9 font-mono text-sm" aria-label={t('admin.storefrontCustomize.hex_color')} />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={pickFromLogo} disabled={pickingColor}>
                        {pickingColor ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Pipette className="mr-1.5 h-4 w-4" />}Kleur uit mijn logo halen
                      </Button>
                      <p className="text-xs text-muted-foreground">{t('admin.storefrontCustomize.voor_knoppen_links_en_de_aankondigingsbalk')}</p>
                    </div>
                    <div className="space-y-2.5">
                      <Label>{t('admin.storefrontCustomize.logo_en_favicon')}</Label>
                      <BrandingUploader logoUrl={(theme.logo_url as string) || null} faviconUrl={(theme.favicon_url as string) || null}
                        onLogoChange={(u) => setField('logo_url', u)} onFaviconChange={(u) => setField('favicon_url', u)} />
                    </div>
                    <div className="space-y-3">
                      <Label>{t('admin.storefrontCustomize.lettertypes')}</Label>
                      {([['heading_font', 'Titels'], ['body_font', 'Tekst']] as const).map(([k, label]) => (
                        <div key={k} className="space-y-1.5">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <Select value={(theme[k] as string) || '__default'} onValueChange={(v) => setField(k, v === '__default' ? null : v)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default">{t('admin.storefrontCustomize.standaard_van_het_thema')}</SelectItem>
                              {GOOGLE_FONTS.map((f) => <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <Label>{t('admin.storefrontCustomize.gedrag')}</Label>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">{t('admin.storefrontCustomize.menu_blijft_bovenaan_bij_scrollen')}</span>
                        <Switch checked={theme.header_sticky !== false} onCheckedChange={(v) => setField('header_sticky', v)} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">{t('admin.storefrontCustomize.nog_maar_x_op_voorraad_tonen')}</span>
                        <Switch checked={theme.product_stock_indicator !== false} onCheckedChange={(v) => setField('product_stock_indicator', v)} />
                      </div>
                    </div>
                    {schema ? schema.settings.map((g) => (
                      <div key={g.id} className="space-y-3 border-t pt-5">
                        <Label className="text-sm font-semibold">{schemaText(t, g.label)}</Label>
                        <SchemaForm idPrefix={`set-${g.id}`} fields={g.fields} values={asObj(cfg.settings)} icons={schema.icons}
                          onChange={(v) => setCfg('settings', v)} />
                      </div>
                    )) : schemaError ? (
                      <p className="text-xs text-muted-foreground">{t('admin.storefrontCustomize.extra_thema_instellingen_konden_niet_geladen')}</p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
                <Button variant="ghost" size="icon" onClick={() => setPanel({ kind: 'list' })} aria-label={t('admin.storefrontCustomize.terug_naar_de_lijst')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <p className="truncate text-sm font-semibold">
                  {['announcement', 'footer', 'menu', 'product', 'tracking', 'themes'].includes(panel.kind)
                    ? t(`admin.storefrontCustomize.panel_${panel.kind}`)
                    : current ? sectionLabel(current.section_type, t, schema?.sections[current.section_type]?.label) : t('admin.storefrontCustomize.section')}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {panel.kind === 'announcement' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="ann-on">{t('admin.storefrontCustomize.balk_tonen')}</Label>
                      <Switch id="ann-on" checked={!!theme.show_announcement_bar} onCheckedChange={(v) => setField('show_announcement_bar', v)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ann-text">{t('admin.marketing.emailBlockProperties.tekst')}</Label>
                      <Input id="ann-text" value={(theme.announcement_text as string) || ''} placeholder={t('admin.promotions.autoDiscountFormDialog.gratis_verzending_vanaf_50')}
                        onChange={(e) => setField('announcement_text', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ann-link">{t('admin.storefrontCustomize.link_optioneel')}</Label>
                      <Input id="ann-link" value={(theme.announcement_link as string) || ''} placeholder="/producten"
                        onChange={(e) => setField('announcement_link', e.target.value || null)} />
                    </div>
                  </div>
                ) : panel.kind === 'themes' ? (
                  schema?.presets?.length ? (
                    <ThemeGallery presets={schema.presets} current={(cfg.preset as string) || 'standaard'} hasSections={sections.length > 0} onApply={applyPreset} />
                  ) : schemaError ? <p className="text-sm text-muted-foreground">{t('admin.storefrontCustomize.thema_s_konden_niet_geladen_worden')}</p>
                    : <p className="text-sm text-muted-foreground">{t('admin.kitchen.loading')}</p>
                ) : panel.kind === 'menu' ? (
                  <MenuEditor menu={(Array.isArray(cfg.menu) ? cfg.menu : []) as MenuItem[]} onChange={(m) => setCfg('menu', m)}
                    categories={categories} pages={pages.filter((pg) => pg.is_published).map((pg) => ({ slug: pg.slug, title: pg.title }))} />
                ) : panel.kind === 'product' ? (
                  schema ? (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">{t('admin.storefrontCustomize.geldt_voor_alle_productpagina_s_het')}</p>
                      <SchemaForm idPrefix="pp" fields={schema.product_page} values={asObj(cfg.product_page)} onChange={(v) => setCfg('product_page', v)} />
                    </div>
                  ) : <p className="text-sm text-muted-foreground">{t('admin.kitchen.loading')}</p>
                ) : panel.kind === 'tracking' ? (
                  schema ? (
                    <SchemaForm idPrefix="tr" fields={schema.tracking} values={asObj(cfg.tracking)} onChange={(v) => setCfg('tracking', v)} />
                  ) : <p className="text-sm text-muted-foreground">{t('admin.kitchen.loading')}</p>
                ) : panel.kind === 'footer' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="footer-text">{t('admin.storefrontCustomize.korte_tekst_onder_je_winkelnaam')}</Label>
                      <Textarea id="footer-text" rows={3} value={(theme.footer_text as string) || ''}
                        onChange={(e) => setField('footer_text', e.target.value)} placeholder={t('admin.storefrontCustomize.footer_placeholder')} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Juridische pagina's, contactgegevens en sociale media komen automatisch uit je instellingen.{' '}
                      <Link to="/admin/storefront?section=legal" onClick={confirmLeave} className="underline">{t('admin.storefrontCustomize.juridische_pagina_s_beheren')}</Link>
                    </p>
                  </div>
                ) : current ? (
                  <div className="space-y-6">
                    {schema?.sections[current.section_type] ? (
                      <SchemaSectionFields key={current.id} section={current} def={schema.sections[current.section_type]} icons={schema.icons}
                        onChange={(patch) => updateSection({ ...current, ...patch })} />
                    ) : (
                      <SectionEditor key={current.id} section={current} onSave={updateFromEditor} onCancel={() => setPanel({ kind: 'list' })}
                        onChange={updateFromEditor} hideActions compact />
                    )}
                    {schema ? (
                      <div className="space-y-3 border-t pt-4">
                        <p className="text-sm font-semibold">{t('admin.marketing.emailBlockProperties.stijl')}</p>
                        <SchemaForm idPrefix={`st-${current.id}`}
                          fields={[...schema.section_style, ...(PRODUCT_TYPES.includes(current.section_type) ? schema.product_section_style : [])]}
                          values={asObj(asObj(current.settings).style)}
                          onChange={(v) => updateSection({ ...current, settings: { ...asObj(current.settings), style: v } as HomepageSection['settings'] })} />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Switch id="sec-vis" checked={current.is_visible} onCheckedChange={() => toggleSection(current.id)} />
                        <Label htmlFor="sec-vis">{t('admin.storefrontCustomize.tonen')}</Label>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeSection(current.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" />{t('admin.storefrontCustomize.sectie_verwijderen')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.storefrontCustomize.deze_sectie_bestaat_niet_meer')}</p>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Voorbeeld */}
        <main className={cn('relative min-w-0 flex-1 items-start justify-center overflow-auto bg-muted/40 p-0 md:flex md:p-3', mobileView === 'preview' ? 'flex' : 'hidden')}>
          <div className={cn('h-full overflow-hidden bg-white transition-all md:rounded-lg md:border md:shadow-sm',
            device === 'mobile' ? 'w-full md:w-[390px] md:max-w-full' : 'w-full')}>
            {slug ? (
              <iframe key={frameKey} ref={frameRef} title={t('admin.storefrontCustomize.voorbeeld_van_je_winkel')} src={`${origin}/?editor=1`}
                className="h-full w-full border-0" />
            ) : null}
          </div>
          {frameState === 'unavailable' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6">
              <div className="max-w-sm space-y-3 text-center">
                <p className="font-semibold">{t('admin.storefrontCustomize.het_voorbeeld_laadt_niet')}</p>
                <p className="text-sm text-muted-foreground">
                  Je SellQo-webshop op {slug}.sellqo.shop is nog niet actief, of hij reageert even niet. Je kan wel gewoon bewerken en opslaan.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setFrameState('loading'); setFrameKey((k) => k + 1); }}>{t('admin.pos.cardPaymentDialog.opnieuw_proberen')}</Button>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {/* Gsm: wisselen tussen bewerken en het voorbeeld. */}
      <div className="grid shrink-0 grid-cols-2 gap-1 border-t bg-background p-2 md:hidden" role="tablist" aria-label={t('admin.storefrontCustomize.weergave')}>
        {(['edit', 'preview'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)}
            className={cn('flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium', mobileView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {v === 'edit' ? <><Palette className="h-4 w-4" />{t('admin.storefrontCustomize.edit')}</> : <><Eye className="h-4 w-4" />{t('admin.marketing.templateDialog.voorbeeld')}</>}
          </button>
        ))}
      </div>
    </div>
  );
}
