import { useState } from 'react';
import { useChannelFieldMappings } from '@/hooks/useChannelFieldMappings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ChannelFieldMapping, TransformRule } from '@/types/specifications';

const CHANNEL_OPTIONS = [
  { value: 'bol_com', label: 'Bol.com' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'ebay', label: 'eBay' },
] as const;

const FIELD_GROUP_OPTIONS = ['identification', 'material', 'logistics', 'compliance', 'dimensions'] as const;

type MappingFormData = {
  sellqo_field: string;
  channel_field: string;
  channel_field_label: string;
  is_required: boolean;
  field_group: string;
  sort_order: number;
  transform_rule: TransformRule | null;
};

const emptyForm: MappingFormData = {
  sellqo_field: '',
  channel_field: '',
  channel_field_label: '',
  is_required: false,
  field_group: 'identification',
  sort_order: 0,
  transform_rule: null,
};

export default function ChannelFieldMappingAdmin() {
  const [selectedChannel, setSelectedChannel] = useState<string>('bol_com');
  const { mappings, isLoading, createMapping, updateMapping, deleteMapping } = useChannelFieldMappings(selectedChannel);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MappingFormData>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (mapping: any) => {
    setEditingId(mapping.id);
    setForm({
      sellqo_field: mapping.sellqo_field,
      channel_field: mapping.channel_field,
      channel_field_label: mapping.channel_field_label,
      is_required: mapping.is_required,
      field_group: mapping.field_group,
      sort_order: mapping.sort_order,
      transform_rule: mapping.transform_rule,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.sellqo_field || !form.channel_field || !form.channel_field_label) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    if (editingId) {
      updateMapping({ id: editingId, ...form } as any, {
        onSuccess: () => {
          toast.success('Mapping bijgewerkt');
          setDialogOpen(false);
        },
        onError: () => toast.error('Kon mapping niet bijwerken'),
      });
    } else {
      createMapping({
        channel_type: selectedChannel as any,
        channel_category: null,
        is_active: true,
        ...form,
      } as any, {
        onSuccess: () => {
          toast.success('Mapping aangemaakt');
          setDialogOpen(false);
        },
        onError: () => toast.error('Kon mapping niet aanmaken'),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMapping(id, {
      onSuccess: () => toast.success('Mapping verwijderd'),
      onError: () => toast.error('Kon mapping niet verwijderen'),
    });
  };

  const channelLabel = CHANNEL_OPTIONS.find(c => c.value === selectedChannel)?.label ?? selectedChannel;

  // Group mappings by field_group
  const grouped = mappings.reduce<Record<string, typeof mappings>>((acc, m) => {
    const g = m.field_group || 'other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channel Field Mappings</h1>
          <p className="text-muted-foreground text-sm">Beheer hoe SellQo-velden mappen naar kanaalvelden</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Mapping toevoegen
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Label>Kanaal</Label>
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Geen mappings geconfigureerd voor {channelLabel}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">{group}</CardTitle>
              <CardDescription>{items.length} mapping{items.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">SellQo Veld</TableHead>
                    <TableHead className="w-8" />
                    <TableHead className="w-[250px]">{channelLabel} Veld</TableHead>
                    <TableHead>Verplicht</TableHead>
                    <TableHead>Transform</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-sm">{m.sellqo_field}</TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      <TableCell>
                        <div>
                          <span className="font-mono text-sm">{m.channel_field}</span>
                          <span className="block text-xs text-muted-foreground">{m.channel_field_label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.is_required ? (
                          <Badge variant="destructive" className="text-xs">Verplicht</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Optioneel</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.transform_rule ? (
                          <Badge variant="outline" className="text-xs">
                            {(m.transform_rule as any)?.type || 'custom'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Mapping bewerken' : 'Nieuwe mapping'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SellQo Veld *</Label>
                <Input
                  placeholder="specs.brand"
                  value={form.sellqo_field}
                  onChange={e => setForm(f => ({ ...f, sellqo_field: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Kanaal Veld *</Label>
                <Input
                  placeholder="brand"
                  value={form.channel_field}
                  onChange={e => setForm(f => ({ ...f, channel_field: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kanaal Veld Label *</Label>
              <Input
                placeholder="Brand"
                value={form.channel_field_label}
                onChange={e => setForm(f => ({ ...f, channel_field_label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Groep</Label>
                <Select value={form.field_group} onValueChange={v => setForm(f => ({ ...f, field_group: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_GROUP_OPTIONS.map(g => (
                      <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sorteervolgorde</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_required}
                onCheckedChange={v => setForm(f => ({ ...f, is_required: v }))}
              />
              <Label>Verplicht veld voor dit kanaal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleSave}>{editingId ? 'Opslaan' : 'Toevoegen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
