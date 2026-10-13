// FOOD-3 — QR-codes voor de menukaart (https://<winkel>.sellqo.shop/menu): een A4-poster,
// tafelkaartjes (4 per A4, elk met eigen tafelnummer) en stickers (12 per A4). Afdrukken
// gaat via de browser ("Opslaan als PDF" kan ook); de QR is een SVG, dus altijd scherp.
import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'react-qr-code';
import { Copy, ExternalLink, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { useTranslation } from 'react-i18next';

type Layout = 'poster' | 'tables' | 'stickers';
// Labels als i18n-key; `value` blijft de enum-waarde.
const LAYOUTS: { value: Layout; titleKey: string; textKey: string }[] = [
  { value: 'poster', titleKey: 'admin.storefront.food.qr_layout_poster', textKey: 'admin.storefront.food.qr_layout_poster_text' },
  { value: 'tables', titleKey: 'admin.storefront.food.qr_layout_tables', textKey: 'admin.storefront.food.qr_layout_tables_text' },
  { value: 'stickers', titleKey: 'admin.storefront.food.qr_layout_stickers', textKey: 'admin.storefront.food.qr_layout_stickers_text' },
];

// Afdrukken in een apart venster: alleen de A4-pagina's, met de stijlen van de admin.
// Zo zit er geen menu, zijbalk of schermverkleining in de weg.
function printSheets(sheets: React.ReactNode[], text: { title: string; blocked: string }) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { toast.error(text.blocked); return; }
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
  const body = renderToStaticMarkup(<>{sheets}</>);
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${text.title.replace(/[<>&]/g, '')}</title>${styles}
    <style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}.sq-sheet{box-shadow:none!important;break-after:page;page-break-after:always}</style>
    </head><body>${body}</body></html>`);
  w.document.close();
  // Wachten tot stylesheets en logo geladen zijn.
  let printed = false;
  const go = () => { if (printed) return; printed = true; try { w.focus(); w.print(); } catch { /* venster al dicht */ } };
  w.onload = go;
  setTimeout(go, 1500);
}

function Sheet({ children }: { children: React.ReactNode }) {
  // Echte A4-maat; op het scherm verkleind getoond.
  return (
    <div className="sq-sheet relative bg-white text-black shadow-md" style={{ width: '210mm', height: '297mm', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

export function MenuQrManager() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { themeSettings } = useStorefront();
  const slug = currentTenant?.slug || '';
  const base = `https://${slug}.sellqo.shop/menu`;
  const accent = (themeSettings?.brand_color as string | undefined) || themeSettings?.primary_color || '#111111';
  const logo = themeSettings?.logo_url || null;
  const storeName = currentTenant?.name || '';

  const [layout, setLayout] = useState<Layout>('poster');
  const [heading, setHeading] = useState(() => t('admin.storefront.food.qr_default_heading'));
  const [sub, setSub] = useState(() => t('admin.storefront.food.qr_default_sub'));
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(12);

  const tables = useMemo(() => {
    const a = Math.max(1, Math.min(from, to)); const b = Math.min(200, Math.max(from, to));
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }, [from, to]);
  const sheets = useMemo<React.ReactNode[]>(() => {
    if (layout === 'poster') {
      return [(
        <Sheet key="p">
          <div className="flex h-full flex-col items-center justify-center gap-[10mm] p-[18mm] text-center">
            {logo ? <img src={logo} alt="" style={{ maxHeight: '28mm', maxWidth: '120mm', objectFit: 'contain' }} /> : <div style={{ fontSize: '14mm', fontWeight: 800 }}>{storeName}</div>}
            <div style={{ fontSize: '17mm', fontWeight: 800, lineHeight: 1.05, color: accent }}>{heading}</div>
            <div style={{ padding: '6mm', border: `1.2mm solid ${accent}`, borderRadius: '6mm' }}><QRCode value={base} size={520} style={{ width: '120mm', height: '120mm' }} level="M" /></div>
            <div style={{ fontSize: '7mm' }}>{sub}</div>
            <div style={{ fontSize: '4.5mm', color: '#555' }}>{base.replace('https://', '')}</div>
          </div>
        </Sheet>
      )];
    }
    if (layout === 'tables') {
      const pages: React.ReactNode[] = [];
      for (let i = 0; i < tables.length; i += 4) {
        pages.push(
          <Sheet key={`t${i}`}>
            <div className="grid h-full grid-cols-2 grid-rows-2">
              {tables.slice(i, i + 4).map((n) => (
                <div key={n} className="flex flex-col items-center justify-center gap-[4mm] p-[8mm] text-center" style={{ border: '0.2mm dashed #bbb' }}>
                  <div style={{ fontSize: '5mm', fontWeight: 700, color: '#555' }}>{storeName}</div>
                  <div style={{ fontSize: '11mm', fontWeight: 800, color: accent }}>{t('admin.kitchen.table', { table: n })}</div>
                  <QRCode value={`${base}?tafel=${n}`} size={300} style={{ width: '62mm', height: '62mm' }} level="M" />
                  <div style={{ fontSize: '5.5mm', fontWeight: 700 }}>{heading}</div>
                  <div style={{ fontSize: '3.8mm', color: '#555' }}>{sub}</div>
                </div>
              ))}
            </div>
          </Sheet>,
        );
      }
      return pages;
    }
    return [(
      <Sheet key="s">
        <div className="grid h-full grid-cols-3 grid-rows-4 gap-[4mm] p-[8mm]">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-[2mm] rounded-[4mm] text-center" style={{ border: `0.6mm solid ${accent}` }}>
              <QRCode value={base} size={220} style={{ width: '42mm', height: '42mm' }} level="M" />
              <div style={{ fontSize: '4mm', fontWeight: 800, color: accent }}>{heading}</div>
            </div>
          ))}
        </div>
      </Sheet>
    )];
  }, [layout, tables, base, heading, sub, accent, logo, storeName, t]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.storefront.food.qr_card_title')}</CardTitle>
          <CardDescription>{t('admin.storefront.food.qr_card_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-sm">{base.replace('https://', '')}</code>
          <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(base); toast.success(t('admin.storefront.food.link_copied')); }}><Copy className="mr-1.5 h-4 w-4" />{t('admin.marketing.aIContentLibrary.kopieren')}</Button>
          <Button asChild variant="ghost" size="sm"><a href={base} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.menuQrManager.bekijk_menukaart')}</a></Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-2 sm:grid-cols-3">
            {LAYOUTS.map((l) => (
              <button key={l.value} type="button" onClick={() => setLayout(l.value)}
                className={cn('rounded-lg border-2 p-3 text-left', layout === l.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                <span className="block font-medium">{t(l.titleKey)}</span>
                <span className="block text-sm text-muted-foreground">{t(l.textKey)}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="qr-h">{t('admin.storefront.food.qr_heading')}</Label><Input id="qr-h" value={heading} maxLength={40} onChange={(e) => setHeading(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="qr-s">{t('admin.storefront.food.qr_sub')}</Label><Input id="qr-s" value={sub} maxLength={60} onChange={(e) => setSub(e.target.value)} /></div>
            {layout === 'tables' ? (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:max-w-sm">
                <div className="space-y-1.5"><Label htmlFor="qr-from">{t('admin.storefront.food.qr_from_table')}</Label><Input id="qr-from" inputMode="numeric" value={from} onChange={(e) => setFrom(parseInt(e.target.value, 10) || 1)} /></div>
                <div className="space-y-1.5"><Label htmlFor="qr-to">{t('admin.storefront.food.qr_to_table')}</Label><Input id="qr-to" inputMode="numeric" value={to} onChange={(e) => setTo(parseInt(e.target.value, 10) || 1)} /></div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => printSheets(sheets, { title: t('admin.storefront.food.qr_print_title'), blocked: t('admin.storefront.food.qr_popup_blocked') })}><Printer className="mr-2 h-4 w-4" />{t('admin.storefront.food.menuQrManager.afdrukken_of_opslaan_als_pdf')}</Button>
            <span className="text-sm text-muted-foreground">{t('admin.storefront.food.qr_print_hint', { count: sheets.length })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Voorbeeld: echte A4-pagina's, op het scherm verkleind. Dit is ook wat er geprint wordt. */}
      <div className="overflow-x-auto rounded-lg bg-muted/50 p-4">
        <div className="flex flex-col items-center gap-4">
          {sheets.map((s, i) => (
            <div key={i} className="origin-top" style={{ zoom: 0.42 }}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
