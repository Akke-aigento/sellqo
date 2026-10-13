// THEME-PRESETS-1 — thema kiezen: startpakketten (uitstraling + homepage + teksten) uit
// het themaschema van de shop. Klikken = meteen live in het voorbeeld; pas "Opslaan"
// maakt het definitief, "Ongedaan maken" zet alles terug.
import { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ThemePreset } from './schemaTypes';
import { useTranslation } from 'react-i18next';

export function ThemeGallery({ presets, current, hasSections, onApply }: {
  presets: ThemePreset[]; current: string | null; hasSections: boolean;
  onApply: (p: ThemePreset, opts: { homepage: boolean; keepBrand: boolean }) => void;
}) {
  const { t } = useTranslation();
  // Lege homepage: de opbouw van het thema meteen meenemen. Al secties: alleen als je dat wil.
  const [homepage, setHomepage] = useState(!hasSections);
  const [keepBrand, setKeepBrand] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('admin.storefront.schema.themeGallery.intro')}
      </p>
      <div className="space-y-2.5 rounded-lg border p-3">
        <div className="flex items-start gap-2.5">
          <Checkbox id="tg-home" checked={homepage} onCheckedChange={(v) => setHomepage(v === true)} />
          <Label htmlFor="tg-home" className="font-normal leading-snug">{t('admin.storefront.schema.themeGallery.ook_de_homepage_opbouw_en_voorbeeldteksten')}</Label>
        </div>
        <div className="flex items-start gap-2.5">
          <Checkbox id="tg-brand" checked={keepBrand} onCheckedChange={(v) => setKeepBrand(v === true)} />
          <Label htmlFor="tg-brand" className="font-normal leading-snug">{t('admin.storefront.schema.themeGallery.mijn_eigen_merkkleur_behouden')}</Label>
        </div>
      </div>
      <div className="space-y-3">
        {presets.map((p) => {
          const on = current === p.id;
          const accent = p.preview.accent || '#0d9488';
          return (
            <div key={p.id} className={cn('overflow-hidden rounded-lg border-2 transition-colors hover:border-foreground/40', on ? 'border-foreground' : 'border-transparent ring-1 ring-border')}>
              <button type="button" onClick={() => onApply(p, { homepage, keepBrand })} className="block w-full text-left">
                {/* Miniatuur in de kleuren en letters van het thema. */}
                <div className="relative h-28" style={{ background: p.preview.background, color: p.preview.text }}>
                  {p.preview.image ? <img src={p.preview.image.replace('w=1600', 'w=600')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" loading="lazy" /> : null}
                  <div className="absolute inset-0 flex flex-col justify-end gap-1.5 p-3" style={p.preview.image ? { background: 'linear-gradient(to top, rgba(0,0,0,.55), transparent)', color: '#fff' } : undefined}>
                    <span className="text-lg font-bold leading-tight" style={{ fontFamily: p.theme.heading_font || undefined }}>{p.name}</span>
                    <span className="inline-flex w-fit items-center px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: accent, color: '#fff', borderRadius: p.settings.button_style === 'square' ? 0 : p.settings.button_style === 'rounded' ? 6 : 999 }}>
                      {t('admin.storefront.schema.themeGallery.bekijk')}
                    </span>
                  </div>
                  {on ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-4 w-4" /></span> : null}
                </div>
                <div className="bg-card px-3 pt-3">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
              </button>
              <div className="bg-card px-3 pb-3 pt-1.5">
                {p.example ? (
                  <a href={p.example.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {t('admin.storefront.schema.themeGallery.example_shop', { name: p.example.label })}<ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.storefront.schema.themeGallery.foto_s_in_de_thema_s')}</p>
    </div>
  );
}
