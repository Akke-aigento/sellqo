import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import type { EmailCampaign } from '@/types/marketing';

const campaignSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  subject: z.string().min(1, 'Onderwerp is verplicht'),
  preview_text: z.string().optional(),
  segment_id: z.string().optional(),
  template_id: z.string().optional(),
  html_content: z.string().min(1, 'Content is verplicht'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: EmailCampaign;
  onSave: (data: CampaignFormData & { tenant_id: string; status: string }) => void;
  isLoading?: boolean;
}

const defaultHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="margin: 0 0 20px; color: #333333;">Hallo {{customer_name}},</h1>
        <p style="margin: 0 0 20px; color: #666666; line-height: 1.6;">
          Uw bericht hier...
        </p>
        <p style="margin: 0; color: #666666;">
          Met vriendelijke groet,<br>
          {{company_name}}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; background-color: #f8f8f8; text-align: center; font-size: 12px; color: #999999;">
        <p style="margin: 0;">
          <a href="{{unsubscribe_url}}" style="color: #999999;">Uitschrijven</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function CampaignDialog({ open, onOpenChange, campaign, onSave, isLoading }: CampaignDialogProps) {
  const { currentTenant } = useTenant();
  const { templates } = useEmailTemplates();
  const { segments } = useCustomerSegments();

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: campaign?.name || '',
      subject: campaign?.subject || '',
      preview_text: campaign?.preview_text || '',
      segment_id: campaign?.segment_id || '',
      template_id: campaign?.template_id || '',
      html_content: campaign?.html_content || defaultHtmlContent,
    },
  });

  const selectedTemplateId = form.watch('template_id');
  const selectedSegmentId = form.watch('segment_id');

  // Get selected segment info
  const selectedSegment = segments.find(s => s.id === selectedSegmentId);

  // When template changes, update html_content
  const handleTemplateChange = (templateId: string) => {
    form.setValue('template_id', templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue('subject', template.subject);
      form.setValue('html_content', template.html_content);
    }
  };

  const handleSubmit = (data: CampaignFormData) => {
    if (!currentTenant?.id) return;
    
    onSave({
      ...data,
      tenant_id: currentTenant.id,
      status: 'draft',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {campaign ? 'Campagne bewerken' : 'Nieuwe campagne aanmaken'}
          </DialogTitle>
          <DialogDescription>
            Maak een email campagne aan om naar je klanten te versturen.
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
                    <Select onValueChange={handleTemplateChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer een template..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Geen template</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Alle klanten" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Alle geabonneerde klanten</SelectItem>
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

            <FormField
              control={form.control}
              name="html_content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Content (HTML)</FormLabel>
                  <FormControl>
                    <Textarea 
                      className="font-mono text-sm min-h-[250px]"
                      placeholder="HTML email content..."
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Variabelen: {'{{customer_name}}'}, {'{{customer_email}}'}, {'{{company_name}}'}, {'{{unsubscribe_url}}'}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Opslaan...' : campaign ? 'Bijwerken' : 'Opslaan als concept'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
