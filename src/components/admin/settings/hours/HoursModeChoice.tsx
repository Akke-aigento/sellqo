// UREN-1 — "Zelfde als openingsuren" of "Eigen uren" voor afhalen, leveren of online reserveren.
// Zelfde als: de openingsuren uit Instellingen › Bedrijf (alleen lezen hier, met een link).
// Eigen uren: de bestaande editor van dat scherm (children).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { weekHasRanges, type HoursMode } from '@/lib/businessHours';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { BusinessHoursSummary } from './BusinessHoursSummary';

export const BUSINESS_HOURS_URL = '/admin/settings?section=company#openingsuren';

export function HoursModeChoice({ id, mode, onChange, children, disabled = false }: {
  id: string; mode: HoursMode; onChange: (m: HoursMode) => void; children: ReactNode; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data: hours, isLoading } = useBusinessHours();
  const empty = !isLoading && !weekHasRanges(hours?.week);
  return (
    <div className="space-y-3">
      <RadioGroup value={mode} onValueChange={(v) => onChange(v as HoursMode)} className="flex flex-wrap gap-x-6 gap-y-2" disabled={disabled}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="business" id={`${id}-business`} />
          <Label htmlFor={`${id}-business`} className="font-normal">{t('settings.businessHours.mode_business')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="own" id={`${id}-own`} />
          <Label htmlFor={`${id}-own`} className="font-normal">{t('settings.businessHours.mode_own')}</Label>
        </div>
      </RadioGroup>
      {mode === 'business' ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          {empty ? (
            <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t('settings.businessHours.mode_business_empty')}
            </p>
          ) : hours ? <BusinessHoursSummary hours={hours} /> : null}
          <Link to={BUSINESS_HOURS_URL} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {empty ? t('settings.businessHours.fill_in') : t('settings.businessHours.edit_link')}<ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : children}
    </div>
  );
}
