import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { ProductSpecification, CompositionItem } from '@/types/specifications';
import { useTranslation } from 'react-i18next';

interface MaterialFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

export function MaterialFields({ spec, onChange }: MaterialFieldsProps) {
  const { t } = useTranslation();
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';
  const composition: CompositionItem[] = (spec?.composition as CompositionItem[]) || [];
  const [newMaterial, setNewMaterial] = useState('');
  const [newPercentage, setNewPercentage] = useState('');

  const addComposition = () => {
    if (!newMaterial.trim() || !newPercentage) return;
    const updated = [...composition, { material: newMaterial.trim(), percentage: parseFloat(newPercentage) }];
    onChange({ composition: updated });
    setNewMaterial('');
    setNewPercentage('');
  };

  const removeComposition = (index: number) => {
    onChange({ composition: composition.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.materialFields.materiaal')}</Label>
          <Input value={val('material')} onChange={(e) => onChange({ material: e.target.value || null })} placeholder={t('admin.products.specs.materialFields.bijv_katoen')} />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.materialFields.kleur')}</Label>
          <Input value={val('color')} onChange={(e) => onChange({ color: e.target.value || null })} placeholder={t('admin.products.specs.materialFields.bijv_zwart')} />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.materialFields.maat')}</Label>
          <Input value={val('size')} onChange={(e) => onChange({ size: e.target.value || null })} placeholder={t('admin.products.specs.materialFields.bijv_xl')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('admin.products.specs.materialFields.samenstelling')}</Label>
        {composition.length > 0 && (
          <div className="space-y-1">
            {composition.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{item.material}</span>
                <span className="text-muted-foreground">{item.percentage}%</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComposition(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} placeholder={t('admin.products.specs.materialFields.materiaal_2')} className="flex-1" />
          <Input type="number" min="0" max="100" value={newPercentage} onChange={(e) => setNewPercentage(e.target.value)} placeholder="%" className="w-20" />
          <Button type="button" variant="outline" size="icon" onClick={addComposition} disabled={!newMaterial.trim() || !newPercentage}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
