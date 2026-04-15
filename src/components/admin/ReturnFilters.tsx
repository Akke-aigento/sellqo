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
  const hasFilters = filters.status || filters.refundStatus || filters.source || filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
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
          <SelectValue placeholder="Logistieke status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statussen</SelectItem>
          <SelectItem value="requested">Aangevraagd</SelectItem>
          <SelectItem value="approved">Goedgekeurd</SelectItem>
          <SelectItem value="label_sent">Label verstuurd</SelectItem>
          <SelectItem value="shipped">Verzonden</SelectItem>
          <SelectItem value="received">Ontvangen</SelectItem>
          <SelectItem value="inspecting">In inspectie</SelectItem>
          <SelectItem value="inspected">Geïnspecteerd</SelectItem>
          <SelectItem value="closed">Gesloten</SelectItem>
          <SelectItem value="rejected">Geweigerd</SelectItem>
          <SelectItem value="cancelled">Geannuleerd</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.refundStatus || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, refundStatus: v === 'all' ? undefined : v as any })}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="Refund status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle refund statussen</SelectItem>
          <SelectItem value="pending">In afwachting</SelectItem>
          <SelectItem value="approved_for_refund">Goedgekeurd</SelectItem>
          <SelectItem value="initiated">Geïnitieerd</SelectItem>
          <SelectItem value="completed">Voltooid</SelectItem>
          <SelectItem value="failed">Mislukt</SelectItem>
          <SelectItem value="denied">Afgewezen</SelectItem>
          <SelectItem value="not_applicable">N.v.t.</SelectItem>
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
