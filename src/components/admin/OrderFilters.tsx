import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { OrderStatus, PaymentStatus, MarketplaceSource, OrderFilters as OrderFiltersType } from '@/types/order';

interface OrderFiltersProps {
  filters: OrderFiltersType;
  onFiltersChange: (filters: OrderFiltersType) => void;
}

export function OrderFilters({ filters, onFiltersChange }: OrderFiltersProps) {
  const hasFilters = filters.status || filters.payment_status || filters.search || filters.marketplace_source;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek op ordernummer, email..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          className="pl-9"
        />
      </div>

      {/* Marketplace Source Filter */}
      <Select
        value={filters.marketplace_source || 'all'}
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          marketplace_source: value === 'all' ? undefined : value as MarketplaceSource 
        })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Bron" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle bronnen</SelectItem>
          <SelectItem value="sellqo_webshop">SellQo Webshop</SelectItem>
          <SelectItem value="bol_com">Bol.com</SelectItem>
          <SelectItem value="amazon">Amazon</SelectItem>
        </SelectContent>
      </Select>

      {/* Order Status Filter */}
      <Select
        value={filters.status || 'all'}
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          status: value === 'all' ? undefined : value as OrderStatus 
        })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Orderstatus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statussen</SelectItem>
          <SelectItem value="pending">In afwachting</SelectItem>
          <SelectItem value="processing">In behandeling</SelectItem>
          <SelectItem value="shipped">Verzonden</SelectItem>
          <SelectItem value="delivered">Afgeleverd</SelectItem>
          <SelectItem value="cancelled">Geannuleerd</SelectItem>
        </SelectContent>
      </Select>

      {/* Payment Status Filter */}
      <Select
        value={filters.payment_status || 'all'}
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          payment_status: value === 'all' ? undefined : value as PaymentStatus 
        })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Betaalstatus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle betalingen</SelectItem>
          <SelectItem value="pending">Onbetaald</SelectItem>
          <SelectItem value="paid">Betaald</SelectItem>
          <SelectItem value="refunded">Terugbetaald</SelectItem>
          <SelectItem value="failed">Mislukt</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters} title="Filters wissen">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
