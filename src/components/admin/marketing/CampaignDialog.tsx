import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Sparkles, CalendarIcon, Clock, Code, Eye, Type } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { CampaignRichEditor, wrapInEmailTemplate } from './CampaignRichEditor';
import { VariableInserter } from './VariableInserter';
import { extractEmailBody, isComplexHtml } from '@/lib/emailContent';
import { useTenantBrand, applyPreviewVariables } from '@/hooks/useTenantBrand';
import { AUDIENCE_PRESETS, getAudiencePreset } from '@/lib/audiencePresets';
import type { EmailCampaign, AutomationTrigger } from '@/types/marketing';

const campaignSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  subject: z.string().min(1, 'Onderwerp is verplicht'),
  preview_text: z.string().optional(),
  segment_id: z.string().optional(),
  template_id: z.string().optional(),
  language: z.enum(['any', 'nl', 'en', 'fr', 'de']).default('any'),
  preset_key: z.string().optional(),
  html_content: z.string().min(1, 'Content is verplicht'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

type SendMode = 'now' | 'scheduled' | 'trigger';

const triggerLabels: Record<AutomationTrigger, string> = {
  welcome: 'Welkomstmail — nieuwe klant',
  abandoned_cart: 'Verlaten winkelmandje',
  post_purchase: 'Na aankoop',
  birthday: 'Verjaardag',
  reactivation: 'Heractivering — inactieve klant',
};

interface CampaignDefaultValues {
  name?: string;
  subject?: string;
  preview_text?: string;
  segment_id?: string;
  html_content?: string;
}

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: EmailCampaign;
  onSave: (data: CampaignFormData & { 
    tenant_id: string; 
    status: string;
    scheduled_at?: string;
    automation_id?: string;
  }) => void;
  isLoading?: boolean;
  defaultValues?: CampaignDefaultValues;
  isAIGenerated?: boolean;
}

const defaultRichContent =
  '<p>Hallo {{customer_name}},</p><p>Uw bericht hier...</p><p>Met vriendelijke groet,<br>{{company_name}}</p>';
const defaultHtmlContent = defaultRichContent;

