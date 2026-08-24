import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import { CampaignRichEditor, wrapInEmailTemplate } from './CampaignRichEditor';
import { extractEmailBody } from '@/lib/emailContent';
import { VariableInserter } from './VariableInserter';
import { useTenantBrand, applyPreviewVariables } from '@/hooks/useTenantBrand';
import type { EmailTemplate } from '@/types/marketing';
import { LANG_CODES_TUPLE } from '@/i18n/languages';
import { useTranslation } from 'react-i18next';

const templateSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  subject: z.string().min(1, 'Onderwerp is verplicht'),
  category: z.enum(['general', 'promotional', 'transactional', 'newsletter']),
  language: z.enum(LANG_CODES_TUPLE),
  html_content: z.string().min(1, 'Content is verplicht'),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EmailTemplate;
  onSave: (data: TemplateFormData & { tenant_id: string; is_default: boolean }) => void;
  isLoading?: boolean;
}

const categoryLabels = {
  general: 'Algemeen',
  promotional: 'Promotie',
  transactional: 'Transactie',
  newsletter: 'Nieuwsbrief',
};

const extractBodyFromHtml = extractEmailBody;

export function TemplateDialog({ open, onOpenChange, template, onSave, isLoading }: TemplateDialogProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { data: brand } = useTenantBrand();
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [richContent, setRichContent] = useState(() => {
    if (template?.html_content) return extractBodyFromHtml(template.html_content);
    return `<p>${t('admin.marketing.templateDialog.hallo')} {{customer_name}},</p><p>${t('admin.marketing.templateDialog.uw_bericht_hier')}</p><p>${t('admin.marketing.templateDialog.met_vriendelijke_groet')}<br>{{company_name}}</p>`;
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      subject: template?.subject || '',
      category: (template?.category as TemplateFormData['category']) || 'general',
      language: ((template?.language as TemplateFormData['language']) || brand?.defaultLocale || 'nl'),
      html_content: template?.html_content
        ? extractBodyFromHtml(template.html_content)
        : richContent,
    },
  });

  const handleRichContentChange = (html: string) => {
    setRichContent(html);
    form.setValue('html_content', html, { shouldValidate: true });
  };

  const handleModeChange = (mode: string) => {
    if (mode === 'visual' && editorMode === 'html') {
      const currentHtml = form.getValues('html_content');
      setRichContent(extractBodyFromHtml(currentHtml));
    } else if (mode === 'html' && editorMode === 'visual') {
      form.setValue('html_content', richContent);
    }
    setEditorMode(mode as 'visual' | 'html');
  };

  const handleSubmit = (data: TemplateFormData) => {
    if (!currentTenant?.id) return;
    onSave({
      ...data,
      tenant_id: currentTenant.id,
      is_default: false,
    });
  };

  const currentHtml = wrapInEmailTemplate(
    applyPreviewVariables(form.watch('html_content') || '', brand),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Template bewerken' : 'Nieuwe template aanmaken'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('admin.marketing.templateDialog.bijv_welkomstmail')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.marketing.templateDialog.categorie')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.marketing.templateDialog.taal')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="nl">{t('admin.marketing.segmentBuilder.nederlands')}</SelectItem>
                      <SelectItem value="en">{t('admin.marketing.segmentBuilder.english')}</SelectItem>
                      <SelectItem value="fr">{t('admin.marketing.segmentBuilder.francais')}</SelectItem>
                      <SelectItem value="de">{t('admin.marketing.segmentBuilder.deutsch')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.marketing.templateDialog.onderwerp')}</FormLabel>
                  <FormControl>
                    <Input placeholder="bijv. Welkom bij {{company_name}}!" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Editor with visual/HTML toggle */}
            <div className="space-y-2">
              <FormLabel>{t('admin.marketing.emailBlockPalette.inhoud')}</FormLabel>
              <Tabs value={editorMode} onValueChange={handleModeChange}>
                <TabsList className="mb-2">
                  <TabsTrigger value="visual">{t('admin.marketing.templateDialog.visueel')}</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>

                <TabsContent value="visual" className="mt-0">
                  <CampaignRichEditor
                    content={richContent}
                    onChange={handleRichContentChange}
                    placeholder={t('admin.marketing.templateDialog.schrijf_je_template_inhoud')}
                  />
                </TabsContent>

                <TabsContent value="html" className="mt-0">
                  <FormField
                    control={form.control}
                    name="html_content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            className="font-mono text-sm min-h-[300px]"
                            placeholder={t('admin.marketing.templateDialog.html_email_content')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
              <VariableInserter onInsert={(v) => {
                if (editorMode === 'visual') {
                  handleRichContentChange(richContent + v);
                } else {
                  const current = form.getValues('html_content');
                  form.setValue('html_content', current + v, { shouldValidate: true });
                }
              }} />
            </div>

            {/* Email Preview */}
            <div className="space-y-2">
              <FormLabel>{t('admin.marketing.templateDialog.voorbeeld')}</FormLabel>
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <iframe
                  srcDoc={currentHtml}
                  className="w-full h-[300px] bg-white"
                  title={t('admin.marketing.emailPreview.email_preview')}
                  sandbox=""
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Opslaan...' : template ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
