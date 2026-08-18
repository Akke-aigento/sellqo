import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { useWhatsAppTemplates, WhatsAppTemplateType } from '@/hooks/useWhatsAppTemplates';

const templateTypeLabels: Record<WhatsAppTemplateType, string> = {
  order_confirmation: 'Bestelbevestiging',
  shipping_update: 'Verzending',
  delivery_confirmation: 'Aflevering',
  abandoned_cart: 'Winkelwagen',
  payment_reminder: 'Betalingsherinnering',
  review_request: 'Review verzoek',
  custom: 'Aangepast',
};

export function WhatsAppTemplatesTable() {
  const { t } = useTranslation();
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useWhatsAppTemplates();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<typeof templates[0] | null>(null);
  const [formData, setFormData] = useState({
    template_name: '',
    template_type: 'custom' as WhatsAppTemplateType,
    header_text: '',
    body_text: '',
    footer_text: '',
  });

  const handleCreate = async () => {
    await createTemplate.mutateAsync({
      template_name: formData.template_name,
      template_type: formData.template_type,
      header_text: formData.header_text || undefined,
      body_text: formData.body_text,
      footer_text: formData.footer_text || undefined,
    });
    setCreateDialogOpen(false);
    setFormData({
      template_name: '',
      template_type: 'custom',
      header_text: '',
      body_text: '',
      footer_text: '',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500">{t('settings.whatsapp.templates.approved')}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{t('settings.whatsapp.templates.pending')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('settings.whatsapp.templates.rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('settings.whatsapp.templates.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.whatsapp.templates.subtitle')}
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('settings.whatsapp.templates.new')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('settings.whatsapp.templates.createTitle')}</DialogTitle>
                <DialogDescription>
                  {t('settings.whatsapp.templates.createHint')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="template_name">{t('settings.whatsapp.templates.nameLabel')}</Label>
                  <Input
                    id="template_name"
                    placeholder="order_confirmation_nl"
                    value={formData.template_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings.whatsapp.templates.nameHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template_type">Type</Label>
                  <Select
                    value={formData.template_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, template_type: value as WhatsAppTemplateType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(templateTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header_text">{t('settings.whatsapp.templates.headerOptional')}</Label>
                  <Input
                    id="header_text"
                    placeholder="Bestelbevestiging"
                    value={formData.header_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, header_text: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_text">{t('settings.whatsapp.templates.bodyLabel')}</Label>
                  <Textarea
                    id="body_text"
                    placeholder="Hallo {{1}}, bedankt voor je bestelling #{{2}}!"
                    rows={4}
                    value={formData.body_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, body_text: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gebruik {"{{1}}"}, {"{{2}}"}, etc. voor variabelen
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footer_text">{t('settings.whatsapp.templates.footerOptional')}</Label>
                  <Input
                    id="footer_text"
                    placeholder={t('settings.whatsapp.templates.footerPlaceholder')}
                    value={formData.footer_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, footer_text: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={!formData.template_name || !formData.body_text || createTemplate.isPending}
                >
                  {createTemplate.isPending ? 'Aanmaken...' : 'Aanmaken'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('settings.whatsapp.templates.loading')}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('settings.whatsapp.templates.empty')}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.whatsapp.templates.columnTemplate')}</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.template_name}</TableCell>
                  <TableCell>{templateTypeLabels[template.template_type] || template.template_type}</TableCell>
                  <TableCell>{getStatusBadge(template.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteTemplate.mutate(template.id)}
                        disabled={deleteTemplate.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('settings.whatsapp.templates.preview')}</DialogTitle>
            </DialogHeader>
            {previewTemplate && (
              <div className="bg-[#e5ddd5] dark:bg-zinc-800 rounded-lg p-4">
                <div className="bg-white dark:bg-zinc-700 rounded-lg p-3 shadow-sm max-w-[80%]">
                  {previewTemplate.header_text && (
                    <p className="font-semibold text-sm mb-1">{previewTemplate.header_text}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{previewTemplate.body_text}</p>
                  {previewTemplate.footer_text && (
                    <p className="text-xs text-muted-foreground mt-2">{previewTemplate.footer_text}</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
