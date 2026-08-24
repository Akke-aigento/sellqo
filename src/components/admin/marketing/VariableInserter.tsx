import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Variable } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VariableGroup {
  labelKey: string;
  variables: { key: string; labelKey: string }[];
}

// Labels staan als i18n-key; `key` is de merge-tag en blijft letterlijk.
const variableGroups: VariableGroup[] = [
  {
    labelKey: 'admin.marketing.variableInserter.groups.customer.label',
    variables: [
      { key: '{{customer_name}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_name' },
      { key: '{{customer_first_name}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_first_name' },
      { key: '{{customer_last_name}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_last_name' },
      { key: '{{customer_email}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_email' },
      { key: '{{customer_phone}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_phone' },
      { key: '{{customer_company}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_company' },
      { key: '{{customer_vat_number}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_vat_number' },
      { key: '{{customer_city}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_city' },
      { key: '{{customer_country}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.customer_country' },
      { key: '{{total_orders}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.total_orders' },
      { key: '{{total_spent}}', labelKey: 'admin.marketing.variableInserter.groups.customer.vars.total_spent' },
    ],
  },
  {
    labelKey: 'admin.marketing.variableInserter.groups.company.label',
    variables: [
      { key: '{{company_name}}', labelKey: 'admin.marketing.variableInserter.groups.company.vars.company_name' },
      { key: '{{company_email}}', labelKey: 'admin.marketing.variableInserter.groups.company.vars.company_email' },
      { key: '{{company_phone}}', labelKey: 'admin.marketing.variableInserter.groups.company.vars.company_phone' },
      { key: '{{company_website}}', labelKey: 'admin.marketing.variableInserter.groups.company.vars.company_website' },
      { key: '{{company_address}}', labelKey: 'admin.marketing.variableInserter.groups.company.vars.company_address' },
      { key: '{{company_iban}}', labelKey: 'admin.marketing.variableInserter.groups.company.vars.company_iban' },
    ],
  },
  {
    labelKey: 'admin.marketing.variableInserter.groups.brand.label',
    variables: [
      { key: '{{tenant_logo}}', labelKey: 'admin.marketing.variableInserter.groups.brand.vars.tenant_logo' },
      { key: '{{tenant_logo_url}}', labelKey: 'admin.marketing.variableInserter.groups.brand.vars.tenant_logo_url' },
      { key: '{{brand_primary_color}}', labelKey: 'admin.marketing.variableInserter.groups.brand.vars.brand_primary_color' },
      { key: '{{brand_accent_color}}', labelKey: 'admin.marketing.variableInserter.groups.brand.vars.brand_accent_color' },
      { key: '{{brand_heading_font}}', labelKey: 'admin.marketing.variableInserter.groups.brand.vars.brand_heading_font' },
    ],
  },
  {
    labelKey: 'admin.marketing.variableInserter.groups.system.label',
    variables: [
      { key: '{{current_date}}', labelKey: 'admin.marketing.variableInserter.groups.system.vars.current_date' },
      { key: '{{unsubscribe_url}}', labelKey: 'admin.marketing.variableInserter.groups.system.vars.unsubscribe_url' },
      { key: '{{subject}}', labelKey: 'admin.marketing.variableInserter.groups.system.vars.subject' },
    ],
  },
];

interface VariableInserterProps {
  onInsert: (variable: string) => void;
  filterKeys?: string[];
}

export function VariableInserter({ onInsert, filterKeys }: VariableInserterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Variable className="h-3.5 w-3.5" />
        <span>{t('admin.marketing.variableInserter.variabelen_invoegen')}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {variableGroups.map((group) => {
          const filteredVars = filterKeys
            ? group.variables.filter((v) => filterKeys.includes(v.key))
            : group.variables;
          if (filteredVars.length === 0) return null;
          return (
            <div key={group.labelKey}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {t(group.labelKey)}
              </p>
              <div className="flex flex-wrap gap-1">
                {filteredVars.map((v) => (
                  <Badge
                    key={v.key}
                    variant="outline"
                    className="cursor-pointer text-[11px] px-1.5 py-0 h-5 hover:bg-accent transition-colors"
                    onClick={() => onInsert(v.key)}
                    title={v.key}
                  >
                    {t(v.labelKey)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
