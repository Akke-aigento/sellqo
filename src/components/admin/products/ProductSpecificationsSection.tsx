import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Ruler, Tag, Palette, ShieldCheck, Truck, List } from 'lucide-react';
import { useProductSpecifications } from '@/hooks/useProductSpecifications';
import { DimensionsFields } from './specs/DimensionsFields';
import { IdentificationFields } from './specs/IdentificationFields';
import { MaterialFields } from './specs/MaterialFields';
import { ComplianceFields } from './specs/ComplianceFields';
import { LogisticsFields } from './specs/LogisticsFields';
import { CustomSpecsEditor } from './specs/CustomSpecsEditor';
import type { ProductSpecification } from '@/types/specifications';

interface ProductSpecificationsSectionProps {
  productId: string;
}

const DIMENSION_KEYS: (keyof ProductSpecification)[] = [
  'length_cm', 'width_cm', 'height_cm', 'weight_kg',
  'package_length_cm', 'package_width_cm', 'package_height_cm', 'package_weight_kg', 'units_per_package',
];
const IDENTIFICATION_KEYS: (keyof ProductSpecification)[] = [
  'upc', 'mpn', 'isbn', 'brand', 'manufacturer', 'model_number', 'country_of_origin', 'hs_tariff_code',
];
const MATERIAL_KEYS: (keyof ProductSpecification)[] = ['material', 'color', 'size', 'composition'];
const COMPLIANCE_KEYS: (keyof ProductSpecification)[] = ['warranty_months', 'ce_marking', 'energy_label', 'safety_warnings'];
const LOGISTICS_KEYS: (keyof ProductSpecification)[] = ['lead_time_days', 'shipping_class', 'is_fragile', 'is_hazardous', 'hazard_class', 'storage_instructions'];

function countFilled(spec: any, keys: string[]): number {
  if (!spec) return 0;
  return keys.filter(k => {
    const v = spec[k];
    if (v === null || v === undefined || v === '' || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;
}

export function ProductSpecificationsSection({ productId }: ProductSpecificationsSectionProps) {
  const {
    specification,
    customSpecs,
    isLoading,
    upsertSpec,
    addCustomSpec,
    updateCustomSpec,
    deleteCustomSpec,
  } = useProductSpecifications(productId);

  const handleChange = useCallback((updates: Partial<ProductSpecification>) => {
    upsertSpec(updates);
  }, [upsertSpec]);

  // Cast DB types to our local types
  const spec = specification as unknown as Partial<ProductSpecification> | null;
  const typedCustomSpecs = (customSpecs || []) as unknown as import('@/types/specifications').ProductCustomSpec[];

  const counts = useMemo(() => ({
    dimensions: countFilled(spec, DIMENSION_KEYS as string[]),
    identification: countFilled(spec, IDENTIFICATION_KEYS as string[]),
    material: countFilled(spec, MATERIAL_KEYS as string[]),
    compliance: countFilled(spec, COMPLIANCE_KEYS as string[]),
    logistics: countFilled(spec, LOGISTICS_KEYS as string[]),
  }), [spec]);

  const totalFilled = Object.values(counts).reduce((a, b) => a + b, 0) + typedCustomSpecs.length;
  const totalFields = DIMENSION_KEYS.length + IDENTIFICATION_KEYS.length + MATERIAL_KEYS.length + COMPLIANCE_KEYS.length + LOGISTICS_KEYS.length;

  const sections = [
    { key: 'dimensions', label: 'Afmetingen & Gewicht', icon: Ruler, count: counts.dimensions, total: DIMENSION_KEYS.length, Component: DimensionsFields },
    { key: 'identification', label: 'Identificatie', icon: Tag, count: counts.identification, total: IDENTIFICATION_KEYS.length, Component: IdentificationFields },
    { key: 'material', label: 'Materiaal & Samenstelling', icon: Palette, count: counts.material, total: MATERIAL_KEYS.length, Component: MaterialFields },
    { key: 'compliance', label: 'Garantie & Compliance', icon: ShieldCheck, count: counts.compliance, total: COMPLIANCE_KEYS.length, Component: ComplianceFields },
    { key: 'logistics', label: 'Logistiek', icon: Truck, count: counts.logistics, total: LOGISTICS_KEYS.length, Component: LogisticsFields },
  ];

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Technische Specificaties</CardTitle>
            <CardDescription>Gedetailleerde productinformatie voor marketplaces en kanalen</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {totalFilled} van {totalFields} ingevuld
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sections.map(({ key, label, icon: Icon, count, total, Component }) => (
          <Collapsible key={key}>
            <CollapsibleTrigger className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer">
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium flex-1 text-left">{label}</span>
              <span className="text-xs text-muted-foreground">{count > 0 ? `${count} ingevuld` : 'Leeg'}</span>
            </CollapsibleTrigger>
          <CollapsibleContent>
              <div className="pl-11 pr-2 pb-3 pt-1">
                <Component spec={spec} onChange={handleChange} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}

        {/* Custom specs */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer">
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
            <List className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1 text-left">Vrije specificaties</span>
            <span className="text-xs text-muted-foreground">{typedCustomSpecs.length > 0 ? `${typedCustomSpecs.length} items` : 'Leeg'}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pl-11 pr-2 pb-3 pt-1">
              <CustomSpecsEditor
                specs={typedCustomSpecs}
                productId={productId}
                onAdd={addCustomSpec}
                onUpdate={updateCustomSpec}
                onDelete={deleteCustomSpec}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
