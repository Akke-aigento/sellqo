import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenantBrand, applyPreviewVariables } from '@/hooks/useTenantBrand';
import { CampaignRichEditor, wrapInEmailTemplate } from './CampaignRichEditor';
import { VariableInserter } from './VariableInserter';
import { BrandedEmailPreview } from './BrandedEmailPreview';
import { PRESET_LANGS, type PresetLang } from '@/lib/marketing/automationPresets';
import {
  useEmailAutomationActions, type AutomationStepView, type StepContent,
} from '@/hooks/useEmailAutomations';

/** De wachttijd van deze stappen stel je op de kaart in (win-back: dagen; winkelwagen: uren). */
const DELAY_ON_CARD = new Set(['win_back', 'cart']);

/** Voorbeeldwaarden voor de lokale terugvalweergave (de echte render doet de server). */
const PREVIEW_EXTRAS: Record<string, string> = {
  order_number: '#1042',
  review_url: '#',
  cart_url: '#',
  shop_url: '#',
  cart_items: '',
};

export function AutomationStepDialog({
  step, open, onOpenChange, canWrite,
}: {
  step: AutomationStepView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: brand } = useTenantBrand();
  const { saveStep } = useEmailAutomationActions();
  const [lang, setLang] = useState<PresetLang>('nl');
  const [content, setContent] = useState<Partial<Record<PresetLang, StepContent>>>({});
  const [delayHours, setDelayHours] = useState(0);
  const [active, setActive] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!step || !open) return;
    setContent(step.content || {});
    setDelayHours((step.delay_hours ?? 0) + Math.round((step.delay_minutes ?? 0) / 60));
    setActive(step.is_active ?? true);
    setLang('nl');
    setShowPreview(false);
  }, [step, open]);

  if (!step) return null;

  const current = content[lang] || {};
  const setField = (field: keyof StepContent, value: string) =>
    setContent((prev) => ({ ...prev, [lang]: { ...(prev[lang] || {}), [field]: value } }));
  const delayEditable = !DELAY_ON_CARD.has(step.step_key);
  const editable = canWrite && !!step.campaign_id;

  const handleSave = async () => {
    try {
      await saveStep.mutateAsync({
        step,
        content,
        is_active: active,
        ...(delayEditable ? { delay_hours: Math.max(0, Math.round(delayHours)) } : {}),
      });
      toast({ title: t('admin.marketing.automations.step.saved') });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: t('admin.marketing.automations.step.save_failed'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const fallbackHtml = wrapInEmailTemplate(applyPreviewVariables(current.html_content || '', brand, PREVIEW_EXTRAS));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`admin.marketing.automations.steps.${step.step_key}`)}</DialogTitle>
          <DialogDescription>{t('admin.marketing.automations.step.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="step-active" checked={active} onCheckedChange={setActive} disabled={!canWrite} />
              <Label htmlFor="step-active">{t('admin.marketing.automations.step.active')}</Label>
            </div>
            {delayEditable ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="step-delay" className="whitespace-nowrap">{t('admin.marketing.automations.step.delay_label')}</Label>
                <Input
                  id="step-delay" type="number" min={0} max={9600} className="w-24"
                  value={delayHours} disabled={!canWrite}
                  onChange={(e) => setDelayHours(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-sm text-muted-foreground">{t('admin.marketing.automations.hours_unit')}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('admin.marketing.automations.step.delay_from_settings')}</p>
            )}
          </div>

          <Tabs value={lang} onValueChange={(v) => setLang(v as PresetLang)}>
            <TabsList>
              {PRESET_LANGS.map((l) => (
                <TabsTrigger key={l} value={l}>{l.toUpperCase()}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="step-subject">{t('admin.marketing.automations.step.subject')}</Label>
            <Input
              id="step-subject" value={current.subject || ''} disabled={!editable}
              onChange={(e) => setField('subject', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t('admin.marketing.automations.step.body')}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? t('admin.marketing.automations.step.edit_text') : t('admin.marketing.automations.step.preview')}
              </Button>
            </div>
            {showPreview || !editable ? (
              <BrandedEmailPreview
                subject={current.subject || ''}
                bodyHtml={current.html_content || ''}
                previewText={current.preview_text}
                language={lang}
                fallbackHtml={fallbackHtml}
              />
            ) : (
              <>
                <CampaignRichEditor
                  key={`${step.id}-${lang}`}
                  content={current.html_content || ''}
                  onChange={(html) => setField('html_content', html)}
                />
                <VariableInserter
                  onInsert={(v) => setField('html_content', (current.html_content || '') + v)}
                  includeAutomation
                  includeCartItems={step.step_key === 'cart'}
                />
              </>
            )}
          </div>
          {lang !== 'nl' && !current.subject && !current.html_content && (
            <p className="text-xs text-muted-foreground">{t('admin.marketing.automations.step.empty_lang')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          {canWrite && (
            <Button onClick={handleSave} disabled={saveStep.isPending}>
              {saveStep.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
