import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

interface OssRevenueData {
  totalRevenue: number;
  revenueByCountry: Record<string, number>;
  thresholdPercentage: number;
  isNearThreshold: boolean;
  isOverThreshold: boolean;
}

const OSS_THRESHOLD = 10000; // €10.000 threshold

export function useOssRevenue() {
  const { currentTenant } = useTenant();
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['oss-revenue', currentTenant?.id, currentYear],
    queryFn: async (): Promise<OssRevenueData> => {
      if (!currentTenant) {
        return {
          totalRevenue: 0,
          revenueByCountry: {},
          thresholdPercentage: 0,
          isNearThreshold: false,
          isOverThreshold: false,
        };
      }

      const tenantCountry = (currentTenant as any).country || 'NL';
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      // Fetch all paid orders with customers from this year
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          customer_id,
          created_at,
          customers!inner (
            customer_type,
            billing_country
          )
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('payment_status', 'paid')
        .gte('created_at', startOfYear)
        .lte('created_at', endOfYear);

      if (error) {
        console.error('Error fetching OSS revenue:', error);
        throw error;
      }

      // EU countries list
      const euCountries = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
      ];

      const revenueByCountry: Record<string, number> = {};
      let totalRevenue = 0;

      orders?.forEach((order: any) => {
        const customer = order.customers;
        const customerCountry = customer?.billing_country || 'NL';
        const isB2C = customer?.customer_type !== 'b2b';
        const isEuCountry = euCountries.includes(customerCountry);
        const isSameCountry = customerCountry === tenantCountry;

        // Only count B2C orders to other EU countries
        if (isB2C && isEuCountry && !isSameCountry) {
          const amount = Number(order.total) || 0;
          revenueByCountry[customerCountry] = (revenueByCountry[customerCountry] || 0) + amount;
          totalRevenue += amount;
        }
      });

      const thresholdPercentage = Math.min((totalRevenue / OSS_THRESHOLD) * 100, 100);
      const isNearThreshold = thresholdPercentage >= 80 && thresholdPercentage < 100;
      const isOverThreshold = thresholdPercentage >= 100;

      return {
        totalRevenue,
        revenueByCountry,
        thresholdPercentage,
        isNearThreshold,
        isOverThreshold,
      };
    },
    enabled: !!currentTenant?.id,
  });
}

export const OSS_THRESHOLD_AMOUNT = OSS_THRESHOLD;