export function CampaignDialog({ 
  open, 
  onOpenChange, 
  campaign, 
  onSave, 
  isLoading,
  defaultValues,
  isAIGenerated 
}: CampaignDialogProps) {
  const { currentTenant } = useTenant();
  const { templates } = useEmailTemplates();
  const { segments } = useCustomerSegments();
  const { data: brand } = useTenantBrand();

  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [richContent, setRichContent] = useState(defaultRichContent);
  const [sendMode, setSendMode] = useState<SendMode>('now');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [selectedTrigger, setSelectedTrigger] = useState<AutomationTrigger>('welcome');
  const [triggerDelayHours, setTriggerDelayHours] = useState(1);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      subject: '',
      preview_text: '',
      segment_id: '',
      template_id: '',
      language: 'any',
      preset_key: '',
      html_content: defaultHtmlContent,
    },
  });

  useEffect(() => {
    if (open) {
      setShowPreview(false);
      if (campaign) {
        const body = extractEmailBody(campaign.html_content || '');
        form.reset({
          name: campaign.name || '',
          subject: campaign.subject || '',
          preview_text: campaign.preview_text || '',
          segment_id: campaign.segment_id || '',
          template_id: campaign.template_id || '',
          language: (campaign.language as any) || 'any',
          preset_key: campaign.preset_key || '',
          html_content: body || defaultHtmlContent,
        });
        // Existing campaigns open in HTML mode; keep richContent in sync so a
        // toggle to visual doesn't clobber the current body.
        setRichContent(body || defaultRichContent);
        setEditorMode('html');
        setSendMode(campaign.scheduled_at ? 'scheduled' : 'now');
        if (campaign.scheduled_at) {
          const d = new Date(campaign.scheduled_at);
          setScheduledDate(d);
          setScheduledTime(format(d, 'HH:mm'));
        }
      } else if (defaultValues) {
        const body = extractEmailBody(defaultValues.html_content || '');
        form.reset({
          name: defaultValues.name || '',
          subject: defaultValues.subject || '',
          preview_text: defaultValues.preview_text || '',
          segment_id: defaultValues.segment_id || '',
          template_id: '',
          language: 'any',
          preset_key: '',
          html_content: body || defaultHtmlContent,
        });
        setEditorMode(defaultValues.html_content ? 'html' : 'visual');
        setRichContent(body || defaultRichContent);
        setSendMode('now');
      } else {
        form.reset({
          name: '',
          subject: '',
          preview_text: '',
          segment_id: '',
          template_id: '',
          language: 'any',
          preset_key: '',
          html_content: defaultHtmlContent,
        });
        setEditorMode('visual');
        setRichContent(defaultRichContent);
        setSendMode('now');
        setScheduledDate(undefined);
        setScheduledTime('09:00');
        setSelectedTrigger('welcome');
        setTriggerDelayHours(1);
      }
    }
  }, [open, campaign, defaultValues, form]);

  const selectedSegmentId = form.watch('segment_id');
  const selectedSegment = segments.find(s => s.id === selectedSegmentId);

  const handleTemplateChange = (templateId: string) => {
    form.setValue('template_id', templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const body = extractEmailBody(template.html_content || '');
      form.setValue('subject', template.subject);
      form.setValue('html_content', body);
      setRichContent(body || defaultRichContent);
      setEditorMode('html');
    }
  };

  const handleEditorModeToggle = () => {
    if (editorMode === 'visual') {
      // Switch to HTML: expose the raw body HTML (no document wrapping).
      form.setValue('html_content', richContent);
      setEditorMode('html');
    } else {
      // Switch to visual: hydrate the rich editor from current HTML.
      const current = form.getValues('html_content') || '';
      const body = extractEmailBody(current);
      if (isComplexHtml(body)) {
        const ok = window.confirm(
          'Deze HTML bevat opmaak (tabellen/inline styles) die de visuele editor kan vereenvoudigen. Overschakelen?',
        );
        if (!ok) return;
      }
      setRichContent(body || defaultRichContent);
      setEditorMode('visual');
    }
  };

  const handleRichContentChange = (html: string) => {
    setRichContent(html);
    // Store raw body HTML; the sender wraps it in the tenant template.
    form.setValue('html_content', html);
  };

  const handleSubmit = (data: CampaignFormData) => {
    if (!currentTenant?.id) return;

    let status = 'draft';
    let scheduled_at: string | undefined;

    if (sendMode === 'scheduled' && scheduledDate) {
      status = 'scheduled';
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const dt = new Date(scheduledDate);
      dt.setHours(hours, minutes, 0, 0);
      scheduled_at = dt.toISOString();
    }

    // Presets and segments are mutually exclusive; strip empties for DB.
    const payload: any = {
      ...data,
      language: data.language === 'any' ? null : data.language,
      preset_key: data.preset_key || null,
      segment_id: data.preset_key ? null : (data.segment_id || null),
      tenant_id: currentTenant.id,
      status,
      scheduled_at,
    };
    onSave(payload);
  };

  const previewHtml = wrapInEmailTemplate(
    applyPreviewVariables(
      editorMode === 'visual' ? richContent : (form.watch('html_content') || ''),
      brand,
    ),
  );

  const campaignLanguage = form.watch('language');
  // Sort templates: language-matching first, then divider, then rest.
  const sortedTemplates = (() => {
    if (!campaignLanguage || campaignLanguage === 'any') {
      return { match: templates, other: [] as typeof templates };
    }
    const match = templates.filter((t) => (t as any).language === campaignLanguage);
    const other = templates.filter((t) => (t as any).language !== campaignLanguage);
    return { match, other };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign ? 'Campagne bewerken' : 'Nieuwe campagne aanmaken'}
            {isAIGenerated && (
              <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI gegenereerd
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAIGenerated 
              ? 'Deze campagne is door AI gegenereerd. Pas aan waar nodig.'
              : 'Maak een email campagne aan om naar je klanten te versturen.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campagne naam</FormLabel>
                  <FormControl>
                    <Input placeholder="bijv. Nieuwsbrief Januari 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template (optioneel)</FormLabel>
                    <Select onValueChange={(val) => handleTemplateChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer een template..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Geen template</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="segment_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doelgroep</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "all" ? "" : val)} value={field.value || "all"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Alle klanten" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Alle geabonneerde klanten</SelectItem>
                        {segments.map((segment) => (
                          <SelectItem key={segment.id} value={segment.id}>
                            {segment.name} ({segment.member_count} klanten)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSegment && (
                      <p className="text-xs text-muted-foreground">
                        {selectedSegment.member_count} ontvangers in dit segment
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Onderwerp</FormLabel>
                  <FormControl>
                    <Input placeholder="Email onderwerp..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preview_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preview tekst (optioneel)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Tekst die na het onderwerp wordt getoond in de inbox..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Editor mode toggle + preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <FormLabel>Email Content</FormLabel>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Voorbeeld
                  </Button>
                  <div className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch
                      checked={editorMode === 'html'}
                      onCheckedChange={handleEditorModeToggle}
                    />
                    <Code className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {editorMode === 'visual' ? 'Visueel' : 'HTML'}
                    </span>
                  </div>
                </div>
              </div>

              {showPreview ? (
                <div className="border border-input rounded-md overflow-hidden bg-muted/30">
                  <div className="p-2 border-b border-input bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Email preview</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowPreview(false)}>
                      Sluiten
                    </Button>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-[300px] bg-white"
                    sandbox=""
                    title="Email preview"
                  />
                </div>
              ) : editorMode === 'visual' ? (
                <div>
                  <CampaignRichEditor
                    content={richContent}
                    onChange={handleRichContentChange}
                  />
                  <div className="mt-1">
                    <VariableInserter onInsert={(v) => handleRichContentChange(richContent + v)} />
                  </div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="html_content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea 
                          className="font-mono text-sm min-h-[250px]"
                          placeholder="HTML email content..."
                          {...field}
                        />
                      </FormControl>
                      <div className="mt-1">
                        <VariableInserter onInsert={(v) => {
                          const current = form.getValues('html_content');
                          form.setValue('html_content', current + v, { shouldValidate: true });
                        }} />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Scheduling section */}
            <div className="space-y-3">
              <FormLabel>Wanneer verzenden?</FormLabel>
              <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as SendMode)} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="now" id="send-now" />
                  <Label htmlFor="send-now" className="font-normal cursor-pointer">Direct verzenden (opslaan als concept)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="scheduled" id="send-scheduled" />
                  <Label htmlFor="send-scheduled" className="font-normal cursor-pointer">Inplannen op datum & tijd</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="trigger" id="send-trigger" />
                  <Label htmlFor="send-trigger" className="font-normal cursor-pointer">Automatische trigger</Label>
                </div>
              </RadioGroup>

              {sendMode === 'scheduled' && (
                <div className="flex items-center gap-3 pl-6">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, 'dd/MM/yyyy') : 'Kies datum'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-[120px]"
                    />
                  </div>
                </div>
              )}

              {sendMode === 'trigger' && (
                <div className="space-y-3 pl-6">
                  <Select value={selectedTrigger} onValueChange={(v) => setSelectedTrigger(v as AutomationTrigger)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(triggerLabels) as [AutomationTrigger, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Vertraging:</Label>
                    <Input
                      type="number"
                      min={0}
                      value={triggerDelayHours}
                      onChange={(e) => setTriggerDelayHours(Number(e.target.value))}
                      className="w-[80px]"
                    />
                    <span className="text-sm text-muted-foreground">uur na trigger</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading 
                  ? 'Opslaan...' 
                  : sendMode === 'scheduled' 
                    ? 'Inplannen' 
                    : campaign 
                      ? 'Bijwerken' 
                      : 'Opslaan als concept'
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
