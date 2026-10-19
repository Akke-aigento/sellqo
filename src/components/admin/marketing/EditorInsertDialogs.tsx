import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, ImageIcon, LayoutGrid, List, Loader2, Package, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaAssets } from '@/hooks/useMediaAssets';
import { useTenant } from '@/hooks/useTenant';
import { useTenantBrand } from '@/hooks/useTenantBrand';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  PRODUCT_BLOCK_MAX,
  formatBlockPrice,
  normalizeProductBlock,
  type ProductBlockData,
  type ProductBlockLayout,
} from '@/lib/emailProductBlock';
import {
  hasProductUrls,
  loadStorefrontUrlContext,
  productUrlFor,
  type StorefrontUrlContext,
  type StorefrontUrlDb,
} from '../../../../supabase/functions/_shared/storefrontUrls';

/**
 * MAIL-1b — dialogen voor de e-maileditor (CampaignRichEditor), ter vervanging
 * van window.prompt. Enkel http(s)- en mailto-links; afbeeldingen enkel https,
 * want mailclients tonen geen http-afbeeldingen of data-URL's.
 */
function normalizeLinkUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (/^\{\{[a-z_]+\}\}$/i.test(v)) return v; // variabele zoals {{company_website}}
  if (/^[^\s/]+\.[^\s]+/.test(v)) return `https://${v}`;
  return null;
}

