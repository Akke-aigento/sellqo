import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { OrderStatus, PaymentStatus, MarketplaceSource, OrderFilters as OrderFiltersType } from '@/types/order';
import { useTranslation } from 'react-i18next';

interface OrderFiltersProps {
  filters: OrderFiltersType;
  onFiltersChange: (filters: OrderFiltersType) => void;
}

export function OrderFilters({ filters, onFiltersChange }: OrderFiltersProps) {
  const { t } = useTranslation();
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
          placeholder={t('admin.orderFilters.zoek_op_ordernummer_email')}
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
          <SelectValue placeholder={t('admin.customers.bron')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.orderFilters.alle_bronnen')}</SelectItem>
          <SelectItem value="sellqo_webshop">{t('admin.orderFilters.sellqo_webshop')}</SelectItem>
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
          <SelectValue placeholder={t('admin.orderFilters.orderstatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.marketing.contentHistoryList.alle_statussen')}</SelectItem>
          <SelectItem value="pending">{t('admin.marketing.aBTestingPanel.in_afwachting')}</SelectItem>
          <SelectItem value="processing">{t('admin.orderFilters.in_behandeling')}</SelectItem>
          <SelectItem value="shipped">{t('admin.marketing.campaignCard.status.verzonden')}</SelectItem>
          <SelectItem value="delivered">{t('admin.marketing.campaignFunnel.afgeleverd')}</SelectItem>
          <SelectItem value="cancelled">{t('admin.marketing.aBTestingPanel.geannuleerd')}</SelectItem>
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
          <SelectValue placeholder={t('admin.orderFilters.betaalstatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.orderFilters.alle_betalingen')}</SelectItem>
          <SelectItem value="pending">{t('admin.orderFilters.onbetaald')}</SelectItem>
          <SelectItem value="paid">{t('admin.orderFilters.betaald')}</SelectItem>
          <SelectItem value="refunded">{t('admin.orderFilters.terugbetaald')}</SelectItem>
          <SelectItem value="failed">{t('admin.marketing.contentHistoryList.status.mislukt')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters} title={t('admin.orderFilters.filters_wissen')}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
