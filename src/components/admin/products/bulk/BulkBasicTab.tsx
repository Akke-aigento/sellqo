import { useCategories } from '@/hooks/useCategories';
import { useVatRates } from '@/hooks/useVatRates';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { productTypeInfo, type ProductType } from '@/types/product';
import type { BulkEditTabProps } from './BulkEditTypes';

export function BulkBasicTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  const { categories } = useCategories();
  const { vatRates } = useVatRates();

  const productTypes = Object.entries(productTypeInfo) as [ProductType, typeof productTypeInfo[ProductType]][];

  return (
    <div className="space-y-6">
      {/* Categorie */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-category"
            checked={enabledFields.has('category_id')}
            onCheckedChange={() => onToggleField('category_id')}
          />
          <Label htmlFor="enable-category" className="font-medium cursor-pointer">
            Categorie wijzigen
          </Label>
        </div>
        {enabledFields.has('category_id') && (
          <Select
            value={state.category_id || ''}
            onValueChange={(value) => onChange({ category_id: value || null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecteer categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Geen categorie</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* BTW-tarief */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-vat"
            checked={enabledFields.has('vat_rate_id')}
            onCheckedChange={() => onToggleField('vat_rate_id')}
          />
          <Label htmlFor="enable-vat" className="font-medium cursor-pointer">
            BTW-tarief wijzigen
          </Label>
        </div>
        {enabledFields.has('vat_rate_id') && (
          <Select
            value={state.vat_rate_id || ''}
            onValueChange={(value) => onChange({ vat_rate_id: value || null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecteer BTW-tarief" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Geen BTW-tarief</SelectItem>
              {vatRates.map((vat) => (
                <SelectItem key={vat.id} value={vat.id}>
                  {vat.name_nl} ({vat.rate}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Product Type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-type"
            checked={enabledFields.has('product_type')}
            onCheckedChange={() => onToggleField('product_type')}
          />
          <Label htmlFor="enable-type" className="font-medium cursor-pointer">
            Product type wijzigen
          </Label>
        </div>
        {enabledFields.has('product_type') && (
          <Select
            value={state.product_type || ''}
            onValueChange={(value) => onChange({ product_type: value as ProductType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecteer type" />
            </SelectTrigger>
            <SelectContent>
              {productTypes.map(([type, info]) => (
                <SelectItem key={type} value={type}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
