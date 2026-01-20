import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import type { EmailTemplate } from '@/types/marketing';

const templateSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  subject: z.string().min(1, 'Onderwerp is verplicht'),
  category: z.enum(['general', 'promotional', 'transactional', 'newsletter']),
  html_content: z.string().min(1, 'HTML content is verplicht'),
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

const defaultHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
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
        <p style="margin: 0 0 10px;">{{company_address}}</p>
        <p style="margin: 0;">
          <a href="{{unsubscribe_url}}" style="color: #999999;">Uitschrijven</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function TemplateDialog({ open, onOpenChange, template, onSave, isLoading }: TemplateDialogProps) {
  const { currentTenant } = useTenant();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      subject: template?.subject || '',
      category: (template?.category as TemplateFormData['category']) || 'general',
      html_content: template?.html_content || defaultHtmlContent,
    },
  });

  const handleSubmit = (data: TemplateFormData) => {
    if (!currentTenant?.id) return;
    
    onSave({
      ...data,
      tenant_id: currentTenant.id,
      is_default: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

            <FormField
              control={form.control}
              name="html_content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HTML Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      className="font-mono text-sm min-h-[300px]"
                      placeholder="HTML email content..."
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Beschikbare variabelen: {'{{customer_name}}'}, {'{{company_name}}'}, {'{{company_address}}'}, {'{{unsubscribe_url}}'}, {'{{subject}}'}
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
                {isLoading ? 'Opslaan...' : template ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
