import { useState } from 'react';
import { ExternalLink, AlertTriangle, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import { resolveShopLink } from '@/lib/shopLinks';

/**
 * Radix Select accepteert geen `<SelectItem value="">` — een lege waarde is
 * gereserveerd voor de placeholder en levert een runtime-fout op. "Geen link"
 * en "Eigen link…" krijgen daarom een sentinel die bij het opslaan vertaald
 * wordt naar respectievelijk een lege string en vrije invoer.
 */
const NONE = '__none__';
const CUSTOM = '__custom__';

interface CategoryOption {
  id: string;
  slug: string;
  name: string;
}

interface SectionLinkFieldProps {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryOption[];
  label?: string;
}

/**
 * Keuzeveld voor `button_link` in sectie-content.
 *
 * Combineert snelkeuzes voor pagina's in de eigen winkel met vrije invoer voor
 * externe adressen. Tot WEBSHOP-5A was dit een dichte dropdown: een externe URL
 * kon niet worden ingevuld, terwijl `QuickEditPanel` in de visual editor wél een
 * vrij tekstveld had. Twee editors, verschillende mogelijkheden.
 *
 * De opgeslagen waarden blijven ongewijzigd: shop-relatieve paden zoals
 * `/products`, die de renderers via `resolveShopLink` tegen het winkelpad
 * oplossen. Er verandert dus niets aan het contract met custom frontends.
 */
export function SectionLinkField({
  value,
  onChange,
  categories,
  label = 'Knop Link',
}: SectionLinkFieldProps) {
  const { currentTenant } = useTenant();
  const basePath = currentTenant ? `/shop/${currentTenant.slug}` : '';

  const quickPicks = [
    { value: '/products', label: 'Alle producten' },
    { value: '/cart', label: 'Winkelwagen' },
    { value: '/', label: 'Homepage' },
    ...categories.map((cat) => ({
      value: `/products?category=${cat.slug}`,
      label: cat.name,
    })),
  ];

  const isQuickPick = quickPicks.some((p) => p.value === value);

  // Een waarde die niet in de lijst staat is vrije invoer — bijvoorbeeld een
  // externe URL die eerder via de visual editor is gezet. Die moet zichtbaar
  // blijven in plaats van stilzwijgend te worden overschreven.
  const [isCustom, setIsCustom] = useState(!!value && !isQuickPick);

  const selectValue = isCustom ? CUSTOM : value === '' ? NONE : value;

  const handleSelect = (next: string) => {
    if (next === NONE) {
      setIsCustom(false);
      onChange('');
      return;
    }
    if (next === CUSTOM) {
      // Waarde behouden zodat een bestaande link niet verdwijnt bij het
      // omschakelen naar vrije invoer.
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    onChange(next);
  };

  const resolved = resolveShopLink(value, basePath);

  const renderHint = () => {
    if (!value.trim()) return null;

    if (!resolved.href) {
      return (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Dit adres wordt geweigerd. Gebruik een pagina uit de lijst of een adres
          dat met <code>https://</code> begint.
        </p>
      );
    }

    if (resolved.isExternal) {
      return (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
          Externe link — opent in een nieuw tabblad.
        </p>
      );
    }

    return (
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
        Gaat naar <code className="break-all">{resolved.href}</code>
      </p>
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Selecteer bestemming" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Geen link</SelectItem>
          <SelectSeparator />
          {quickPicks.map((pick) => (
            <SelectItem key={pick.value} value={pick.value}>
              {pick.label}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Eigen link…</SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://voorbeeld.nl of /products"
          autoFocus
        />
      )}

      {renderHint()}
    </div>
  );
}
