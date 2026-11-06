// MENUKAART-PRINT-1 — "Afdrukken" op de Kaart: een papieren menukaart als PDF in drie sjablonen
// (boekje A5, A4-kaart, fotokaft). Keuzes worden per zaak onthouden (useMenuPrintSettings).
// De PDF komt uit src/utils/menuCardPdf.ts; downloaden zoals de menu-QR's (QR-PRINT-1), geen
// afdrukvenster (werkt niet in Safari op gsm, de beginscherm-app en de native app).
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, Download, FileStack, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { groupWeek } from '@/lib/businessHours';
import { dayName } from '@/components/admin/settings/hours/dayNames';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { ALLERGENS, DIETARY } from '@/components/admin/storefront/food/allergens';
import { VisualMediaPicker } from '@/components/admin/storefront/visual-editor/VisualMediaPicker';
import { downloadPdf } from '@/utils/floorQrPdf';
import { generateMenuCardPdf, type MenuCardLabels } from '@/utils/menuCardPdf';
import { loadPdfImage } from '@/lib/menuPrintImages';
import {
  MENU_PRINT_SUBTITLE_MAX, MENU_PRINT_TEMPLATES, buildMenuSections, parseMenuPrintSettings,
  type MenuPrintOptions, type MenuPrintSettings, type MenuPrintTemplate, type MenuSourceCategory, type MenuSourceProduct,
} from '@/lib/menuPrint';
import { KAART_TYPES } from './useKaart';
import { useMenuPrintSettings } from './useMenuPrintSettings';

// De standaardfonts van een PDF kennen enkel het Latijnse schrift (WinAnsi); Cyrillisch zou
// getranslitereerd worden. De kaarttaal kiest dus uit de Latijnse talen van de bron.
const PRINT_LANGS = SUPPORTED_LANGUAGES.filter((l) => l.script === 'latin');
const OPTION_KEYS: { key: keyof Pick<MenuPrintOptions, 'descriptions' | 'allergens' | 'info' | 'qr'>; labelKey: string }[] = [
  { key: 'descriptions', labelKey: 'admin.kaart.print.opt.descriptions' },
  { key: 'allergens', labelKey: 'admin.kaart.print.opt.allergens' },
  { key: 'info', labelKey: 'admin.kaart.print.opt.info' },
  { key: 'qr', labelKey: 'admin.kaart.print.opt.qr' },
];

