import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return 'admin.cockpit.header.greeting_morning';
  if (hour >= 12 && hour < 18) return 'admin.cockpit.header.greeting_afternoon';
  return 'admin.cockpit.header.greeting_evening';
}

/** Begroeting met voornaam + lokale datum en winkelnaam. */
export function CockpitHeader() {
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
  const metaName = (user?.user_metadata as { full_name?: unknown } | undefined)?.full_name;
  const fullName = profileName || (typeof metaName === 'string' ? metaName : '');
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';
  const greeting = t(greetingKey(now.getHours()));
  const date = format(now, 'EEEE d MMMM', { locale });

  return (
    <header className="flex flex-col gap-1">
      <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">
        {currentTenant?.name ? `${date} · ${currentTenant.name}` : date}
      </p>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
        {firstName ? t('admin.cockpit.header.greeting_name', { greeting, name: firstName }) : greeting}
      </h1>
    </header>
  );
}
