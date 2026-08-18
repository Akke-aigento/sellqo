import { useState, useEffect } from 'react';
import {
  ShoppingCart, FileText, CreditCard, Users, Package, FileEdit,
  RefreshCw, Megaphone, UserPlus, Settings, ChevronDown, ChevronRight,
  Bell, Mail, Loader2, Volume2, VolumeX, MessageSquare, AtSign, Newspaper
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { NOTIFICATION_CONFIG, NotificationCategory } from '@/types/notification';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const categoryIcons: Record<string, React.ElementType> = {
  ShoppingCart, FileText, CreditCard, Users, Package, FileEdit,
  RefreshCw, Megaphone, UserPlus, Settings, MessageSquare,
};

function CategorySection({
  config,
  getSettingValue,
  updateSetting,
  toggleCategoryInApp,
  toggleCategoryEmail,
  isSaving,
}: {
  config: typeof NOTIFICATION_CONFIG[0];
  getSettingValue: (category: NotificationCategory, type: string, defaultInApp: boolean, defaultEmail: boolean) => {
    in_app_enabled: boolean;
    email_enabled: boolean;
    email_recipients: string[];
  };
  updateSetting: (category: NotificationCategory, type: string, updates: { in_app_enabled?: boolean; email_enabled?: boolean }) => Promise<void>;
  toggleCategoryInApp: (category: NotificationCategory, enabled: boolean, types: typeof config.types) => Promise<void>;
  toggleCategoryEmail: (category: NotificationCategory, enabled: boolean, types: typeof config.types) => Promise<void>;
  isSaving: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = categoryIcons[config.icon] || Bell;

  // Calculate how many are enabled
  const inAppCount = config.types.filter(t => {
    const { in_app_enabled } = getSettingValue(config.category, t.type, t.defaultInApp, t.defaultEmail);
    return in_app_enabled;
  }).length;

  const emailCount = config.types.filter(t => {
    const { email_enabled } = getSettingValue(config.category, t.type, t.defaultInApp, t.defaultEmail);
    return email_enabled;
  }).length;

  const allInAppEnabled = inAppCount === config.types.length;
  const allEmailEnabled = emailCount === config.types.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer rounded-lg border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">
                {config.types.length} notificatie types
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" />
              <span>{inAppCount}/{config.types.length}</span>
              <Mail className="h-3.5 w-3.5 ml-2" />
              <span>{emailCount}/{config.types.length}</span>
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
          {/* Bulk actions */}
          <div className="flex items-center justify-between pb-3 border-b">
            <span className="text-sm font-medium">Alle {config.label.toLowerCase()}</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={allInAppEnabled}
                  onCheckedChange={(checked) => toggleCategoryInApp(config.category, checked, config.types)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={allEmailEnabled}
                  onCheckedChange={(checked) => toggleCategoryEmail(config.category, checked, config.types)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {/* Individual toggles */}
          <div className="space-y-3">
            {config.types.map(typeConfig => {
              const { in_app_enabled, email_enabled } = getSettingValue(
                config.category,
                typeConfig.type,
                typeConfig.defaultInApp,
                typeConfig.defaultEmail
              );

              return (
                <div key={typeConfig.type} className="flex items-center justify-between py-2">
                  <div className="flex-1 min-w-0 pr-4">
                    <Label className="text-sm font-normal">{typeConfig.label}</Label>
                    <p className="text-xs text-muted-foreground truncate">{typeConfig.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={in_app_enabled}
                      onCheckedChange={(checked) =>
                        updateSetting(config.category, typeConfig.type, { in_app_enabled: checked })
                      }
                      disabled={isSaving}
                    />
                    <Switch
                      checked={email_enabled}
                      onCheckedChange={(checked) =>
                        updateSetting(config.category, typeConfig.type, { email_enabled: checked })
                      }
                      disabled={isSaving}
                    />
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
    toggleCategoryInApp,
    toggleCategoryEmail,
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

        {/* Legend */}
        <div className="flex items-center gap-6 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>{t('settings.notifications.inApp')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>{t('settings.notifications.email')}</span>
          </div>
        </div>

        {/* Category sections */}
        <div className="space-y-3">
          {NOTIFICATION_CONFIG.map(config => (
            <CategorySection
              key={config.category}
              config={config}
              getSettingValue={getSettingValue}
              updateSetting={updateSetting}
              toggleCategoryInApp={toggleCategoryInApp}
              toggleCategoryEmail={toggleCategoryEmail}
              isSaving={isSaving}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
