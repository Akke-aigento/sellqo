import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useVatRates } from '@/hooks/useVatRates';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { productTypeInfo, type ProductType } from '@/types/product';
import { ChevronDown, X } from 'lucide-react';
import type { BulkEditTabProps } from './BulkEditTypes';

export function BulkBasicTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  const { categories } = useCategories();
  const { vatRates } = useVatRates();
  const [categoryMode, setCategoryMode] = useState<'add' | 'remove'>('add');

  const productTypes = Object.entries(productTypeInfo) as [ProductType, typeof productTypeInfo[ProductType]][];

  const selectedAddIds = state.category_ids_to_add || [];
  const selectedRemoveIds = state.category_ids_to_remove || [];

  return (
    <div className="space-y-6">
      {/* Categorieën */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-category"
            checked={enabledFields.has('category_ids_to_add') || enabledFields.has('category_ids_to_remove')}
            onCheckedChange={() => {
              onToggleField('category_ids_to_add');
              onToggleField('category_ids_to_remove');
            }}
          />
          <Label htmlFor="enable-category" className="font-medium cursor-pointer">
            Categorieën wijzigen
          </Label>
        </div>
        {(enabledFields.has('category_ids_to_add') || enabledFields.has('category_ids_to_remove')) && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={categoryMode === 'add' ? 'default' : 'outline'}
                onClick={() => setCategoryMode('add')}
              >
                Toevoegen
              </Button>
              <Button
                type="button"
                size="sm"
                variant={categoryMode === 'remove' ? 'default' : 'outline'}
                onClick={() => setCategoryMode('remove')}
              >
                Verwijderen
              </Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {categoryMode === 'add'
                    ? (selectedAddIds.length === 0 ? 'Categorieën om toe te voegen...' : `${selectedAddIds.length} geselecteerd`)
                    : (selectedRemoveIds.length === 0 ? 'Categorieën om te verwijderen...' : `${selectedRemoveIds.length} geselecteerd`)}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                  {categories.map((cat) => {
                    const currentList = categoryMode === 'add' ? selectedAddIds : selectedRemoveIds;
                    const isSelected = currentList.includes(cat.id);
                    return (
                      <div key={cat.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const key = categoryMode === 'add' ? 'category_ids_to_add' : 'category_ids_to_remove';
                            if (checked) {
                              onChange({ [key]: [...currentList, cat.id] });
                            } else {
                              onChange({ [key]: currentList.filter(id => id !== cat.id) });
                            }
                          }}
                        />
                        <span className="text-sm">{cat.name}</span>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {/* Show selected */}
            {(categoryMode === 'add' ? selectedAddIds : selectedRemoveIds).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(categoryMode === 'add' ? selectedAddIds : selectedRemoveIds).map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  if (!cat) return null;
                  const key = categoryMode === 'add' ? 'category_ids_to_add' : 'category_ids_to_remove';
                  const list = categoryMode === 'add' ? selectedAddIds : selectedRemoveIds;
                  return (
                    <Badge key={catId} variant="secondary" className="gap-1">
                      {cat.name}
                      <button type="button" onClick={() => onChange({ [key]: list.filter(id => id !== catId) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
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