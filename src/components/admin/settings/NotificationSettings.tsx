import { useState, useEffect } from 'react';
import {
  ShoppingCart, FileText, CreditCard, Users, Package, FileEdit,
  RefreshCw, Megaphone, UserPlus, Settings, ChevronDown, ChevronRight,
  Bell, Mail, Loader2, Volume2, VolumeX, MessageSquare, AtSign, Newspaper, Smartphone
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotificationSettings, channelDefaults, type NotificationChannel } from '@/hooks/useNotificationSettings';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { NOTIFICATION_CONFIG, type NotificationCategoryConfig, type NotificationTypeConfig } from '@/types/notification';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const categoryIcons: Record<string, React.ElementType> = {
  ShoppingCart, FileText, CreditCard, Users, Package, FileEdit,
  RefreshCw, Megaphone, UserPlus, Settings, MessageSquare,
};

const CHANNELS: { channel: NotificationChannel; icon: React.ElementType; labelKey: string; field: 'in_app_enabled' | 'email_enabled' | 'push_enabled' }[] = [
  { channel: 'in_app', icon: Bell, labelKey: 'settings.notifications.inApp', field: 'in_app_enabled' },
  { channel: 'email', icon: Mail, labelKey: 'settings.notifications.email', field: 'email_enabled' },
  { channel: 'push', icon: Smartphone, labelKey: 'settings.notifications.push', field: 'push_enabled' },
];

/**
 * Eén schakelaar met zijn icoon ernaast en een toegankelijke naam.
 *
 * Tot 13 september 2026 stonden de schakelaars per type naamloos naast elkaar —
 * geen icoon, geen label, geen aria-label. Alleen de volgorde vertelde welke
 * welke was, en de legenda die dat uitlegde stond buiten de uitklapper. Met
 * twee kanalen ging dat nog net; met drie niet meer.
 */
