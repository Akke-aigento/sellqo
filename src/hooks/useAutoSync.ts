import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MarketplaceConnection } from '@/types/marketplace';

interface UseAutoSyncOptions {
  connection: MarketplaceConnection | null | undefined;
  enabled?: boolean;
  onSyncComplete?: () => void;
}

/**
 * Client-side auto-sync hook that triggers marketplace sync
 * when the user is viewing the marketplace detail page.
 * Acts as a fallback/supplement to the server-side cron scheduler.
 */
export function useAutoSync({ 
  connection, 
  enabled = true,
  onSyncComplete 
}: UseAutoSyncOptions) {
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);
  const lastSyncTriggeredRef = useRef<number>(0);

  // Get sync function names based on marketplace type
  const getSyncFunctions = useCallback((type: string) => {
    switch (type) {
      case 'shopify':
        return { orders: 'sync-shopify-orders', inventory: 'sync-shopify-inventory' };
      case 'woocommerce':
        return { orders: 'sync-woocommerce-orders', inventory: 'sync-woocommerce-inventory' };
      case 'amazon':
        return { orders: 'sync-amazon-orders', inventory: 'sync-amazon-inventory' };
      case 'ebay':
        return { orders: 'sync-ebay-orders', inventory: 'sync-ebay-inventory' };
      default:
        return { orders: 'sync-bol-orders', inventory: 'sync-bol-inventory' };
    }
  }, []);

  // Trigger sync for the connection
  const triggerSync = useCallback(async (conn: MarketplaceConnection) => {
    if (syncInProgressRef.current) {
      console.log('[useAutoSync] Sync already in progress, skipping');
      return;
    }

    syncInProgressRef.current = true;
    lastSyncTriggeredRef.current = Date.now();

    try {
      const syncFns = getSyncFunctions(conn.marketplace_type);
      console.log(`[useAutoSync] Triggering auto-sync for ${conn.id}`);

      // Sync orders (silently - no toast for auto-sync)
      const orderResult = await supabase.functions.invoke(syncFns.orders, {
        body: { connectionId: conn.id }
      });

      if (orderResult.error) {
        console.error('[useAutoSync] Order sync error:', orderResult.error);
      } else {
        const imported = orderResult.data?.ordersImported ?? orderResult.data?.orders_imported ?? 0;
        if (imported > 0) {
          toast.success(`Auto-sync: ${imported} nieuwe orders`, { duration: 3000 });
        }
        console.log(`[useAutoSync] Orders synced: ${imported} imported`);
      }

      // Sync inventory if enabled
      if (conn.settings?.autoSyncInventory !== false) {
        const inventoryResult = await supabase.functions.invoke(syncFns.inventory, {
          body: { connectionId: conn.id }
        });

        if (inventoryResult.error) {
          console.error('[useAutoSync] Inventory sync error:', inventoryResult.error);
        } else {
          const synced = inventoryResult.data?.productsSynced ?? inventoryResult.data?.products_synced ?? 0;
          console.log(`[useAutoSync] Inventory synced: ${synced} products`);
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', conn.id] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-connection', conn.id] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      queryClient.invalidateQueries({ queryKey: ['sync-activities', conn.id] });
      queryClient.invalidateQueries({ queryKey: ['sync-history', conn.id] });

      onSyncComplete?.();
    } catch (error) {
      console.error('[useAutoSync] Error during auto-sync:', error);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [getSyncFunctions, queryClient, onSyncComplete]);

  useEffect(() => {
    if (!enabled || !connection || !connection.is_active) {
      return;
    }

    const settings = connection.settings;
    const autoImport = settings?.autoImport !== false;
    const syncIntervalMinutes = settings?.syncInterval || 15;

    if (!autoImport) {
      console.log('[useAutoSync] Auto-import is disabled for this connection');
      return;
    }

    // Check if sync is needed on mount
    const checkAndSync = () => {
      if (!connection.is_active) return;
      
      const lastSync = connection.last_sync_at ? new Date(connection.last_sync_at).getTime() : 0;
      const now = Date.now();
      const minutesSinceLastSync = (now - lastSync) / 60000;
      
      // Also check if we triggered a sync recently from this hook
      const minutesSinceLastTrigger = (now - lastSyncTriggeredRef.current) / 60000;

      console.log(`[useAutoSync] Last sync: ${minutesSinceLastSync.toFixed(1)} min ago, interval: ${syncIntervalMinutes} min`);

      // Only trigger if both the database last_sync and our local trigger are older than the interval
      if (minutesSinceLastSync >= syncIntervalMinutes && minutesSinceLastTrigger >= syncIntervalMinutes) {
        console.log('[useAutoSync] Sync interval exceeded, triggering auto-sync');
        triggerSync(connection);
      }
    };

    // Check immediately on mount
    checkAndSync();

    // Set up interval for periodic checks while user is viewing the page
    const intervalMs = Math.max(syncIntervalMinutes * 60 * 1000, 60000); // At least 1 minute
    const interval = setInterval(checkAndSync, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [connection, enabled, triggerSync]);

  return {
    triggerManualSync: connection ? () => triggerSync(connection) : undefined,
    isSyncing: syncInProgressRef.current,
  };
}
