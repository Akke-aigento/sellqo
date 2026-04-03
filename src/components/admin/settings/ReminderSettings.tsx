import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Save } from 'lucide-react';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';

export function ReminderSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = usePaymentReminders();
  
  const [formData, setFormData] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t('reminders.settings_title')}
        </CardTitle>
        <CardDescription>
          {t('reminders.settings_description', 'Configureer automatische betalingsherinneringen voor openstaande facturen.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="reminders-enabled">{t('reminders.auto_enabled')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('reminders.auto_enabled_description', 'Verstuur automatisch herinneringen voor onbetaalde facturen')}
            </p>
          </div>
          <Switch
            id="reminders-enabled"
            checked={formData.reminders_enabled}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminders_enabled: checked }))}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('reminders.level1')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={formData.reminder_level1_days}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    reminder_level1_days: parseInt(e.target.value) || 7 
                  }))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{t('reminders.days_after_due')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reminders.level2')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={formData.reminder_level2_days}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    reminder_level2_days: parseInt(e.target.value) || 21 
                  }))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{t('reminders.days_after_due')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reminders.level3')} ({t('reminders.final_notice')})</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={formData.reminder_level3_days}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    reminder_level3_days: parseInt(e.target.value) || 35 
                  }))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{t('reminders.days_after_due')}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="late-fee-enabled">{t('reminders.add_late_fee')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('reminders.add_late_fee_description', 'Voeg rente en kosten toe bij de laatste aanmaning')}
              </p>
            </div>
            <Switch
              id="late-fee-enabled"
              checked={formData.reminder_late_fee_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminder_late_fee_enabled: checked }))}
            />
          </div>

          {formData.reminder_late_fee_enabled && (
            <div className="flex items-center gap-2">
              <Label>{t('reminders.late_fee_percentage')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={formData.reminder_late_fee_percentage}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  reminder_late_fee_percentage: parseFloat(e.target.value) || 10 
                }))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
        </div>

      </CardContent>
    </Card>

      <FloatingSaveBar
        isDirty={JSON.stringify(formData) !== JSON.stringify(settings)}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => setFormData(settings)}
      />
  );
}
