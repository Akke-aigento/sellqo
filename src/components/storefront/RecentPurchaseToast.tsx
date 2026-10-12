import { useState, useEffect } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * APP-CLEAN-1 — "recent gekocht" op echte orders.
 *
 * Verzon tot 12-10-2026 stad, product en tijdstip met Math.random(). Nep-sociale
 * bewijskracht naar consumenten is een verboden handelspraktijk. Nu: alleen
 * betaalde webshoporders van de laatste 7 dagen (storefront_recent_purchases),
 * zonder stad of klant. Geen echte aankopen = geen melding.
 */
const SHOW_MS = 5000;
const GAP_MS = 30000;

interface RecentPurchaseToastProps {
  tenantId: string;
}

interface Purchase {
  product_name: string;
  purchased_at: string;
}

function timeAgo(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'gisteren' : `${days} dagen geleden`;
}

export function RecentPurchaseToast({ tenantId }: RecentPurchaseToastProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [current, setCurrent] = useState<Purchase | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .rpc('storefront_recent_purchases' as never, { p_tenant_id: tenantId } as never)
      .then(({ data }) => {
        if (active && Array.isArray(data)) setPurchases(data as Purchase[]);
      });
    return () => { active = false; };
  }, [tenantId]);

  useEffect(() => {
    if (purchases.length === 0) return;
    let index = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const show = () => {
      setCurrent(purchases[index % purchases.length]);
      index += 1;
      timers.push(setTimeout(() => setCurrent(null), SHOW_MS));
    };
    timers.push(setTimeout(show, 8000));
    const interval = setInterval(show, GAP_MS);
    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [purchases]);

  if (!current) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] animate-in slide-in-from-left-full duration-300 max-w-sm">
      <div className="bg-background border rounded-lg shadow-lg p-3 flex items-start gap-3">
        <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
          <ShoppingBag className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            &ldquo;{current.product_name}&rdquo; werd {timeAgo(current.purchased_at)} gekocht
          </p>
        </div>
        <button
          onClick={() => setCurrent(null)}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