/** Kleine schets per sjabloon (geen echte voorvertoning; die is de PDF zelf). */
function Sketch({ template, accent, image }: { template: MenuPrintTemplate; accent: string; image: string | null }) {
  const lines = (x: number, y: number, w: number, n: number) => Array.from({ length: n }, (_, i) => (
    <g key={i}><rect x={x} y={y + i * 7} width={w * 0.62} height={2.2} rx={1} fill="#9ca3af" /><rect x={x + w * 0.86} y={y + i * 7} width={w * 0.14} height={2.2} rx={1} fill="#9ca3af" /></g>
  ));
  if (template === 'a4') {
    return (
      <svg viewBox="0 0 120 80" className="h-20 w-full" aria-hidden>
        <rect x="18" y="4" width="50" height="72" fill="#fff" stroke="#d1d5db" />
        <rect x="22" y="8" width="42" height="64" fill="none" stroke={accent} strokeWidth="0.8" />
        <rect x="31" y="30" width="24" height="3" fill="#374151" /><rect x="35" y="38" width="16" height="2" fill={accent} />
        <rect x="58" y="10" width="50" height="72" fill="#fff" stroke="#d1d5db" transform="translate(0,-6)" />
        <rect x="62" y="8" width="10" height="2" fill={accent} />{lines(62, 13, 19, 7)}
        <rect x="85" y="8" width="10" height="2" fill={accent} />{lines(85, 13, 19, 7)}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-full" aria-hidden>
      {/* Liggend A4-vel met de vouw in het midden. */}
      <rect x="6" y="10" width="108" height="62" fill="#fff" stroke="#d1d5db" />
      <line x1="60" y1="10" x2="60" y2="72" stroke="#d1d5db" strokeDasharray="2 2" />
      <rect x="12" y="16" width="10" height="2" fill={accent} />{lines(12, 21, 42, 7)}
      {template === 'photo_cover' ? (
        <>
          {image ? <image href={image} x="62" y="12" width="50" height="58" preserveAspectRatio="xMidYMid slice" /> : <rect x="62" y="12" width="50" height="58" fill="#e5e7eb" />}
          <rect x="62" y="56" width="50" height="14" fill={accent} opacity="0.9" />
          <rect x="74" y="61" width="26" height="2.5" fill="#fff" />
        </>
      ) : (
        <>
          <rect x="65" y="14" width="44" height="54" fill="none" stroke={accent} strokeWidth="0.8" />
          <rect x="75" y="32" width="24" height="3" fill="#374151" /><rect x="80" y="40" width="14" height="2" fill={accent} />
        </>
      )}
    </svg>
  );
}

interface PrintData { categories: MenuSourceCategory[]; products: MenuSourceProduct[] }

export function MenuPrintDialog({ open, onOpenChange, canWrite }: { open: boolean; onOpenChange: (o: boolean) => void; canWrite: boolean }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const { themeSettings } = useStorefront();
  const { data: hours } = useBusinessHours();
  const tenantId = currentTenant?.id;
  const { settings, save } = useMenuPrintSettings();
  const [draft, setDraft] = useState<MenuPrintSettings | null>(null);
  const [busy, setBusy] = useState<null | 'imposed' | 'pages'>(null);
  useEffect(() => { if (open && settings && !draft) setDraft(settings); }, [open, settings, draft]);
  useEffect(() => { if (!open) setDraft(null); }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['menu-print-data', tenantId],
    enabled: open && !!tenantId,
    queryFn: async (): Promise<PrintData> => {
      const [cats, prods] = await Promise.all([
        supabase.from('categories').select('id, name, sort_order, is_active, hide_from_storefront').eq('tenant_id', tenantId!),
        supabase.from('products').select('id, name, price, category_id, is_active, hide_from_storefront, channels, menu_position, short_description, description, allergens, dietary, featured_image')
          .eq('tenant_id', tenantId!).in('product_type', KAART_TYPES as never).limit(2000),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      return { categories: (cats.data ?? []) as MenuSourceCategory[], products: (prods.data ?? []) as unknown as MenuSourceProduct[] };
    },
  });

  const s = draft ?? settings ?? parseMenuPrintSettings(null);
  const lang = PRINT_LANGS.some((l) => l.code === s.options.language) ? s.options.language
    : PRINT_LANGS.some((l) => l.code === i18n.language) ? i18n.language : 'nl';
  const tp = useMemo(() => i18n.getFixedT(lang), [i18n, lang]);
  const sections = useMemo(() => (data ? buildMenuSections(data.categories, data.products, tp('admin.kaart.print.pdf.other')) : []), [data, tp]);
  const itemCount = sections.reduce((n, x) => n + x.items.length, 0);
  const photos = useMemo(() => [...new Set((data?.products ?? []).filter((p) => p.is_active && p.featured_image).map((p) => p.featured_image as string))].slice(0, 8), [data]);
  const accent = (themeSettings?.brand_color as string | undefined) || themeSettings?.primary_color || '#1c1c1e';
  const logoUrl = themeSettings?.logo_url || currentTenant?.logo_url || null;
  const slug = currentTenant?.slug || '';

  const update = (patch: Partial<Omit<MenuPrintSettings, 'options'>> & { options?: Partial<MenuPrintOptions> }) => {
    const next: MenuPrintSettings = { ...s, ...patch, options: { ...s.options, ...(patch.options ?? {}) } };
    setDraft(next);
    void save(next, canWrite);
  };

  const make = async (impose: boolean) => {
    setBusy(impose ? 'imposed' : 'pages');
    try {
      const o = s.options;
      const [logo, cover] = await Promise.all([
        loadPdfImage(logoUrl, 1200, true),
        s.template === 'photo_cover' ? loadPdfImage(s.coverImageUrl, 2000, false) : Promise.resolve(null),
      ]);
      const labels: MenuCardLabels = {
        coverTitle: tp('admin.kaart.print.pdf.cover_title'),
        continued: tp('admin.kaart.print.pdf.continued'),
        allergensTitle: tp('admin.kaart.print.pdf.allergens_title'),
        allergenNames: ALLERGENS.map((a) => tp(`admin.allergens.${a}`)),
        dietary: Object.fromEntries(DIETARY.map((d) => [d, { short: tp(`admin.kaart.print.pdf.diet.${d}`), label: tp(`admin.dietary.${d}`) }])),
        hoursTitle: tp('admin.kaart.print.pdf.hours_title'),
        qrCaption: tp('admin.kaart.print.pdf.qr_caption'),
        priceNote: tp('admin.kaart.print.pdf.price_note'),
      };
      const place = [currentTenant?.postal_code, currentTenant?.city].filter(Boolean).join(' ');
      const hourRows = o.info && hours ? groupWeek(hours.week).map((g) => ({
        days: g.days.length === 1 ? dayName(lang, g.days[0], 'short') : `${dayName(lang, g.days[0], 'short')} – ${dayName(lang, g.days[g.days.length - 1], 'short')}`,
        value: g.ranges.length ? g.ranges.map((r) => `${r[0]}–${r[1]}`).join(', ') : tp('admin.kaart.print.pdf.closed'),
      })) : [];
      const menuUrl = `https://${slug}.sellqo.shop/menu`;
      const result = await generateMenuCardPdf({
        template: s.template,
        storeName: currentTenant?.name || '',
        subtitle: o.subtitle.trim(),
        accent,
        logo,
        cover,
        sections,
        showDescriptions: o.descriptions,
        showAllergens: o.allergens,
        labels,
        back: {
          lines: o.info ? [currentTenant?.address, place, currentTenant?.phone, `${slug}.sellqo.shop`].filter((x): x is string => !!x && !!x.trim()) : [],
          hours: hourRows,
          qrUrl: o.qr && slug ? menuUrl : null,
          qrText: menuUrl.replace('https://', ''),
        },
        impose,
      });
      downloadPdf(result.bytes, `menukaart-${s.template}-${slug || 'kaart'}${impose ? '' : '-paginas'}.pdf`);
      toast.success(t('admin.kaart.print.done', { pages: result.pages, sheets: result.sheets }));
      if (logoUrl && (!logo || result.warnings.includes('logo'))) toast.warning(t('admin.kaart.print.warn_logo'));
      if (s.template === 'photo_cover' && s.coverImageUrl && result.warnings.includes('cover')) toast.warning(t('admin.kaart.print.warn_cover'));
    } catch (e) {
      toast.error(t('admin.kaart.print.failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  const booklet = s.template !== 'a4';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('admin.kaart.print.title')}</DialogTitle>
          <DialogDescription>{t('admin.kaart.print.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t('admin.kaart.print.template_label')}</legend>
            <div role="radiogroup" aria-label={t('admin.kaart.print.template_label')} className="grid gap-2 sm:grid-cols-3">
              {MENU_PRINT_TEMPLATES.map((tpl) => {
                const on = s.template === tpl;
                return (
                  <button key={tpl} type="button" role="radio" aria-checked={on} onClick={() => update({ template: tpl })}
                    className={cn('relative rounded-lg border-2 p-2 text-left transition-colors', on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                    {on ? <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden /> : null}
                    <Sketch template={tpl} accent={accent} image={tpl === 'photo_cover' ? s.coverImageUrl : null} />
                    <span className="mt-1 block text-sm font-medium">{t(`admin.kaart.print.tpl.${tpl}.title`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`admin.kaart.print.tpl.${tpl}.text`)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {s.template === 'photo_cover' ? (
            <div className="space-y-2">
              <Label>{t('admin.kaart.print.cover_label')}</Label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <VisualMediaPicker value={s.coverImageUrl ?? undefined} aspectRatio="portrait" className="w-32 shrink-0"
                  placeholder={t('admin.kaart.print.cover_pick')} onSelect={(url) => update({ coverImageUrl: url })} />
                <div className="min-w-0 flex-1 space-y-2">
                  {!s.coverImageUrl ? <p className="text-sm text-muted-foreground">{t('admin.kaart.print.cover_none')}</p> : null}
                  {photos.length ? (
                    <>
                      <p className="text-sm text-muted-foreground">{t('admin.kaart.print.cover_from_menu')}</p>
                      <div className="flex flex-wrap gap-2">
                        {photos.map((url) => (
                          <button key={url} type="button" onClick={() => update({ coverImageUrl: url })} aria-pressed={s.coverImageUrl === url}
                            aria-label={t('admin.kaart.print.cover_use_photo')}
                            className={cn('h-14 w-14 overflow-hidden rounded-md border-2', s.coverImageUrl === url ? 'border-primary' : 'border-transparent hover:border-muted-foreground/40')}>
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {OPTION_KEYS.map(({ key, labelKey }) => (
              <label key={key} className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span>{t(labelKey)}</span>
                <Switch checked={s.options[key]} onCheckedChange={(v) => update({ options: { [key]: v } })} />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-sub">{t('admin.kaart.print.subtitle_label')}</Label>
              <Input id="mp-sub" value={s.options.subtitle} maxLength={MENU_PRINT_SUBTITLE_MAX} placeholder={t('admin.kaart.print.subtitle_placeholder')}
                onChange={(e) => setDraft({ ...s, options: { ...s.options, subtitle: e.target.value } })}
                onBlur={(e) => update({ options: { subtitle: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-lang">{t('admin.kaart.print.language_label')}</Label>
              <select id="mp-lang" value={lang} onChange={(e) => update({ options: { language: e.target.value } })}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                {PRINT_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{t('admin.kaart.print.language_hint')}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-md bg-muted/40 p-3 text-sm">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-label={t('common.loading')} />
              : itemCount ? <p className="font-medium">{t('admin.kaart.print.summary', { categories: sections.length, count: itemCount })}</p>
              : <p>{t('admin.kaart.print.empty')}</p>}
            <p className="text-muted-foreground">{booklet ? t('admin.kaart.print.hint_booklet') : t('admin.kaart.print.hint_a4')}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!!busy || !itemCount} onClick={() => void make(true)} className="h-11 sm:h-10">
                {busy === 'imposed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{t('admin.kaart.print.download')}
              </Button>
              {booklet ? (
                <Button variant="ghost" disabled={!!busy || !itemCount} onClick={() => void make(false)} className="h-11 sm:h-10">
                  {busy === 'pages' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileStack className="mr-2 h-4 w-4" />}{t('admin.kaart.print.download_pages')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
