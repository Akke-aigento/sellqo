import { Globe, EyeOff, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useStorefront } from '@/hooks/useStorefront';
import type { StorefrontStatus } from '@/types/storefront';

const OPTIONS: Array<{
  value: StorefrontStatus;
  icon: typeof Globe;
  title: string;
  description: string;
}> = [
  {
    value: 'online',
    icon: Globe,
    title: 'Online',
    description: 'Iedereen kan je winkel bezoeken en bestellen.',
  },
  {
    value: 'offline',
    icon: EyeOff,
    title: 'Offline',
    description: 'Bezoekers zien een "binnenkort open"-pagina. Handig terwijl je inricht.',
  },
];

/**
 * Zichtbaarheid van de SellQo-winkel.
 *
 * Alleen online/offline: wachtwoordbeveiliging vraagt om server-side
 * verificatie (`storefront_password` zit niet in de publieke view) en wordt
 * daarom pas aangeboden zodra die er is.
 */
export function StatusSection() {
  const { themeSettings, saveThemeSettings, settingsLoading } = useStorefront();

  const stored = themeSettings?.storefront_status ?? null;

  // Er bestaan waarden in de database die deze sectie niet aanbiedt — VanXcel
  // staat bijvoorbeeld op 'password'. Die mogen we niet als 'online' tonen en
  // al helemaal niet stilzwijgend overschrijven: dan verliest een live tenant
  // zijn instelling doordat de UI iets anders liet zien dan er stond.
  const isKnown = stored === null || stored === 'online' || stored === 'offline';
  const current: StorefrontStatus | undefined = isKnown
    ? stored === 'offline'
      ? 'offline'
      : 'online'
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Status
        </CardTitle>
        <CardDescription>Bepaal of bezoekers je winkel kunnen zien.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isKnown && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="text-amber-900 dark:text-amber-100">
              Deze winkel staat op <strong>{stored}</strong> — een instelling die
              hier niet beheerd wordt. Kies je hieronder iets, dan vervang je die
              waarde.
            </span>
          </div>
        )}

        <RadioGroup
          value={current}
          onValueChange={(value) =>
            saveThemeSettings.mutate({ storefront_status: value as StorefrontStatus })
          }
          disabled={settingsLoading || saveThemeSettings.isPending}
          className="gap-3"
        >
          {OPTIONS.map((option) => {
            const isActive = current === option.value;
            return (
              <Label
                key={option.value}
                htmlFor={`status-${option.value}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                  isActive ? 'border-primary bg-muted/40' : 'hover:bg-muted/30'
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`status-${option.value}`}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <option.icon className="h-3.5 w-3.5" />
                    {option.title}
                  </div>
                  <p className="text-xs font-normal text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>

        {saveThemeSettings.isPending && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Opslaan…
          </p>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Dit geldt alleen voor de ingebouwde SellQo-winkel. Draai je een eigen
            frontend, dan bepaalt die zelf wat bezoekers te zien krijgen.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
