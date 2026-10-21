import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Daypart = 'morning' | 'afternoon' | 'evening';

function daypart(hour: number): Daypart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/** Zachte band achter de kop die met het dagdeel meekleurt. */
const BAND: Record<Daypart, string> = {
  morning: 'bg-orange-50 dark:bg-orange-950/30',
  afternoon: 'bg-sky-50 dark:bg-sky-950/30',
  evening: 'bg-indigo-50 dark:bg-indigo-950/30',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '•';

interface Props {
  /** Statuslabels rechts (bv. "Kassa open sinds 16:02"). */
  pills?: ReactNode;
  onCustomize: () => void;
}

/** DASH-2b — begroeting met logo, datum en winkelnaam op een band die met het dagdeel meekleurt. */
export function CockpitHeader({ pills, onCustomize }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const locale = useDateFnsLocale();

  const { data: profileName } = useQuery({
    queryKey: ['cockpit-profile-name', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle();
      return data?.full_name ?? null;
    },
  });

  const now = new Date();
  const part = daypart(now.getHours());
  const metaName = (user?.user_metadata as { full_name?: unknown } | undefined)?.full_name;
  const fullName = profileName || (typeof metaName === 'string' ? metaName : '');
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';
  const greeting = t(`admin.cockpit.header.greeting_${part}`);
  const date = format(now, 'EEEE d MMMM', { locale });
  const shopName = currentTenant?.name ?? '';

  return (
    <header className={cn('rounded-2xl px-4 pb-20 pt-5 md:px-6 md:pb-24 md:pt-7', BAND[part])}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          {currentTenant?.logo_url ? (
            <ShopLogo key={currentTenant.logo_url} src={currentTenant.logo_url} />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1D3A5C] text-base font-extrabold text-white md:h-14 md:w-14 md:text-xl"
            >
              {initials(shopName)}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-muted-foreground first-letter:uppercase">
              {shopName ? `${date} · ${shopName}` : date}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              {firstName ? t('admin.cockpit.header.greeting_name', { greeting, name: firstName }) : greeting}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pills}
          <Button variant="outline" className="h-11 gap-2 bg-background" onClick={onCustomize}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {t('admin.cockpit.customize.button')}
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Winkellogo op een achtergrond die erbij past: een wit logo (vaak voor donkere sites) zou op
 * wit onzichtbaar zijn. We meten de gemiddelde helderheid van de zichtbare pixels; lukt dat niet
 * (CORS), dan blijft het wit.
 */
function ShopLogo({ src }: { src: string }) {
  const [dark, setDark] = useState(false);
  // Weigert de host CORS, dan laadt een crossOrigin-afbeelding niet: opnieuw zonder, dan maar wit.
  const [noCors, setNoCors] = useState(false);
  const measure = (img: HTMLImageElement) => {
    try {
      const size = 24;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      const px = ctx.getImageData(0, 0, size, size).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 64) continue;
        sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        n += 1;
      }
      setDark(n > 0 && sum / n > 215);
    } catch {
      // Geen toegang tot de pixels: witte achtergrond houden.
    }
  };
  return (
    <img
      src={src}
      alt=""
      crossOrigin={noCors ? undefined : 'anonymous'}
      onLoad={(e) => !noCors && measure(e.currentTarget)}
      onError={() => !noCors && setNoCors(true)}
      className={cn(
        'h-11 w-11 shrink-0 rounded-xl object-contain p-1.5 shadow-sm md:h-14 md:w-14',
        dark ? 'bg-[#1D3A5C]' : 'bg-white',
      )}
    />
  );
}

/** Klein statuslabel voor in de kop. */
export function CockpitPill({ children, live }: { children: ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full border bg-background px-3 text-sm font-semibold">
      {live && <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />}
      {children}
    </span>
  );
}
