import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ReturnFilters as ReturnFiltersType } from '@/hooks/useReturns';

interface ReturnFiltersProps {
  filters: ReturnFiltersType;
  onFiltersChange: (filters: ReturnFiltersType) => void;
}

export function ReturnFilters({ filters, onFiltersChange }: ReturnFiltersProps) {
  const hasFilters = filters.status || filters.source || filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Input
        placeholder="Zoek op RMA, klantnaam of order-ID..."
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
        className="sm:max-w-xs"
      />
      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, status: v === 'all' ? undefined : v as any })}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statussen</SelectItem>
          <SelectItem value="requested">Aangevraagd</SelectItem>
          <SelectItem value="approved">Goedgekeurd</SelectItem>
          <SelectItem value="shipped_by_customer">Verzonden</SelectItem>
          <SelectItem value="received">Ontvangen</SelectItem>
          <SelectItem value="inspecting">In inspectie</SelectItem>
          <SelectItem value="awaiting_refund">Wacht op refund</SelectItem>
          <SelectItem value="completed">Afgerond</SelectItem>
          <SelectItem value="rejected">Geweigerd</SelectItem>
          <SelectItem value="cancelled">Geannuleerd</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.source || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, source: v === 'all' ? undefined : v as any })}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="Bron" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle bronnen</SelectItem>
          <SelectItem value="manual">SellQo / Stripe</SelectItem>
          <SelectItem value="bolcom">Bol.com</SelectItem>
          <SelectItem value="amazon">Amazon</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={() => onFiltersChange({})}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
