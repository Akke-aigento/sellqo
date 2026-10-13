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

// Thema-velden die de standaardshop echt gebruikt. Andere instellingen staan hier
// bewust niet: een knop die niets doet, is erger dan geen knop.
const THEME_FIELDS = [
  'brand_color', 'primary_color', 'logo_url', 'favicon_url', 'heading_font', 'body_font',
  'header_sticky', 'product_stock_indicator', 'show_announcement_bar', 'announcement_text',
  'announcement_link', 'footer_text',
] as const;
type ThemeField = (typeof THEME_FIELDS)[number];
type ThemeDraft = Partial<Record<ThemeField, string | boolean | null>>;

// Sectietypes die de standaardshop toont (externe reviews volgen later).
const ADDABLE: Array<{ type: HomepageSectionType; label: string; hint: string; icon: typeof Image }> = [
  { type: 'hero', label: 'Grote banner', hint: 'Foto met titel en knop', icon: Image },
  { type: 'featured_products', label: 'Uitgelichte producten', hint: 'Producten die je zelf kiest', icon: Star },
  { type: 'collection', label: 'Collectie', hint: 'Producten uit één categorie', icon: Grid3X3 },
  { type: 'text_image', label: 'Tekst met afbeelding', hint: 'Verhaal, sfeer of uitleg', icon: LayoutList },
  { type: 'testimonials', label: 'Klantreviews', hint: 'Wat klanten zeggen', icon: MessageSquare },
  { type: 'newsletter', label: 'Nieuwsbrief', hint: 'Inschrijven op je mailinglijst', icon: Mail },
  { type: 'video', label: 'Video', hint: 'YouTube, Vimeo of eigen video', icon: Play },
  { type: 'announcement', label: 'Aankondiging', hint: 'Korte opvallende melding', icon: Megaphone },
];
const ICONS: Record<string, typeof Image> = Object.fromEntries(ADDABLE.map((a) => [a.type, a.icon]));
const LABELS: Record<string, string> = { ...Object.fromEntries(ADDABLE.map((a) => [a.type, a.label])), external_reviews: 'Externe reviews' };

