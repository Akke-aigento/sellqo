import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { ProductCustomSpec } from '@/types/specifications';
import { AIFieldAssistant } from '@/components/admin/ai/AIFieldAssistant';

interface CustomSpecsEditorProps {
  specs: ProductCustomSpec[];
  productId: string;
  onAdd: (spec: Omit<ProductCustomSpec, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdate: (spec: Partial<ProductCustomSpec> & { id: string }) => void;
  onDelete: (id: string) => void;
}

export function CustomSpecsEditor({ specs, productId, onAdd, onUpdate, onDelete }: CustomSpecsEditorProps) {
  const [newGroup, setNewGroup] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'text' | 'number' | 'boolean'>('text');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Group specs by group_name
  const grouped = specs.reduce<Record<string, ProductCustomSpec[]>>((acc, spec) => {
    const group = spec.group_name || 'Overig';
    if (!acc[group]) acc[group] = [];
    acc[group].push(spec);
    return acc;
  }, {});

  const existingGroups = Object.keys(grouped);
  const activeGroup = selectedGroup || newGroup;

  const handleAdd = () => {
    if (!newKey.trim() || !activeGroup.trim()) return;
    const maxSortOrder = specs.filter(s => s.group_name === activeGroup).reduce((max, s) => Math.max(max, s.sort_order), -1);
    const maxGroupSort = specs.reduce((max, s) => Math.max(max, s.group_sort_order), -1);
    const groupExists = existingGroups.includes(activeGroup);

    onAdd({
      product_id: productId,
      tenant_id: '', // Will be set by RLS
      group_name: activeGroup,
      spec_key: newKey.trim(),
      spec_value: newValue.trim(),
      value_type: newType,
      sort_order: maxSortOrder + 1,
      group_sort_order: groupExists ? specs.find(s => s.group_name === activeGroup)!.group_sort_order : maxGroupSort + 1,
    });
    setNewKey('');
    setNewValue('');
    setNewGroup('');
  };

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([groupName, groupSpecs]) => (
        <div key={groupName} className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{groupName}</Label>
          <div className="border rounded-lg divide-y">
            {groupSpecs.map((spec) => (
              <div key={spec.id} className="flex items-center gap-2 p-2.5">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                <Input
                  value={spec.spec_key}
                  onChange={(e) => onUpdate({ id: spec.id, spec_key: e.target.value })}
                  className="h-8 text-sm flex-1"
                  placeholder="Naam"
                />
                <Input
                  value={spec.spec_value}
                  onChange={(e) => onUpdate({ id: spec.id, spec_value: e.target.value })}
                  className="h-8 text-sm flex-1"
                  placeholder="Waarde"
                  type={spec.value_type === 'number' ? 'number' : 'text'}
                />
                {spec.value_type === 'text' && (
                  <AIFieldAssistant
                    fieldType="specification_value"
                    currentValue={spec.spec_value}
                    onApply={(text) => onUpdate({ id: spec.id, spec_value: text })}
                    context={{ name: spec.spec_key }}
                    className="h-8 w-8"
                  />
                )}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => onDelete(spec.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add new spec */}
      <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
        <Label className="text-sm font-medium">Specificatie toevoegen</Label>
        <div className="grid grid-cols-2 gap-2">
          {existingGroups.length > 0 ? (
            <Select value={selectedGroup} onValueChange={(v) => { setSelectedGroup(v); setNewGroup(''); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Bestaande groep..." />
              </SelectTrigger>
              <SelectContent>
                {existingGroups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            value={newGroup}
            onChange={(e) => { setNewGroup(e.target.value); setSelectedGroup(''); }}
            placeholder="Nieuwe groepsnaam"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Naam" className="h-8 text-sm flex-1" />
          <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Waarde" className="h-8 text-sm flex-1" />
          <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
            <SelectTrigger className="h-8 text-sm w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Tekst</SelectItem>
              <SelectItem value="number">Nummer</SelectItem>
              <SelectItem value="boolean">Ja/Nee</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleAdd} disabled={!newKey.trim() || !activeGroup.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />Toevoegen
          </Button>
        </div>
      </div>
    </div>
  );
}
