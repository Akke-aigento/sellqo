import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Monitor, Smartphone } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTenant } from '@/hooks/useTenant';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';

/**
 * MAIL-1b — voorbeeld van een mail in de echte huisstijl van de winkel.
 *
 * Vraagt de render aan render-campaign-preview (zelfde opmaak als de verzending),
 * met 600 ms debounce. Lukt dat niet, dan valt hij terug op `fallbackHtml`
 * (de lokale grijze wrapper van vroeger) en zegt hij dat erbij.
 */
export function BrandedEmailPreview({
  subject, bodyHtml, previewText, language, fallbackHtml, height = 420,
}: {
  subject: string;
  bodyHtml: string;
  previewText?: string;
  language?: string | null;
  fallbackHtml: string;
  height?: number;
}) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!currentTenant?.id) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await invokeWithErrorBody<{ html: string }>('render-campaign-preview', {
          body: {
            tenant_id: currentTenant.id,
            subject,
            html_content: bodyHtml,
            preview_text: previewText || undefined,
            language: language || undefined,
          },
        });
        if (!cancelled) { setHtml(res.html); setFailed(false); }
      } catch {
        if (!cancelled) { setHtml(null); setFailed(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(id); };
  }, [currentTenant?.id, subject, bodyHtml, previewText, language]);

  const width = device === 'mobile' ? 375 : 600;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {failed ? t('admin.marketing.brandedPreview.fallback') : t('admin.marketing.brandedPreview.real_style')}
        </span>
        <ToggleGroup type="single" size="sm" value={device} onValueChange={(v) => v && setDevice(v as 'desktop' | 'mobile')}>
          <ToggleGroupItem value="desktop" aria-label={t('admin.marketing.brandedPreview.desktop')} title={t('admin.marketing.brandedPreview.desktop')}>
            <Monitor className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label={t('admin.marketing.brandedPreview.mobile')} title={t('admin.marketing.brandedPreview.mobile')}>
            <Smartphone className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="overflow-x-auto rounded-md bg-muted/40 p-2">
        <iframe
          srcDoc={html ?? fallbackHtml}
          style={{ width, height, maxWidth: 'none' }}
          className="mx-auto block bg-white rounded border transition-[width]"
          sandbox=""
          title={t('admin.marketing.emailPreview.email_preview')}
        />
      </div>
    </div>
  );
}
