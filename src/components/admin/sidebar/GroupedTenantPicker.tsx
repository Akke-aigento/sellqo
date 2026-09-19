import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { TenantGroup, TenantGroupKey, GroupableTenant } from '@/lib/tenantGroups';

/** Zoekveld pas vanaf dit aantal winkels: daaronder is de lijst in één oogopslag te zien. */
const SEARCH_THRESHOLD = 8;

// Een 2px-lijntje links, via design tokens (src/index.css) — geen label of badge.
const GROUP_ACCENT: Record<TenantGroupKey, string> = {
  own: 'border-l-[color:var(--tenant-group-own)]',
  clients: 'border-l-[color:var(--tenant-group-clients)]',
  demo: 'border-l-[color:var(--tenant-group-demo)]',
};

interface Props<T extends GroupableTenant> {
  groups: TenantGroup<T>[];
  currentTenant: T | null;
  loading: boolean;
  onSelect: (tenant: T) => void;
}

/**
 * TENANT-SWITCHER-1 — winkelkiezer voor platform-admins: Mijn winkels / Klanten /
 * Demo (zie src/lib/tenantGroups.ts). cmdk levert de groepskoppen, het filteren
 * over alle groepen, het verbergen van lege groepen en de toetsenbordnavigatie.
 * De trigger is dezelfde knop als in de gewone kiezer.
 */
export function GroupedTenantPicker<T extends GroupableTenant>({ groups, currentTenant, loading, onSelect }: Props<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const total = groups.reduce((n, g) => n + g.tenants.length, 0);

  return (
    // `modal`: op mobiel zit de sidebar in een Sheet (Radix Dialog) met scroll-lock.
    // De popover rendert via een portal buiten die Sheet, dus zonder eigen lock
    // blokkeerde de Sheet het scrollen in de lijst. Modal geeft de popover een
    // eigen lock die zijn inhoud wél laat scrollen.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal"
          disabled={loading}
        >
          {loading ? (
            <Skeleton className="h-4 w-24" />
          ) : currentTenant ? (
            <span className="truncate">{currentTenant.name}</span>
          ) : (
            <span className="text-muted-foreground">{t('sidebar.selectStore')}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
        <Command
          defaultValue={currentTenant?.id}
          // Alleen op naam zoeken, niet op het id (een uuid bevat a-f en cijfers).
          filter={(_value, search, keywords) =>
            (keywords ?? []).join(' ').toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
          }
        >
          {total > SEARCH_THRESHOLD && <CommandInput placeholder={t('sidebar.searchStores')} />}
          <CommandList className="max-h-[min(360px,60vh)]">
            <CommandEmpty>{t('sidebar.noStores')}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.key} heading={t(`sidebar.storeGroups.${group.key}`)}>
                {group.tenants.map((tenant) => {
                  const isCurrent = currentTenant?.id === tenant.id;
                  return (
                    <CommandItem
                      key={tenant.id}
                      value={tenant.id}
                      keywords={[tenant.name]}
                      onSelect={() => {
                        onSelect(tenant);
                        setOpen(false);
                      }}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={cn('min-w-0 rounded-l-none border-l-2', GROUP_ACCENT[group.key], isCurrent && 'bg-accent')}
                    >
                      <Store className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{tenant.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