function ChannelSwitch({
  icon: Icon, label, checked, onCheckedChange, disabled,
}: {
  icon: React.ElementType;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

function CategorySection({
  config,
  getSettingValue,
  updateSetting,
  toggleCategoryChannel,
  isSaving,
}: {
  config: NotificationCategoryConfig;
  getSettingValue: ReturnType<typeof useNotificationSettings>['getSettingValue'];
  updateSetting: ReturnType<typeof useNotificationSettings>['updateSetting'];
  toggleCategoryChannel: ReturnType<typeof useNotificationSettings>['toggleCategoryChannel'];
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const Icon = categoryIcons[config.icon] || Bell;

  const valueOf = (typeConfig: NotificationTypeConfig) =>
    getSettingValue(config.category, typeConfig.type, channelDefaults(typeConfig));

  // Per kanaal: hoeveel types staan aan.
  const counts = CHANNELS.map(({ field }) =>
    config.types.filter(typeConfig => valueOf(typeConfig)[field]).length,
  );

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
                {t('settings.notifications.typesCount', { count: config.types.length })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* Op een telefoon verdwijnen de tellers: drie paren iconen en
                breuken naast een uitklappijl passen niet op 375px, en de
                schakelaars zelf staan één tik verder. */}
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              {CHANNELS.map(({ channel, icon: ChannelIcon }, i) => (
                <span key={channel} className="flex items-center gap-1">
                  <ChannelIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{counts[i]}/{config.types.length}</span>
                </span>
              ))}
            </div>
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
          {/* Alles in één keer, per kanaal */}
          <div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">
              {t('settings.notifications.allOf', { label: config.label.toLowerCase() })}
            </span>
            <div className="flex items-center gap-4">
              {CHANNELS.map(({ channel, icon, labelKey }, i) => (
                <ChannelSwitch
                  key={channel}
                  icon={icon}
                  label={`${t(labelKey)} — ${config.label}`}
                  checked={counts[i] === config.types.length}
                  onCheckedChange={(checked) =>
                    toggleCategoryChannel(channel, config.category, checked, config.types, config.label)
                  }
                  disabled={isSaving}
                />
              ))}
            </div>
          </div>

          {/* Per type */}
          <div className="space-y-3">
            {config.types.map(typeConfig => {
              const value = valueOf(typeConfig);

              return (
                /*
                  Op een telefoon staan de schakelaars ónder het label. Ernaast
                  paste niet: gemeten op 375px blijft er binnen de kaart 263px
                  over, en drie schakelaars van 44px met tussenruimte laten dan
                  ~83px voor een label als "Terugbetaling aangevraagd". Dat werd
                  drie regels en de rijen sprongen. Vanaf sm: blijft het naast
                  elkaar, zoals het was.
                */
                <div
                  key={typeConfig.type}
                  className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 sm:pr-4">
                    <Label className="block truncate text-sm font-normal">{typeConfig.label}</Label>
                    <p className="text-xs text-muted-foreground truncate">{typeConfig.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {CHANNELS.map(({ channel, icon, labelKey, field }) => (
                      <ChannelSwitch
                        key={channel}
                        icon={icon}
                        label={`${t(labelKey)} — ${typeConfig.label}`}
                        checked={value[field]}
                        onCheckedChange={(checked) =>
                          updateSetting(
                            config.category,
                            typeConfig.type,
                            { [field]: checked },
                            channelDefaults(typeConfig),
                          )
                        }
                        disabled={isSaving}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NotificationSettings() {
  const {
    isLoading,
    isSaving,
    getSettingValue,
    updateSetting,
    toggleCategoryChannel,
  } = useNotificationSettings();
  
  const { enabled: soundEnabled, toggleEnabled: toggleSound } = useNotificationSound();
  const { currentTenant, refreshTenants } = useTenant();
  const { t } = useTranslation();

  // Platform newsletter opt-in (SellQo product news)
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [isSavingNewsletter, setIsSavingNewsletter] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      setNewsletterOptIn(currentTenant.platform_newsletter_opt_in ?? true);
    }
  }, [currentTenant]);

  const handleToggleNewsletter = async (checked: boolean) => {
    if (!currentTenant) return;
    const previous = newsletterOptIn;
    setNewsletterOptIn(checked); // optimistic
    setIsSavingNewsletter(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ platform_newsletter_opt_in: checked })
        .eq('id', currentTenant.id)
        .select('id, platform_newsletter_opt_in');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No row updated');

      await refreshTenants();
      toast.success(t('settings.platform_newsletter.saved'));
    } catch (error) {
      console.error('Error saving platform newsletter opt-in:', error);
      setNewsletterOptIn(previous);
      toast.error(t('settings.platform_newsletter.error'));
    } finally {
      setIsSavingNewsletter(false);
    }
  };
  
  // Alternative email state
  const [useAlternativeEmail, setUseAlternativeEmail] = useState(false);
  const [alternativeEmail, setAlternativeEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  
  // Initialize from tenant data
  useEffect(() => {
    if (currentTenant) {
      const hasNotificationEmail = !!currentTenant.notification_email;
      setUseAlternativeEmail(hasNotificationEmail);
      setAlternativeEmail(currentTenant.notification_email || '');
    }
  }, [currentTenant]);
  
  const handleSaveNotificationEmail = async () => {
    if (!currentTenant) return;
    
    setIsSavingEmail(true);
    try {
      const emailToSave = useAlternativeEmail && alternativeEmail.trim() 
        ? alternativeEmail.trim() 
        : null;
      
      const { error } = await supabase
        .from('tenants')
        .update({ notification_email: emailToSave })
        .eq('id', currentTenant.id);
      
      if (error) throw error;
      
      await refreshTenants();
      toast.success(t('settings.notifications.emailSaved'));
    } catch (error) {
      console.error('Error saving notification email:', error);
      toast.error(t('settings.notifications.emailSaveError'));
    } finally {
      setIsSavingEmail(false);
    }
  };
  
  const handleToggleAlternativeEmail = (enabled: boolean) => {
    setUseAlternativeEmail(enabled);
    if (!enabled) {
      // When disabling, immediately save to clear the notification_email
      setAlternativeEmail('');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('settings.notifications.prefsTitle')}
            </CardTitle>
            <CardDescription>
              {t('settings.notifications.prefsHint')}
            </CardDescription>
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.saving')}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sound toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-primary" />
            ) : (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label className="text-sm font-medium">Geluidsmelding</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.notifications.playSound')}
              </p>
            </div>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
        </div>

        {/* SellQo platform newsletter opt-in */}
        <div className="flex items-center justify-between gap-4 p-4 border rounded-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-muted">
              <Newspaper className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <Label className="text-sm font-medium">
                {t('settings.platform_newsletter.title')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.platform_newsletter.description')}
              </p>
            </div>
          </div>
          <Switch
            checked={newsletterOptIn}
            onCheckedChange={handleToggleNewsletter}
            disabled={isSavingNewsletter || !currentTenant}
          />
        </div>

        {/* Alternative notification email section */}
        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <AtSign className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('settings.notifications.emailTitle')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.notifications.emailHint')}
              </p>
            </div>
          </div>
          
          <div className="space-y-3 pl-11">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="use-owner-email"
                name="notification-email-choice"
                checked={!useAlternativeEmail}
                onChange={() => handleToggleAlternativeEmail(false)}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="use-owner-email" className="text-sm font-normal cursor-pointer">
                Gebruik eigenaar email ({currentTenant?.owner_email || 'niet ingesteld'})
              </Label>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="use-alternative-email"
                  name="notification-email-choice"
                  checked={useAlternativeEmail}
                  onChange={() => handleToggleAlternativeEmail(true)}
                  className="h-4 w-4 text-primary"
                />
                <Label htmlFor="use-alternative-email" className="text-sm font-normal cursor-pointer">
                  {t('settings.notifications.useAlternative')}
                </Label>
              </div>
              
              {useAlternativeEmail && (
                <div className="flex gap-2 ml-7">
                  <Input
                    type="email"
                    placeholder="notifications@example.com"
                    value={alternativeEmail}
                    onChange={(e) => setAlternativeEmail(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotificationEmail}
                    disabled={isSavingEmail || !alternativeEmail.trim()}
                  >
                    {isSavingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Opslaan'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {!useAlternativeEmail && currentTenant?.notification_email && (
            <div className="pl-11">
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleSaveNotificationEmail}
                disabled={isSavingEmail}
              >
                {isSavingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('settings.notifications.saveChange')}
              </Button>
            </div>
          )}
        </div>

        {/* Legenda. flex-wrap: drie items met tekst passen niet naast elkaar
            op een telefoon, en zonder omslag liepen ze over de kaartrand. */}
        <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {CHANNELS.map(({ channel, icon: ChannelIcon, labelKey }) => (
              <div key={channel} className="flex items-center gap-2">
                <ChannelIcon className="h-4 w-4" aria-hidden="true" />
                <span>{t(labelKey)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.notifications.pushHint')}</p>
        </div>

        {/* Category sections */}
        <div className="space-y-3">
          {NOTIFICATION_CONFIG.map(config => (
            <CategorySection
              key={config.category}
              config={config}
              getSettingValue={getSettingValue}
              updateSetting={updateSetting}
              toggleCategoryChannel={toggleCategoryChannel}
              isSaving={isSaving}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
