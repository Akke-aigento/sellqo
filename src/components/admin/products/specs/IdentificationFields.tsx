import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductSpecification } from '@/types/specifications';
import { useTranslation } from 'react-i18next';

interface IdentificationFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

export function IdentificationFields({ spec, onChange }: IdentificationFieldsProps) {
  const { t } = useTranslation();
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label className="text-sm">UPC</Label>
        <Input value={val('upc')} onChange={(e) => onChange({ upc: e.target.value || null })} placeholder={t('admin.products.specs.identificationFields.universal_product_code')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">MPN</Label>
        <Input value={val('mpn')} onChange={(e) => onChange({ mpn: e.target.value || null })} placeholder={t('admin.products.specs.identificationFields.manufacturer_part_number')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">ISBN</Label>
        <Input value={val('isbn')} onChange={(e) => onChange({ isbn: e.target.value || null })} placeholder={t('admin.products.specs.identificationFields.voor_boeken')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">{t('admin.marketing.variableInserter.groups.brand.label')}</Label>
        <Input value={val('brand')} onChange={(e) => onChange({ brand: e.target.value || null })} placeholder={t('admin.products.bulk.bulkSpecificationsTab.merknaam')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">{t('admin.products.specs.identificationFields.fabrikant')}</Label>
        <Input value={val('manufacturer')} onChange={(e) => onChange({ manufacturer: e.target.value || null })} placeholder={t('admin.products.bulk.bulkSpecificationsTab.naam_fabrikant')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">{t('admin.products.specs.identificationFields.modelnummer')}</Label>
        <Input value={val('model_number')} onChange={(e) => onChange({ model_number: e.target.value || null })} placeholder={t('admin.products.specs.identificationFields.model_nummer')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">{t('admin.products.specs.identificationFields.herkomstland')}</Label>
        <Input value={val('country_of_origin')} onChange={(e) => onChange({ country_of_origin: e.target.value || null })} placeholder={t('admin.products.bulk.bulkSpecificationsTab.nl_de_cn')} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">{t('admin.products.specs.identificationFields.hs_taric_code')}</Label>
        <Input value={val('hs_tariff_code')} onChange={(e) => onChange({ hs_tariff_code: e.target.value || null })} placeholder={t('admin.products.bulk.bulkSpecificationsTab.douanecode')} />
      </div>
    </div>
  );
}