const SWATCHES = ['#0d9488', '#00a0a8', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#374151'];

type Panel = { kind: 'list' } | { kind: 'section'; id: string } | { kind: 'announcement' } | { kind: 'footer' };

const sectionTitle = (s: HomepageSection) => (s.title && s.title !== 'Hero Banner' ? s.title : LABELS[s.section_type] || s.section_type);
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tempId = () => `nieuw-${Math.random().toString(36).slice(2, 10)}`;

function pickTheme(src: Record<string, unknown> | null | undefined): ThemeDraft {
  const out: ThemeDraft = {};
  for (const k of THEME_FIELDS) out[k] = (src?.[k] as string | boolean | null | undefined) ?? null;
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

function SortableRow({ section, active, onOpen, onToggle }: {
  section: HomepageSection; active: boolean; onOpen: () => void; onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const Icon = ICONS[section.section_type] || LayoutList;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group flex items-center gap-1 rounded-md pr-1', isDragging && 'z-10 bg-muted shadow', active && 'bg-muted')}>
      <button type="button" {...attributes} {...listeners} aria-label={`${sectionTitle(section)} verslepen`}
        className="flex h-9 w-7 cursor-grab items-center justify-center text-muted-foreground opacity-60 group-hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left text-sm">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('truncate', !section.is_visible && 'text-muted-foreground line-through')}>{sectionTitle(section)}</span>
      </button>
      <button type="button" onClick={onToggle} aria-label={section.is_visible ? 'Verbergen' : 'Tonen'}
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

export default function StorefrontCustomizePage() {
  const { currentTenant } = useTenant();
  const { themeSettings, sections: serverSections, settingsLoading, sectionsLoading } = useStorefront();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'sections' | 'theme'>('sections');
  const [panel, setPanel] = useState<Panel>({ kind: 'list' });
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
      if (d.type === 'sellqo:select' && d.sectionId) { setTab('sections'); setPanel({ kind: 'section', id: d.sectionId }); }
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

  // ---------- Bewerken ----------
  const setField = (k: ThemeField, v: string | boolean | null) => setTheme((t) => ({ ...t, [k]: v }));
  const updateSection = (s: HomepageSection) => setSections((list) => list.map((x) => (x.id === s.id ? { ...s } : x)));
  const toggleSection = (id: string) => setSections((list) => list.map((x) => (x.id === id ? { ...x, is_visible: !x.is_visible } : x)));
  const removeSection = (id: string) => {
    setSections((list) => list.filter((x) => x.id !== id));
    if (!id.startsWith('nieuw-')) setDeleted((d) => [...d, id]);
    setPanel({ kind: 'list' });
  };
  const addSection = (type: HomepageSectionType) => {
    const label = LABELS[type];
    const s = {
      id: tempId(), tenant_id: currentTenant!.id, section_type: type, title: type === 'hero' ? 'Welkom' : label,
      subtitle: null, content: type === 'featured_products' || type === 'collection' ? { max_products: 8 } : {},
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

  const discard = () => {
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
      setPanel({ kind: 'list' });
      post({ type: 'sellqo:reload' });
      toast.success('Opgeslagen — je winkel is bijgewerkt');
    } catch (err) {
      console.error('EDITOR-1 opslaan', err);
      toast.error('Opslaan lukte niet. Je wijzigingen staan nog klaar; probeer opnieuw.');
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
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/storefront" onClick={confirmLeave}><ArrowLeft className="mr-1.5 h-4 w-4" />Webshop</Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{currentTenant.name}</p>
          <p className="truncate text-xs text-muted-foreground">Aanpassen · {slug}.sellqo.shop</p>
        </div>
        <div className="mx-auto hidden items-center rounded-md border p-0.5 sm:flex" role="group" aria-label="Voorbeeldformaat">
          <button type="button" onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'}
            className={cn('flex h-8 items-center gap-1.5 rounded px-2.5 text-xs', device === 'desktop' ? 'bg-muted font-medium' : 'text-muted-foreground')}>
            <Monitor className="h-4 w-4" />Computer
          </button>
          <button type="button" onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'}
            className={cn('flex h-8 items-center gap-1.5 rounded px-2.5 text-xs', device === 'mobile' ? 'bg-muted font-medium' : 'text-muted-foreground')}>
            <Smartphone className="h-4 w-4" />Gsm
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <a href={`https://${slug}.sellqo.shop`} target="_blank" rel="noreferrer">Bekijk winkel<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
          </Button>
          {dirty ? <Button variant="outline" size="sm" onClick={discard} disabled={saving}>Ongedaan maken</Button> : null}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {dirty ? 'Opslaan' : 'Opgeslagen'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Zijpaneel */}
        <aside className="flex w-full max-w-[380px] shrink-0 flex-col border-r">
          {panel.kind === 'list' ? (
            <>
              <div className="grid shrink-0 grid-cols-2 gap-1 border-b p-2" role="tablist">
                {(['sections', 'theme'] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={cn('h-9 rounded-md text-sm font-medium', tab === t ? 'bg-muted' : 'text-muted-foreground hover:bg-muted/60')}>
                    {t === 'sections' ? 'Secties' : 'Thema'}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {tab === 'sections' ? (
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bovenaan</p>
                      <RowButton icon={Megaphone} label="Aankondigingsbalk" hint={theme.show_announcement_bar ? 'Aan' : 'Uit'} onClick={() => setPanel({ kind: 'announcement' })} />
                    </div>
                    <div>
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Homepage</p>
                      {sections.length === 0 ? <p className="px-2 py-2 text-sm text-muted-foreground">Nog geen secties. Je winkel toont nu de standaardopbouw.</p> : null}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                          {sections.map((s) => (
                            <SortableRow key={s.id} section={s} active={false}
                              onOpen={() => setPanel({ kind: 'section', id: s.id })} onToggle={() => toggleSection(s.id)} />
                          ))}
                        </SortableContext>
                      </DndContext>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-primary">
                            <Plus className="mr-1.5 h-4 w-4" />Sectie toevoegen
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[340px] p-1.5">
                          {ADDABLE.map((a) => (
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
                      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onderaan</p>
                      <RowButton icon={PanelBottom} label="Footer" onClick={() => setPanel({ kind: 'footer' })} />
                    </div>
                    <p className="px-2 text-xs text-muted-foreground">Tip: klik in het voorbeeld op een sectie om ze meteen te bewerken.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2.5">
                      <Label className="flex items-center gap-1.5"><Palette className="h-4 w-4" />Merkkleur</Label>
                      <div className="flex flex-wrap gap-2">
                        {SWATCHES.map((hex) => (
                          <button key={hex} type="button" aria-label={hex} onClick={() => setField('brand_color', hex)}
                            className={cn('h-8 w-8 rounded-full border-2', brand.toLowerCase() === hex ? 'border-foreground' : 'border-transparent')}
                            style={{ background: hex }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(brand) ? brand : '#0d9488'} aria-label="Eigen kleur"
                          onChange={(e) => setField('brand_color', e.target.value)} className="h-9 w-11 cursor-pointer rounded border bg-transparent p-0" />
                        <Input value={brand} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setField('brand_color', e.target.value)}
                          className="h-9 font-mono text-sm" aria-label="Hex-kleur" />
                      </div>
                      <p className="text-xs text-muted-foreground">Voor knoppen, links en de aankondigingsbalk. Tekst wordt automatisch leesbaar gemaakt.</p>
                    </div>
                    <div className="space-y-2.5">
                      <Label>Logo en favicon</Label>
                      <BrandingUploader logoUrl={(theme.logo_url as string) || null} faviconUrl={(theme.favicon_url as string) || null}
                        onLogoChange={(u) => setField('logo_url', u)} onFaviconChange={(u) => setField('favicon_url', u)} />
                    </div>
                    <div className="space-y-3">
                      <Label>Lettertypes</Label>
                      {([['heading_font', 'Titels'], ['body_font', 'Tekst']] as const).map(([k, label]) => (
                        <div key={k} className="space-y-1.5">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <Select value={(theme[k] as string) || '__default'} onValueChange={(v) => setField(k, v === '__default' ? null : v)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default">Standaard van het thema</SelectItem>
                              {GOOGLE_FONTS.map((f) => <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <Label>Gedrag</Label>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">Menu blijft bovenaan bij scrollen</span>
                        <Switch checked={theme.header_sticky !== false} onCheckedChange={(v) => setField('header_sticky', v)} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">"Nog maar X op voorraad" tonen</span>
                        <Switch checked={theme.product_stock_indicator !== false} onCheckedChange={(v) => setField('product_stock_indicator', v)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
                <Button variant="ghost" size="icon" onClick={() => setPanel({ kind: 'list' })} aria-label="Terug naar de lijst">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <p className="truncate text-sm font-semibold">
                  {panel.kind === 'announcement' ? 'Aankondigingsbalk' : panel.kind === 'footer' ? 'Footer' : current ? LABELS[current.section_type] || 'Sectie' : 'Sectie'}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {panel.kind === 'announcement' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="ann-on">Balk tonen</Label>
                      <Switch id="ann-on" checked={!!theme.show_announcement_bar} onCheckedChange={(v) => setField('show_announcement_bar', v)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ann-text">Tekst</Label>
                      <Input id="ann-text" value={(theme.announcement_text as string) || ''} placeholder="Gratis verzending vanaf €50"
                        onChange={(e) => setField('announcement_text', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ann-link">Link (optioneel)</Label>
                      <Input id="ann-link" value={(theme.announcement_link as string) || ''} placeholder="/producten"
                        onChange={(e) => setField('announcement_link', e.target.value || null)} />
                    </div>
                  </div>
                ) : panel.kind === 'footer' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="footer-text">Korte tekst onder je winkelnaam</Label>
                      <Textarea id="footer-text" rows={3} value={(theme.footer_text as string) || ''}
                        onChange={(e) => setField('footer_text', e.target.value)} placeholder="Elektriciteit voor je camper, sinds 2024." />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Juridische pagina's, contactgegevens en sociale media komen automatisch uit je instellingen.{' '}
                      <Link to="/admin/storefront?section=legal" onClick={confirmLeave} className="underline">Juridische pagina's beheren</Link>
                    </p>
                  </div>
                ) : current ? (
                  <div className="space-y-6">
                    <SectionEditor key={current.id} section={current} onSave={updateSection} onCancel={() => setPanel({ kind: 'list' })}
                      onChange={updateSection} hideActions compact />
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Switch id="sec-vis" checked={current.is_visible} onCheckedChange={() => toggleSection(current.id)} />
                        <Label htmlFor="sec-vis">Tonen</Label>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeSection(current.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" />Sectie verwijderen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Deze sectie bestaat niet meer.</p>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Voorbeeld */}
        <main className="relative hidden min-w-0 flex-1 items-start justify-center overflow-auto bg-muted/40 p-3 md:flex">
          <div className={cn('h-full overflow-hidden rounded-lg border bg-white shadow-sm transition-all',
            device === 'mobile' ? 'w-[390px] max-w-full' : 'w-full')}>
            {slug ? (
              <iframe key={frameKey} ref={frameRef} title="Voorbeeld van je winkel" src={`${origin}/?editor=1`}
                className="h-full w-full border-0" />
            ) : null}
          </div>
          {frameState === 'unavailable' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6">
              <div className="max-w-sm space-y-3 text-center">
                <p className="font-semibold">Het voorbeeld laadt niet</p>
                <p className="text-sm text-muted-foreground">
                  Je SellQo-webshop op {slug}.sellqo.shop is nog niet actief, of hij reageert even niet. Je kan wel gewoon bewerken en opslaan.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setFrameState('loading'); setFrameKey((k) => k + 1); }}>Opnieuw proberen</Button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
