import { useState } from 'react';
import {
  ShoppingCart, FileText, CreditCard, Users, Package, FileEdit,
  RefreshCw, Megaphone, UserPlus, Settings, MessageSquare,
  Bell, ChevronDown, ChevronRight, Loader2, Smartphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelSwitch } from '@/components/admin/settings/NotificationSettings';
import { useUserNotificationPreferences } from '@/hooks/useUserNotificationPreferences';
import { useScopedRoles } from '@/hooks/useCan';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { canReceiveNotificationCategory } from '@/lib/notificationResources';
import { NOTIFICATION_CONFIG, type NotificationCategoryConfig } from '@/types/notification';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, React.ElementType> = {
  ShoppingCart, FileText, CreditCard, Users, Package, FileEdit,
  RefreshCw, Megaphone, UserPlus, Settings, MessageSquare,
};

type Prefs = ReturnType<typeof useUserNotificationPreferences>;

function PushCategorySection({
  config,
  permitted,
  isPushEnabled,
  setPush,
  isSaving,
}: {
  config: NotificationCategoryConfig;
  /**
   * `false` voor een categorie die niet meer bij je rol hoort, maar waar nog
   * push voor aan staat. Die komt dan nog binnen — de server kent de
   * rolmatrix niet (zie notificationResources.ts) — dus hij moet hier
   * uitgezet kunnen worden. Aanzetten kan niet meer.
   */
  permitted: boolean;
  isPushEnabled: Prefs['isPushEnabled'];
  setPush: Prefs['setPush'];
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(!permitted);
  const Icon = categoryIcons[config.icon] || Bell;
  const pushLabel = t('settings.notifications.push');

  const enabledCount = config.types.filter(tc => isPushEnabled(config.category, tc.type)).length;
  const allOn = enabledCount === config.types.length;

  const toggleAll = async (checked: boolean) => {
    const ok = await setPush(config.category, config.types.map(tc => tc.type), checked);
    if (!ok) return;
    toast({
      title: t('settings.notifications.saved'),
      description: t(
        checked ? 'settings.notifications.categoryEnabled' : 'settings.notifications.categoryDisabled',
        { channel: pushLabel, category: config.label },
      ),
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50 cursor-pointer rounded-lg border">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg shrink-0',
              isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">
                {permitted
                  ? t('settings.notifications.typesCount', { count: config.types.length })
                  : t('settings.myNotifications.notInRole')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{enabledCount}/{config.types.length}</span>
            </span>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border rounded-lg p-4 space-y-4">
          {permitted && (
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <span className="min-w-0 truncate text-sm font-medium">
                {t('settings.notifications.allOf', { label: config.label.toLowerCase() })}
              </span>
              <ChannelSwitch
                icon={Smartphone}
                label={`${pushLabel} — ${config.label}`}
                checked={allOn}
                onCheckedChange={toggleAll}
                disabled={isSaving}
              />
            </div>
          )}

          <div className="space-y-3">
            {config.types.map(typeConfig => {
              const checked = isPushEnabled(config.category, typeConfig.type);
              // Buiten je rol tonen we alleen wat nog aan staat: dat is het
              // enige waar je iets mee kunt.
              if (!permitted && !checked) return null;
              return (
                // Eén schakelaar past naast het label, ook op 375px; de tekst
                // krijgt min-w-0 + truncate zodat hij hem niet wegduwt.
                <div key={typeConfig.type} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Label className="block truncate text-sm font-normal">{typeConfig.label}</Label>
                    <p className="text-xs text-muted-foreground truncate">{typeConfig.description}</p>
                  </div>
                  <ChannelSwitch
                    icon={Smartphone}
                    label={`${pushLabel} — ${typeConfig.label}`}
                    checked={checked}
                    onCheckedChange={(value) => setPush(config.category, [typeConfig.type], value)}
                    disabled={isSaving || (!permitted && !checked)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * PUSH-2 — Mijn meldingen: welke meldingen jíj als push op je telefoon krijgt,
 * voor de winkel die open staat.
 *
 * Staat in de groep Account, zonder rolbeperking: elk teamlid moet push voor
 * zichzelf kunnen aanzetten. "Winkel Notificaties" eist settings_general, en
 * daar zou de helft van het team nooit bij kunnen.
 *
 * Welke categorieën je ziet, volgt je leesrechten in deze winkel — een
 * magazijnmedewerker krijgt geen schakelaar voor facturen.
 */
export function MyNotificationSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const roles = useScopedRoles();
  const { isLoading, isSaving, isPushEnabled, setPush } = useUserNotificationPreferences();

  if (!currentTenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.myNotifications.title')}</CardTitle>
          <CardDescription>{t('settings.myNotifications.noTenant')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading || roles === null) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const sections = NOTIFICATION_CONFIG
    .map(config => ({
      config,
      permitted: canReceiveNotificationCategory(roles, config.category),
      hasEnabled: config.types.some(tc => isPushEnabled(config.category, tc.type)),
    }))
    .filter(s => s.permitted || s.hasEnabled);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 shrink-0" />
              {t('settings.myNotifications.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.myNotifications.description', { shop: currentTenant.name })}
            </CardDescription>
          </div>
          {isSaving && (
            <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              {t('common.saving')}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p>{t('settings.myNotifications.onlyYou')}</p>
          <p>{t('settings.notifications.pushHint')}</p>
        </div>

        <div className="space-y-3">
          {sections.map(({ config, permitted }) => (
            <PushCategorySection
              key={config.category}
              config={config}
              permitted={permitted}
              isPushEnabled={isPushEnabled}
              setPush={setPush}
              isSaving={isSaving}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
