import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Mail, MapPin, ShoppingBag, Loader2 } from 'lucide-react';
import type { SegmentFilterRules } from '@/types/marketing';

interface SegmentCustomerPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentName: string;
  filterRules: SegmentFilterRules;
}

interface PreviewCustomer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  country: string | null;
  total_orders: number | null;
  total_spent: number | null;
  customer_type: string | null;
  auto_tags: string[] | null;
}

export function SegmentCustomerPreview({ open, onOpenChange, segmentName, filterRules }: SegmentCustomerPreviewProps) {
  const { currentTenant } = useTenant();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['segment-preview', currentTenant?.id, filterRules],
    queryFn: async (): Promise<PreviewCustomer[]> => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('customers')
        .select('id, first_name, last_name, email, country, total_orders, total_spent, customer_type, auto_tags')
        .eq('tenant_id', currentTenant.id);

      // Apply filters
      if (filterRules.customer_type && filterRules.customer_type !== 'all') {
        query = query.eq('customer_type', filterRules.customer_type);
      }
      if (filterRules.countries && filterRules.countries.length > 0) {
        query = query.in('country', filterRules.countries);
      }
      if (filterRules.min_orders !== undefined) {
        query = query.gte('total_orders', filterRules.min_orders);
      }
      if (filterRules.max_orders !== undefined) {
        query = query.lte('total_orders', filterRules.max_orders);
      }
      if (filterRules.min_total_spent !== undefined) {
        query = query.gte('total_spent', filterRules.min_total_spent);
      }
      if (filterRules.max_total_spent !== undefined) {
        query = query.lte('total_spent', filterRules.max_total_spent);
      }
      if (filterRules.auto_tags && filterRules.auto_tags.length > 0) {
        query = query.overlaps('auto_tags', filterRules.auto_tags);
      }

      const { data, error } = await (query as any).limit(50).order('total_spent', { ascending: false });
      if (error) throw error;
      return (data || []) as PreviewCustomer[];
    },
    enabled: open && !!currentTenant?.id,
  });

  const tagColors: Record<string, string> = {
    VIP: 'bg-yellow-100 text-yellow-800',
    Loyal: 'bg-green-100 text-green-800',
    New: 'bg-blue-100 text-blue-800',
    Sleeping: 'bg-muted text-muted-foreground',
    'At Risk': 'bg-orange-100 text-orange-800',
    Lost: 'bg-red-100 text-red-800',
    'High Value': 'bg-emerald-100 text-emerald-800',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Klantpreview: {segmentName}
          </DialogTitle>
          <DialogDescription>
            Eerste 50 klanten die matchen met de segmentfilters
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Geen klanten gevonden voor deze filters</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left">
                  <th className="py-2 px-3 font-medium">Klant</th>
                  <th className="py-2 px-3 font-medium">Land</th>
                  <th className="py-2 px-3 font-medium text-right">Orders</th>
                  <th className="py-2 px-3 font-medium text-right">Besteed</th>
                  <th className="py-2 px-3 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/50">
                    <td className="py-2.5 px-3">
                      <div>
                        <p className="font-medium">
                          {customer.first_name || ''} {customer.last_name || ''}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </p>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {customer.country && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {customer.country}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {customer.total_orders || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      €{(customer.total_spent || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(customer.auto_tags || []).slice(0, 3).map(tag => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className={`text-[10px] ${tagColors[tag] || ''}`}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground text-center py-3 border-t">
              Toont {customers.length} van de matchende klanten (gesorteerd op besteed bedrag)
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
