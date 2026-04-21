import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonitorRequest {
  tenantId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { tenantId }: MonitorRequest = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions: Array<{
      suggestion_type: string;
      title: string;
      description: string;
      priority: string;
      confidence_score: number;
      reasoning: string;
      action_data: Record<string, unknown>;
      expires_at?: string;
    }> = [];

    // 1. Stock Analysis
    const { data: products } = await supabase
      .from('products')
      .select(`
        id, name, stock, price,
        product_suppliers (
          supplier_id,
          lead_time_days,
          cost_price,
          suppliers (id, name)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('track_inventory', true)
      .eq('is_active', true);

    // Get sales data for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        orders!inner (tenant_id, created_at, status)
      `)
      .eq('orders.tenant_id', tenantId)
      .gte('orders.created_at', thirtyDaysAgo.toISOString())
      .neq('orders.status', 'cancelled');

    // Calculate sales per product
    const salesByProduct: Record<string, number> = {};
    orderItems?.forEach(item => {
      salesByProduct[item.product_id] = (salesByProduct[item.product_id] || 0) + item.quantity;
    });

    // Analyze each product
    for (const product of products || []) {
      const totalSales = salesByProduct[product.id] || 0;
      const avgDailySales = totalSales / 30;
      
      if (avgDailySales > 0 && product.stock !== null) {
        const daysUntilStockout = product.stock / avgDailySales;
        const supplier = (product.product_suppliers as any)?.[0];
        const leadTime = supplier?.lead_time_days || 7;
        const bufferDays = 2;

        // Check if we need to reorder
        if (daysUntilStockout <= leadTime + bufferDays + 3) {
          const suggestedQuantity = Math.ceil(avgDailySales * 30); // 1 month supply
          const priority = daysUntilStockout <= 3 ? 'urgent' : 
                          daysUntilStockout <= 7 ? 'high' : 'medium';

          suggestions.push({
            suggestion_type: 'stock_alert',
            title: `Herbestelling: ${product.name}`,
            description: `Voorraad van ${product.stock} stuks is over ${Math.round(daysUntilStockout)} dagen uitverkocht bij huidige verkoop van ${avgDailySales.toFixed(1)}/dag.`,
            priority,
            confidence_score: Math.min(0.95, 0.7 + (avgDailySales > 5 ? 0.2 : 0.1)),
            reasoning: `Op basis van de gemiddelde verkoop van ${avgDailySales.toFixed(1)} stuks per dag (afgelopen 30 dagen) en een huidige voorraad van ${product.stock} stuks, is dit product over ongeveer ${Math.round(daysUntilStockout)} dagen uitverkocht. ${supplier ? `Levertijd bij ${supplier.suppliers?.name || 'leverancier'} is ${leadTime} dagen.` : 'Geen leverancier gekoppeld.'}`,
            action_data: {
              type: 'stock_reorder',
              product_id: product.id,
              product_name: product.name,
              current_stock: product.stock,
              avg_daily_sales: avgDailySales,
              days_until_stockout: daysUntilStockout,
              supplier_id: supplier?.supplier_id,
              supplier_name: supplier?.suppliers?.name,
              lead_time_days: leadTime,
              suggested_quantity: suggestedQuantity,
              unit_cost: supplier?.cost_price || 0,
            },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });

          // Also create a purchase order suggestion if supplier exists
          if (supplier?.supplier_id) {
            suggestions.push({
              suggestion_type: 'purchase_order',
              title: `Inkooporder voor ${product.name}`,
              description: `Plaats een inkooporder van ${suggestedQuantity} stuks bij ${supplier.suppliers?.name || 'leverancier'}.`,
              priority: priority === 'urgent' ? 'high' : 'medium',
              confidence_score: 0.85,
              reasoning: `Automatische herbestelsuggestie gebaseerd op voorraadanalyse.`,
              action_data: {
                type: 'create_purchase_order',
                supplier_id: supplier.supplier_id,
                supplier_name: supplier.suppliers?.name,
                items: [{
                  product_id: product.id,
                  product_name: product.name,
                  current_stock: product.stock,
                  suggested_quantity: suggestedQuantity,
                  unit_cost: supplier.cost_price || 0,
                  total: suggestedQuantity * (supplier.cost_price || 0),
                }],
                estimated_delivery: new Date(Date.now() + leadTime * 24 * 60 * 60 * 1000).toISOString(),
                total_value: suggestedQuantity * (supplier.cost_price || 0),
              },
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
      }
    }

    // 2. Inactive customer analysis (win-back opportunities)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: inactiveCustomers, count: inactiveCount } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, total_spent', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gt('total_spent', 100) // VIP customers
      .or(`total_orders.eq.0,updated_at.lt.${sixtyDaysAgo.toISOString()}`)
      .limit(50);

    if (inactiveCount && inactiveCount >= 5) {
      suggestions.push({
        suggestion_type: 'customer_winback',
        title: `Win-back campagne voor ${inactiveCount} VIP klanten`,
        description: `${inactiveCount} klanten met €100+ besteed zijn al 60+ dagen niet actief.`,
        priority: 'medium',
        confidence_score: 0.78,
        reasoning: `Er zijn ${inactiveCount} waardevolle klanten (gem. besteding > €100) die al meer dan 60 dagen geen aankoop hebben gedaan. Een win-back campagne met persoonlijke korting kan deze klanten reactiveren.`,
        action_data: {
          type: 'create_winback_campaign',
          customer_ids: inactiveCustomers?.map(c => c.id) || [],
          customer_count: inactiveCount,
          suggested_discount: 15,
          email_subject: 'We missen je! Hier is een speciale korting',
          email_content: 'Het is even geleden! Als dank voor je eerdere bestellingen krijg je 15% korting op je volgende aankoop.',
        },
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // 3. Trending product marketing opportunity
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentSales } = await supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        products (id, name, price, images),
        orders!inner (tenant_id, created_at, status)
      `)
      .eq('orders.tenant_id', tenantId)
      .gte('orders.created_at', sevenDaysAgo.toISOString())
      .neq('orders.status', 'cancelled');

    // Find products with significant increase
    const recentSalesByProduct: Record<string, { qty: number; product: any }> = {};
    recentSales?.forEach(item => {
      if (!recentSalesByProduct[item.product_id]) {
        recentSalesByProduct[item.product_id] = { qty: 0, product: item.products };
      }
      recentSalesByProduct[item.product_id].qty += item.quantity;
    });

    const topProducts = Object.entries(recentSalesByProduct)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 3);

    if (topProducts.length > 0 && topProducts[0][1].qty >= 10) {
      const [productId, { qty, product }] = topProducts[0];
      suggestions.push({
        suggestion_type: 'marketing_campaign',
        title: `Bestseller spotlight: ${product?.name || 'Top product'}`,
        description: `${product?.name || 'Dit product'} heeft ${qty} verkopen in de afgelopen week. Maak hier een marketing campagne voor.`,
        priority: 'low',
        confidence_score: 0.72,
        reasoning: `Dit product is je bestseller van de week met ${qty} verkopen. Een gerichte social media post of email campagne kan dit momentum versterken.`,
        action_data: {
          type: 'create_marketing_campaign',
          campaign_type: 'social',
          product_ids: [productId],
          content: `🔥 Onze bestseller van de week: ${product?.name || 'Check onze topproduct'}! Ontdek waarom iedereen ervan houdt.`,
          platform: 'instagram',
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Insert all suggestions
    if (suggestions.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_action_suggestions')
        .insert(suggestions.map(s => ({
          tenant_id: tenantId,
          ...s,
        })));

      if (insertError) {
        console.error('Error inserting suggestions:', insertError);
      }

      // Create notifications for urgent/high priority suggestions
      const urgentSuggestions = suggestions.filter(s => s.priority === 'urgent' || s.priority === 'high');
      for (const suggestion of urgentSuggestions) {
        await supabase.functions.invoke('create-notification', {
          body: {
            tenantId,
            category: 'system',
            type: 'ai_suggestion',
            title: `AI Suggestie: ${suggestion.title}`,
            message: suggestion.description,
            priority: suggestion.priority,
            actionUrl: '/admin/ai-center',
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestionsCreated: suggestions.length,
        suggestions: suggestions.map(s => ({ type: s.suggestion_type, title: s.title, priority: s.priority })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Monitor error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
