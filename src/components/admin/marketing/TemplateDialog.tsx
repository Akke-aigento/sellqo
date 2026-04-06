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
import { VariableInserter } from './VariableInserter';
import type { EmailTemplate } from '@/types/marketing';

const templateSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  subject: z.string().min(1, 'Onderwerp is verplicht'),
  category: z.enum(['general', 'promotional', 'transactional', 'newsletter']),
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

function extractBodyFromHtml(html: string): string {
  const tdMatch = html.match(/<td[^>]*style="padding: 40px 30px;"[^>]*>([\s\S]*?)<\/td>/);
  if (tdMatch) return tdMatch[1].trim();
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return html;
}

export function TemplateDialog({ open, onOpenChange, template, onSave, isLoading }: TemplateDialogProps) {
  const { currentTenant } = useTenant();
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [richContent, setRichContent] = useState(() => {
    if (template?.html_content) return extractBodyFromHtml(template.html_content);
    return '<p>Hallo {{customer_name}},</p><p>Uw bericht hier...</p><p>Met vriendelijke groet,<br>{{company_name}}</p>';
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      subject: template?.subject || '',
      category: (template?.category as TemplateFormData['category']) || 'general',
      html_content: template?.html_content || wrapInEmailTemplate(richContent),
    },
  });

  const handleRichContentChange = (html: string) => {
    setRichContent(html);
    form.setValue('html_content', wrapInEmailTemplate(html), { shouldValidate: true });
  };

  const handleModeChange = (mode: string) => {
    if (mode === 'visual' && editorMode === 'html') {
      const currentHtml = form.getValues('html_content');
      setRichContent(extractBodyFromHtml(currentHtml));
    } else if (mode === 'html' && editorMode === 'visual') {
      form.setValue('html_content', wrapInEmailTemplate(richContent));
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

  const currentHtml = form.watch('html_content');

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
                    <FormLabel>Naam</FormLabel>
                    <FormControl>
                      <Input placeholder="bijv. Welkomstmail" {...field} />
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
                    <FormLabel>Categorie</FormLabel>
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
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Onderwerp</FormLabel>
                  <FormControl>
                    <Input placeholder="bijv. Welkom bij {{company_name}}!" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Editor with visual/HTML toggle */}
            <div className="space-y-2">
              <FormLabel>Inhoud</FormLabel>
              <Tabs value={editorMode} onValueChange={handleModeChange}>
                <TabsList className="mb-2">
                  <TabsTrigger value="visual">Visueel</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>

                <TabsContent value="visual" className="mt-0">
                  <CampaignRichEditor
                    content={richContent}
                    onChange={handleRichContentChange}
                    placeholder="Schrijf je template inhoud..."
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
                            placeholder="HTML email content..."
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
              <FormLabel>Voorbeeld</FormLabel>
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <iframe
                  srcDoc={currentHtml}
                  className="w-full h-[300px] bg-white"
                  title="Email preview"
                  sandbox=""
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
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