export function LinkDialog({
  open, onOpenChange, initialUrl, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialUrl?: string;
  /** null = link verwijderen */
  onSubmit: (url: string | null) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  useEffect(() => { if (open) setUrl(initialUrl || ''); }, [open, initialUrl]);
  const normalized = normalizeLinkUrl(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{t('admin.marketing.editorInsert.link_title')}</DialogTitle>
          <DialogDescription>{t('admin.marketing.editorInsert.link_explain')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // De editor staat zelf in het campagne-/templateformulier; React laat
            // submit door de portal heen bubbelen, dus hier stoppen.
            e.stopPropagation();
            if (normalized) { onSubmit(normalized); onOpenChange(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="editor-link-url">{t('admin.marketing.editorInsert.link_url')}</Label>
            <Input
              id="editor-link-url"
              autoFocus
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url.trim() !== '' && !normalized && (
              <p className="text-xs text-destructive">{t('admin.marketing.editorInsert.link_invalid')}</p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {initialUrl && (
              <Button type="button" variant="outline" className="sm:mr-auto" onClick={() => { onSubmit(null); onOpenChange(false); }}>
                {t('admin.marketing.editorInsert.link_remove')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!normalized}>{t('admin.marketing.editorInsert.apply')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImageInsertDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (image: { src: string; alt: string }) => void;
}) {
  const { t } = useTranslation();
  const { assets, isLoading, incrementUsage } = useMediaAssets('all');
  const [tab, setTab] = useState<'library' | 'url'>('library');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');

  useEffect(() => {
    if (open) { setSearch(''); setSelectedId(null); setUrl(''); setAlt(''); }
  }, [open]);

  const images = useMemo(() => {
    const list = assets.filter((a) => (a.file_type || '').startsWith('image/') || !a.file_type);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.file_name.toLowerCase().includes(q)
      || a.title?.toLowerCase().includes(q)
      || a.alt_text?.toLowerCase().includes(q)
      || a.tags?.some((tag) => tag.toLowerCase().includes(q)));
  }, [assets, search]);

  const selected = images.find((a) => a.id === selectedId) || null;
  const urlOk = /^https:\/\/\S+$/i.test(url.trim());

  const confirm = () => {
    if (tab === 'library' && selected) {
      incrementUsage.mutate(selected.id);
      onSubmit({ src: selected.file_url, alt: alt.trim() || selected.alt_text || selected.title || '' });
    } else if (tab === 'url' && urlOk) {
      onSubmit({ src: url.trim(), alt: alt.trim() });
    } else {
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('admin.marketing.editorInsert.image_title')}</DialogTitle>
          <DialogDescription>{t('admin.marketing.editorInsert.image_explain')}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'library' | 'url')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="self-start">
            <TabsTrigger value="library">{t('admin.marketing.editorInsert.tab_library')}</TabsTrigger>
            <TabsTrigger value="url">{t('admin.marketing.editorInsert.tab_url')}</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="flex-1 min-h-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ScrollArea className="h-[40vh] -mx-2 px-2">
              {isLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : images.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{search ? t('admin.marketing.editorInsert.no_results') : t('admin.marketing.editorInsert.library_empty')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-1">
                  {images.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      title={a.title || a.file_name}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        selectedId === a.id ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-muted-foreground/30',
                      )}
                    >
                      <img src={a.file_url} alt={a.alt_text || a.title || a.file_name} className="w-full h-full object-cover" loading="lazy" />
                      {selectedId === a.id && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="url" className="space-y-1.5">
            <Label htmlFor="editor-image-url">{t('admin.marketing.editorInsert.image_url')}</Label>
            <Input id="editor-image-url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            {url.trim() !== '' && !urlOk && (
              <p className="text-xs text-destructive">{t('admin.marketing.editorInsert.image_url_invalid')}</p>
            )}
          </TabsContent>
        </Tabs>
        <div className="space-y-1.5">
          <Label htmlFor="editor-image-alt">{t('admin.marketing.editorInsert.image_alt')}</Label>
          <Input id="editor-image-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={selected?.alt_text || selected?.title || ''} />
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="button" onClick={confirm} disabled={tab === 'library' ? !selected : !urlOk}>
            {t('admin.marketing.editorInsert.insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PickProduct {
  id: string;
  name: string;
  slug: string | null;
  price: number | null;
  featured_image: string | null;
  images: string[] | null;
}

const HTTPS_IMG = /^https:\/\/\S+$/i;
const firstImage = (p: PickProduct) =>
  [p.featured_image, ...(Array.isArray(p.images) ? p.images : [])].find((u) => typeof u === 'string' && HTTPS_IMG.test(u)) || null;
const hex6 = (v: string | undefined) => {
  const s = (v || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s.slice(1).split('').map((c) => c + c).join('')}`;
  return '#111111';
};
/** ilike-jokers in een zoekterm letterlijk nemen. */
const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * MAIL-2c — productblok invoegen: zoek actieve producten van de winkel, kies er 1 tot 4, kies
 * raster of lijst. Prijs = de huidige prijs op het moment van invoegen (geen doorstreepte prijs).
 * Kent SellQo geen publieke productlink voor deze winkel, dan zegt de dialoog dat en komt het blok
 * er zonder knop en zonder link in.
 */
export function ProductInsertDialog({
  open, onOpenChange, onSubmit, emailLanguage,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (block: ProductBlockData) => void;
  /** Taal van de mail (prijsnotatie en standaardknoptekst). */
  emailLanguage?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const { data: brand } = useTenantBrand();
  const lang = (emailLanguage || brand?.defaultLocale || 'nl').slice(0, 2);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PickProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickProduct[]>([]);
  const [layout, setLayout] = useState<ProductBlockLayout>('grid');
  const [buttonLabel, setButtonLabel] = useState('');
  const [urlCtx, setUrlCtx] = useState<StorefrontUrlContext | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch(''); setSelected([]); setLayout('grid');
    setButtonLabel(i18n.t('admin.marketing.productBlock.button_default', { lng: lang }));
  }, [open, lang, i18n]);

  useEffect(() => {
    if (!open || !currentTenant?.id) return;
    let cancelled = false;
    setUrlCtx(null);
    loadStorefrontUrlContext(supabase as unknown as StorefrontUrlDb, currentTenant.id)
      .then((ctx) => { if (!cancelled) setUrlCtx(ctx); });
    return () => { cancelled = true; };
  }, [open, currentTenant?.id]);

  useEffect(() => {
    if (!open || !currentTenant?.id) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from('products')
        .select('id, name, slug, price, featured_image, images')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .or('hide_from_storefront.is.null,hide_from_storefront.eq.false')
        .order('name')
        .limit(30);
      const term = search.trim();
      if (term) q = q.ilike('name', likeTerm(term));
      const { data, error } = await q;
      if (!cancelled) {
        setResults(error ? [] : ((data || []) as PickProduct[]));
        setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [open, search, currentTenant?.id]);

  const linksKnown = urlCtx ? hasProductUrls(urlCtx) : false;
  const toggle = (p: PickProduct) => {
    setSelected((cur) => cur.some((x) => x.id === p.id)
      ? cur.filter((x) => x.id !== p.id)
      : cur.length >= PRODUCT_BLOCK_MAX ? cur : [...cur, p]);
  };

  const confirm = () => {
    if (!selected.length || !urlCtx) return;
    const block = normalizeProductBlock({
      v: 1,
      layout,
      button: buttonLabel.trim(),
      color: hex6(brand?.primaryColor),
      items: selected.map((p) => ({
        name: p.name,
        price: formatBlockPrice(p.price, currentTenant?.currency || 'EUR', lang),
        image: firstImage(p),
        url: productUrlFor(urlCtx, p.slug),
      })),
    });
    if (!block) return;
    onSubmit(block);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('admin.marketing.productBlock.title')}</DialogTitle>
          <DialogDescription>{t('admin.marketing.productBlock.explain', { max: PRODUCT_BLOCK_MAX })}</DialogDescription>
        </DialogHeader>
        {urlCtx && !linksKnown && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{t('admin.marketing.productBlock.no_links')}</p>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t('admin.marketing.productBlock.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="h-[34vh] -mx-2 px-2">
          {loading && !results.length ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? t('admin.marketing.editorInsert.no_results') : t('admin.marketing.productBlock.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-1">
              {results.map((p) => {
                const idx = selected.findIndex((x) => x.id === p.id);
                const img = firstImage(p);
                const full = idx < 0 && selected.length >= PRODUCT_BLOCK_MAX;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => toggle(p)}
                    disabled={full}
                    aria-pressed={idx >= 0}
                    className={cn(
                      'relative rounded-lg border-2 p-2 text-left transition-all disabled:opacity-40',
                      idx >= 0 ? 'border-primary ring-1 ring-primary' : 'border-transparent bg-muted/40 hover:border-muted-foreground/30',
                    )}
                  >
                    <div className="aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
                      {img ? <img src={img} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <Package className="h-8 w-8 opacity-30" />}
                    </div>
                    <p className="mt-1.5 text-xs font-medium line-clamp-2">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBlockPrice(p.price, currentTenant?.currency || 'EUR', lang)}</p>
                    {idx >= 0 && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
                        {idx + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('admin.marketing.productBlock.layout')}</Label>
            <ToggleGroup type="single" value={layout} onValueChange={(v) => v && setLayout(v as ProductBlockLayout)} className="justify-start">
              <ToggleGroupItem value="grid" className="gap-1.5"><LayoutGrid className="h-4 w-4" />{t('admin.marketing.productBlock.layout_grid')}</ToggleGroupItem>
              <ToggleGroupItem value="list" className="gap-1.5"><List className="h-4 w-4" />{t('admin.marketing.productBlock.layout_list')}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {linksKnown && (
            <div className="space-y-1.5">
              <Label htmlFor="product-block-button">{t('admin.marketing.productBlock.button_label')}</Label>
              <Input id="product-block-button" value={buttonLabel} maxLength={40} onChange={(e) => setButtonLabel(e.target.value)} />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('admin.marketing.productBlock.price_note')}</p>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <span className="text-xs text-muted-foreground sm:mr-auto self-center">
            {t('admin.marketing.productBlock.selected', { n: selected.length, max: PRODUCT_BLOCK_MAX })}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="button" onClick={confirm} disabled={!selected.length || !urlCtx}>
            {!urlCtx && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('admin.marketing.editorInsert.insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
