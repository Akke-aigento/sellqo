import { useState } from 'react';
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
        return <Badge className="bg-emerald-500">Goedgekeurd</Badge>;
      case 'pending':
        return <Badge variant="secondary">In afwachting</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Afgewezen</Badge>;
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
              Message Templates
            </CardTitle>
            <CardDescription>
              Beheer je WhatsApp berichtsjablonen
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nieuwe template aanmaken</DialogTitle>
                <DialogDescription>
                  Maak een nieuwe WhatsApp berichtsjabloon aan. Templates moeten worden goedgekeurd door Meta.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="template_name">Template naam</Label>
                  <Input
                    id="template_name"
                    placeholder="order_confirmation_nl"
                    value={formData.template_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gebruik alleen kleine letters, cijfers en underscores
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
                  <Label htmlFor="header_text">Header (optioneel)</Label>
                  <Input
                    id="header_text"
                    placeholder="Bestelbevestiging"
                    value={formData.header_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, header_text: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_text">Berichttekst</Label>
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
                  <Label htmlFor="footer_text">Footer (optioneel)</Label>
                  <Input
                    id="footer_text"
                    placeholder="Mijn Webshop"
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
            Templates laden...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nog geen templates aangemaakt
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
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
        )}

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Template preview</DialogTitle>
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
