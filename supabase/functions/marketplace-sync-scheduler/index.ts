import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketplaceConnection {
  id: string;
  tenant_id: string;
  marketplace_type: string;
  is_active: boolean;
  last_sync_at: string | null;
  settings: {
    syncInterval?: number;
    autoImport?: boolean;
    autoSyncInventory?: boolean;
  } | null;
}

interface SyncResult {
  connectionId: string;
  marketplaceType: string;
  syncedOrders: boolean;
  syncedInventory: boolean;
  ordersImported?: number;
  productsSynced?: number;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[marketplace-sync-scheduler] Starting scheduled sync check...");

    // Fetch all active marketplace connections with autoImport enabled
    const { data: connections, error: fetchError } = await supabase
      .from("marketplace_connections")
      .select("id, tenant_id, marketplace_type, is_active, last_sync_at, settings")
      .eq("is_active", true);

    if (fetchError) {
      console.error("[marketplace-sync-scheduler] Error fetching connections:", fetchError);
      throw fetchError;
    }

    if (!connections || connections.length === 0) {
      console.log("[marketplace-sync-scheduler] No active connections found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active connections to sync",
          synced: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[marketplace-sync-scheduler] Found ${connections.length} active connections`);

    const results: SyncResult[] = [];
    const now = new Date();

    for (const conn of connections as MarketplaceConnection[]) {
      const settings = conn.settings || {};
      const syncInterval = settings.syncInterval || 15; // Default 15 minutes
      const autoImport = settings.autoImport !== false; // Default true
      const autoSyncInventory = settings.autoSyncInventory !== false; // Default true

      // Skip if autoImport is disabled
      if (!autoImport) {
        console.log(`[marketplace-sync-scheduler] Connection ${conn.id} has autoImport disabled, skipping`);
        continue;
      }

      // Calculate minutes since last sync
      const lastSync = conn.last_sync_at ? new Date(conn.last_sync_at) : new Date(0);
      const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / 60000;

      console.log(`[marketplace-sync-scheduler] Connection ${conn.id}: last sync ${minutesSinceLastSync.toFixed(1)} minutes ago, interval: ${syncInterval} min`);

      // Check if sync is needed
      if (minutesSinceLastSync < syncInterval) {
        console.log(`[marketplace-sync-scheduler] Connection ${conn.id} synced recently, skipping`);
        continue;
      }

      // Determine which sync function to call based on marketplace type
      const syncFunctionMap: Record<string, { orders: string; inventory: string }> = {
        bol_com: { orders: "sync-bol-orders", inventory: "sync-bol-inventory" },
        shopify: { orders: "sync-shopify-orders", inventory: "sync-shopify-inventory" },
        woocommerce: { orders: "sync-woocommerce-orders", inventory: "sync-woocommerce-inventory" },
        amazon: { orders: "sync-amazon-orders", inventory: "sync-amazon-inventory" },
        ebay: { orders: "sync-ebay-orders", inventory: "sync-ebay-inventory" },
      };

      const syncFns = syncFunctionMap[conn.marketplace_type];
      if (!syncFns) {
        console.log(`[marketplace-sync-scheduler] Unknown marketplace type: ${conn.marketplace_type}`);
        continue;
      }

      const result: SyncResult = {
        connectionId: conn.id,
        marketplaceType: conn.marketplace_type,
        syncedOrders: false,
        syncedInventory: false,
      };

      try {
        // Sync orders
        console.log(`[marketplace-sync-scheduler] Triggering ${syncFns.orders} for connection ${conn.id}`);
        
        const orderResponse = await fetch(`${supabaseUrl}/functions/v1/${syncFns.orders}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ connectionId: conn.id }),
        });

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          result.syncedOrders = true;
          result.ordersImported = orderData.ordersImported ?? orderData.orders_imported ?? 0;
          console.log(`[marketplace-sync-scheduler] Orders synced for ${conn.id}: ${result.ordersImported} imported`);
        } else {
          const errorText = await orderResponse.text();
          console.error(`[marketplace-sync-scheduler] Order sync failed for ${conn.id}:`, errorText);
          result.error = `Order sync failed: ${errorText}`;
        }

        // Sync inventory if enabled
        if (autoSyncInventory) {
          console.log(`[marketplace-sync-scheduler] Triggering ${syncFns.inventory} for connection ${conn.id}`);
          
          const inventoryResponse = await fetch(`${supabaseUrl}/functions/v1/${syncFns.inventory}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ connectionId: conn.id }),
          });

          if (inventoryResponse.ok) {
            const inventoryData = await inventoryResponse.json();
            result.syncedInventory = true;
            result.productsSynced = inventoryData.productsSynced ?? inventoryData.products_synced ?? 0;
            console.log(`[marketplace-sync-scheduler] Inventory synced for ${conn.id}: ${result.productsSynced} products`);
          } else {
            const errorText = await inventoryResponse.text();
            console.error(`[marketplace-sync-scheduler] Inventory sync failed for ${conn.id}:`, errorText);
            result.error = (result.error ? result.error + "; " : "") + `Inventory sync failed: ${errorText}`;
          }
        }

        // Sync tracking/shipments for Bol.com
        if (conn.marketplace_type === 'bol_com') {
          console.log(`[marketplace-sync-scheduler] Triggering update-bol-tracking for connection ${conn.id}`);
          try {
            const trackingResponse = await fetch(`${supabaseUrl}/functions/v1/update-bol-tracking`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ batch: true }),
            });
            if (trackingResponse.ok) {
              const trackingData = await trackingResponse.json();
              console.log(`[marketplace-sync-scheduler] Tracking synced for ${conn.id}: ${trackingData.updated ?? 0} updated`);
            } else {
              console.error(`[marketplace-sync-scheduler] Tracking sync failed for ${conn.id}:`, await trackingResponse.text());
            }
          } catch (trackErr) {
            console.error(`[marketplace-sync-scheduler] Tracking sync error for ${conn.id}:`, trackErr);
          }
        }
      } catch (syncError) {
        console.error(`[marketplace-sync-scheduler] Error syncing connection ${conn.id}:`, syncError);
        result.error = syncError instanceof Error ? syncError.message : String(syncError);
      }

      results.push(result);
    }

    const syncedCount = results.filter(r => r.syncedOrders || r.syncedInventory).length;
    console.log(`[marketplace-sync-scheduler] Completed. Synced ${syncedCount} connections.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scheduled sync completed`,
        totalConnections: connections.length,
        synced: syncedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[marketplace-sync-scheduler] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
