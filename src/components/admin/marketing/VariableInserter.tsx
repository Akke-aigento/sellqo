import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Variable } from 'lucide-react';

interface VariableGroup {
  label: string;
  variables: { key: string; label: string }[];
}

const variableGroups: VariableGroup[] = [
  {
    label: 'Klant',
    variables: [
      { key: '{{customer_name}}', label: 'Volledige naam' },
      { key: '{{customer_first_name}}', label: 'Voornaam' },
      { key: '{{customer_last_name}}', label: 'Achternaam' },
      { key: '{{customer_email}}', label: 'E-mail' },
      { key: '{{customer_phone}}', label: 'Telefoon' },
      { key: '{{customer_company}}', label: 'Bedrijfsnaam' },
      { key: '{{customer_vat_number}}', label: 'BTW-nummer' },
      { key: '{{customer_city}}', label: 'Stad' },
      { key: '{{customer_country}}', label: 'Land' },
      { key: '{{total_orders}}', label: 'Aantal bestellingen' },
      { key: '{{total_spent}}', label: 'Totaal besteed' },
    ],
  },
  {
    label: 'Bedrijf',
    variables: [
      { key: '{{company_name}}', label: 'Bedrijfsnaam' },
      { key: '{{company_email}}', label: 'E-mail' },
      { key: '{{company_phone}}', label: 'Telefoon' },
      { key: '{{company_website}}', label: 'Website' },
      { key: '{{company_address}}', label: 'Adres' },
      { key: '{{company_iban}}', label: 'IBAN' },
    ],
  },
  {
    label: 'Systeem',
    variables: [
      { key: '{{current_date}}', label: 'Huidige datum' },
      { key: '{{unsubscribe_url}}', label: 'Uitschrijflink' },
      { key: '{{subject}}', label: 'Onderwerp' },
    ],
  },
];

interface VariableInserterProps {
  onInsert: (variable: string) => void;
  filterKeys?: string[];
}

export function VariableInserter({ onInsert, filterKeys }: VariableInserterProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Variable className="h-3.5 w-3.5" />
        <span>Variabelen invoegen</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {variableGroups.map((group) => {
          const filteredVars = filterKeys
            ? group.variables.filter((v) => filterKeys.includes(v.key))
            : group.variables;
          if (filteredVars.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {group.label}
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
                    {v.label}
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
