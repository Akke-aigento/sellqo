import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoachRequest {
  tenantId: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  action_type: 'navigate' | 'execute' | 'dismiss' | 'snooze' | 'open_visual_editor';
  action_url?: string;
  action_function?: string;
  action_params?: Record<string, unknown>;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';
}

interface AnalysisResult {
  suggestion_type: string;
  title: string;
  description: string;
  conversational_message: string;
  priority: string;
  confidence_score: number;
  reasoning: string;
  action_data: Record<string, unknown>;
  quick_actions: QuickAction[];
  related_entity_type?: string;
  related_entity_id?: string;
  analysis_context?: Record<string, unknown>;
  expires_at?: string;
}

// Generate conversational message with emoji
function generateConversationalMessage(type: string, data: Record<string, unknown>, showEmoji: boolean): string {
  const emoji = showEmoji ? {
    stock: '📦',
    sales: '🎉',
    customer: '👋',
    invoice: '💰',
    quote: '📝',
    cart: '🛒',
    subscription: '🔄',
  } : {};

  switch (type) {
    case 'stock_alert':
      return `${emoji.stock || ''} Hey! Even een heads-up: je "${data.product_name}" vliegt de deur uit! Nog maar ${data.current_stock} op voorraad - over ${Math.round(data.days_until_stockout as number)} dagen is 'ie uitverkocht.`.trim();
    
    case 'sales_spike':
      return `${emoji.sales || ''} Wauw! "${data.product_name}" verkocht ${data.sales_increase}x zoveel als normaal (${data.current_sales} vs ${data.average_sales}). Perfect moment voor een boost!`.trim();
    
    case 'vip_inactive':
      return `${emoji.customer || ''} Even checken: ${data.customer_name} - een van je beste klanten - is al ${data.inactive_days} dagen niet actief. Tijd voor een persoonlijk berichtje?`.trim();
    
    case 'invoice_overdue':
      return `${emoji.invoice || ''} Factuur ${data.invoice_number} van €${data.amount} is nu ${data.days_overdue} dagen over datum. Zal ik een vriendelijke herinnering sturen?`.trim();
    
    case 'quote_expiring':
      return `${emoji.quote || ''} Heads up: offerte ${data.quote_number} voor ${data.customer_name} (€${data.amount}) verloopt over ${data.days_until_expiry} dagen. Follow-up nodig?`.trim();
    
    case 'abandoned_carts':
      return `${emoji.cart || ''} Interessant: ${data.cart_count} klanten hebben hun winkelwagen achtergelaten deze week. Samen goed voor €${data.potential_revenue}. Een klein duwtje kan helpen!`.trim();
    
    case 'subscription_expiring':
      return `${emoji.subscription || ''} Het abonnement van ${data.customer_name} verloopt over ${data.days_until_expiry} dagen. Tijd voor een renewal campagne?`.trim();
    
    case 'customer_winback':
      return `${emoji.customer || ''} ${data.customer_count} VIP klanten zijn al 60+ dagen niet actief. Een win-back campagne kan ze terugbrengen!`.trim();
    
    case 'marketing_campaign':
      return `${emoji.sales || ''} "${data.product_name}" is je bestseller van de week met ${data.sales_count} verkopen. Maak hier een marketing campagne voor!`.trim();
    
    default:
      return data.description as string || 'Nieuwe AI suggestie beschikbaar.';
  }
}

// Generate quick actions based on suggestion type
function generateQuickActions(type: string, data: Record<string, unknown>): QuickAction[] {
  const actions: QuickAction[] = [];

  switch (type) {
    case 'stock_alert':
      actions.push({
        id: 'create_po',
        label: `Bestel ${data.suggested_quantity || 50} stuks`,
        icon: 'Package',
        action_type: 'navigate',
        action_url: `/admin/purchase-orders/new?product=${data.product_id}&quantity=${data.suggested_quantity}`,
        variant: 'primary',
      });
      actions.push({
        id: 'view_stock',
        label: 'Bekijk voorraad',
        icon: 'PackageSearch',
        action_type: 'navigate',
        action_url: `/admin/products/${data.product_id}`,
        variant: 'outline',
      });
      break;

    case 'sales_spike':
    case 'marketing_campaign':
      actions.push({
        id: 'create_social',
        label: 'Maak social post',
        icon: 'Instagram',
        action_type: 'navigate',
        action_url: `/admin/marketing/ai?tab=social&product=${data.product_id || (data.product_ids as string[])?.[0]}`,
        variant: 'primary',
      });
      actions.push({
        id: 'create_email',
        label: 'Email VIPs',
        icon: 'Mail',
        action_type: 'navigate',
        action_url: `/admin/marketing/campaigns/new?segment=vip&product=${data.product_id || (data.product_ids as string[])?.[0]}`,
        variant: 'outline',
      });
      break;

    case 'vip_inactive':
    case 'customer_winback':
      actions.push({
        id: 'create_winback',
        label: 'Start win-back',
        icon: 'UserCheck',
        action_type: 'navigate',
        action_url: '/admin/marketing/campaigns/new?type=winback',
        variant: 'primary',
      });
      actions.push({
        id: 'view_customers',
        label: 'Bekijk klanten',
        icon: 'Users',
        action_type: 'navigate',
        action_url: '/admin/customers?filter=inactive',
        variant: 'outline',
      });
      break;

    case 'invoice_overdue':
      actions.push({
        id: 'send_reminder',
        label: 'Stuur herinnering',
        icon: 'Send',
        action_type: 'execute',
        action_function: 'send-invoice-reminder',
        action_params: { invoice_id: data.invoice_id },
        variant: 'primary',
      });
      actions.push({
        id: 'view_invoice',
        label: 'Bekijk factuur',
        icon: 'FileText',
        action_type: 'navigate',
        action_url: `/admin/invoices/${data.invoice_id}`,
        variant: 'outline',
      });
      break;

    case 'quote_expiring':
      actions.push({
        id: 'follow_up',
        label: 'Stuur follow-up',
        icon: 'Send',
        action_type: 'navigate',
        action_url: `/admin/quotes/${data.quote_id}`,
        variant: 'primary',
      });
      break;

    case 'abandoned_carts':
      actions.push({
        id: 'send_cart_email',
        label: 'Abandoned cart email',
        icon: 'ShoppingCart',
        action_type: 'navigate',
        action_url: '/admin/marketing/automations?trigger=abandoned_cart',
        variant: 'primary',
      });
      break;

    // STOREFRONT SUGGESTIONS
    case 'storefront_hero_update':
      actions.push({
        id: 'generate_hero',
        label: 'Genereer Hero',
        icon: 'Sparkles',
        action_type: 'open_visual_editor',
        action_params: { 
          section_type: 'hero',
          context: data,
        },
        variant: 'primary',
      });
      actions.push({
        id: 'edit_hero',
        label: 'Bewerk handmatig',
        icon: 'Edit',
        action_type: 'navigate',
        action_url: '/admin/storefront/edit',
        variant: 'outline',
      });
      break;

    case 'storefront_seasonal_banner':
      actions.push({
        id: 'generate_banner',
        label: 'Maak banner',
        icon: 'Sparkles',
        action_type: 'open_visual_editor',
        action_params: { 
          section_type: 'hero',
          context: data,
        },
        variant: 'primary',
      });
      break;

    case 'storefront_social_proof':
      actions.push({
        id: 'add_social_proof',
        label: 'Voeg toe aan Hero',
        icon: 'Star',
        action_type: 'open_visual_editor',
        action_params: { 
          section_type: 'hero',
          context: data,
        },
        variant: 'primary',
      });
      break;
  }

  return actions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenantId }: CoachRequest = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get coach settings
    const { data: coachSettings } = await supabase
      .from('ai_coach_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const showEmoji = coachSettings?.show_emoji ?? true;
    const enabledAnalyses = coachSettings?.enabled_analyses || ['stock', 'sales', 'customers', 'invoices'];
    const mutedTypes = coachSettings?.muted_suggestion_types || [];

    const suggestions: AnalysisResult[] = [];

    // 1. STOCK ANALYSIS
    if (enabledAnalyses.includes('stock') && !mutedTypes.includes('stock_alert')) {
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

      const salesByProduct: Record<string, number> = {};
      orderItems?.forEach(item => {
        salesByProduct[item.product_id] = (salesByProduct[item.product_id] || 0) + item.quantity;
      });

      for (const product of products || []) {
        const totalSales = salesByProduct[product.id] || 0;
        const avgDailySales = totalSales / 30;
        
        if (avgDailySales > 0 && product.stock !== null) {
          const daysUntilStockout = product.stock / avgDailySales;
          const supplier = (product.product_suppliers as any)?.[0];
          const leadTime = supplier?.lead_time_days || 7;
          const bufferDays = 2;

          if (daysUntilStockout <= leadTime + bufferDays + 3) {
            const suggestedQuantity = Math.ceil(avgDailySales * 30);
            const priority = daysUntilStockout <= 3 ? 'urgent' : 
                            daysUntilStockout <= 7 ? 'high' : 'medium';

            const actionData = {
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
            };

            suggestions.push({
              suggestion_type: 'stock_alert',
              title: `Herbestelling: ${product.name}`,
              description: `Voorraad van ${product.stock} stuks is over ${Math.round(daysUntilStockout)} dagen uitverkocht.`,
              conversational_message: generateConversationalMessage('stock_alert', actionData, showEmoji),
              priority,
              confidence_score: Math.min(0.95, 0.7 + (avgDailySales > 5 ? 0.2 : 0.1)),
              reasoning: `Op basis van ${avgDailySales.toFixed(1)} verkopen/dag en ${product.stock} stuks voorraad. ${supplier ? `Levertijd: ${leadTime} dagen.` : ''}`,
              action_data: actionData,
              quick_actions: generateQuickActions('stock_alert', actionData),
              related_entity_type: 'product',
              related_entity_id: product.id,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
      }
    }

    // 2. SALES SPIKE ANALYSIS
    if (enabledAnalyses.includes('sales') && !mutedTypes.includes('sales_spike')) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentSales } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          products (id, name, price),
          orders!inner (tenant_id, created_at, status)
        `)
        .eq('orders.tenant_id', tenantId)
        .gte('orders.created_at', sevenDaysAgo.toISOString())
        .neq('orders.status', 'cancelled');

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
        const actionData = {
          type: 'create_marketing_campaign',
          product_id: productId,
          product_name: product?.name,
          sales_count: qty,
          product_ids: [productId],
        };

        suggestions.push({
          suggestion_type: 'marketing_campaign',
          title: `Bestseller spotlight: ${product?.name || 'Top product'}`,
          description: `${qty} verkopen in de afgelopen week - tijd voor promotie!`,
          conversational_message: generateConversationalMessage('marketing_campaign', actionData, showEmoji),
          priority: 'low',
          confidence_score: 0.72,
          reasoning: `Dit product is je bestseller van de week met ${qty} verkopen.`,
          action_data: actionData,
          quick_actions: generateQuickActions('marketing_campaign', actionData),
          related_entity_type: 'product',
          related_entity_id: productId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // 3. INACTIVE VIP CUSTOMERS
    if (enabledAnalyses.includes('customers') && !mutedTypes.includes('customer_winback')) {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data: inactiveCustomers, count: inactiveCount } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, total_spent', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .gt('total_spent', 100)
        .or(`total_orders.eq.0,updated_at.lt.${sixtyDaysAgo.toISOString()}`)
        .limit(50);

      if (inactiveCount && inactiveCount >= 5) {
        const actionData = {
          type: 'create_winback_campaign',
          customer_ids: inactiveCustomers?.map(c => c.id) || [],
          customer_count: inactiveCount,
          suggested_discount: 15,
        };

        suggestions.push({
          suggestion_type: 'customer_winback',
          title: `Win-back campagne voor ${inactiveCount} VIP klanten`,
          description: `${inactiveCount} klanten met €100+ besteed zijn 60+ dagen inactief.`,
          conversational_message: generateConversationalMessage('customer_winback', actionData, showEmoji),
          priority: 'medium',
          confidence_score: 0.78,
          reasoning: `${inactiveCount} waardevolle klanten kunnen gereactiveerd worden met een persoonlijke campagne.`,
          action_data: actionData,
          quick_actions: generateQuickActions('customer_winback', actionData),
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // 4. OVERDUE INVOICES
    if (enabledAnalyses.includes('invoices') && !mutedTypes.includes('invoice_overdue')) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, due_date, customer_id, customers(first_name, last_name, company_name)')
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .lt('due_date', sevenDaysAgo.toISOString())
        .limit(5);

      for (const invoice of overdueInvoices || []) {
        const customer = invoice.customers as any;
        const customerName = customer?.company_name || 
          `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
          'Klant';
        
        const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));

        const actionData = {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.total,
          days_overdue: daysOverdue,
          customer_name: customerName,
          customer_id: invoice.customer_id,
        };

        suggestions.push({
          suggestion_type: 'invoice_overdue',
          title: `Achterstallige factuur: ${invoice.invoice_number}`,
          description: `€${invoice.total} is ${daysOverdue} dagen over datum.`,
          conversational_message: generateConversationalMessage('invoice_overdue', actionData, showEmoji),
          priority: daysOverdue > 30 ? 'urgent' : daysOverdue > 14 ? 'high' : 'medium',
          confidence_score: 0.9,
          reasoning: `Factuur ${invoice.invoice_number} had deadline ${daysOverdue} dagen geleden.`,
          action_data: actionData,
          quick_actions: generateQuickActions('invoice_overdue', actionData),
          related_entity_type: 'invoice',
          related_entity_id: invoice.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // 5. EXPIRING QUOTES
    if (enabledAnalyses.includes('quotes') && !mutedTypes.includes('quote_expiring')) {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const { data: expiringQuotes } = await supabase
        .from('quotes')
        .select('id, quote_number, total, valid_until, customer_id, customers(first_name, last_name, company_name)')
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .lt('valid_until', threeDaysFromNow.toISOString())
        .gt('valid_until', new Date().toISOString())
        .limit(5);

      for (const quote of expiringQuotes || []) {
        const customer = quote.customers as any;
        const customerName = customer?.company_name || 
          `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
          'Klant';
        
        const daysUntilExpiry = Math.floor((new Date(quote.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        const actionData = {
          quote_id: quote.id,
          quote_number: quote.quote_number,
          amount: quote.total,
          days_until_expiry: daysUntilExpiry,
          customer_name: customerName,
          customer_id: quote.customer_id,
        };

        suggestions.push({
          suggestion_type: 'quote_expiring',
          title: `Offerte verloopt: ${quote.quote_number}`,
          description: `€${quote.total} offerte verloopt over ${daysUntilExpiry} dagen.`,
          conversational_message: generateConversationalMessage('quote_expiring', actionData, showEmoji),
          priority: daysUntilExpiry <= 1 ? 'high' : 'medium',
          confidence_score: 0.85,
          reasoning: `Offerte voor ${customerName} verloopt binnenkort - follow-up kan de deal sluiten.`,
          action_data: actionData,
          quick_actions: generateQuickActions('quote_expiring', actionData),
          related_entity_type: 'quote',
          related_entity_id: quote.id,
          expires_at: quote.valid_until,
        });
      }
    }

    // Insert all suggestions
    if (suggestions.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_action_suggestions')
        .insert(suggestions.map(s => ({
          tenant_id: tenantId,
          suggestion_type: s.suggestion_type,
          title: s.title,
          description: s.description,
          conversational_message: s.conversational_message,
          priority: s.priority,
          confidence_score: s.confidence_score,
          reasoning: s.reasoning,
          action_data: s.action_data,
          quick_actions: s.quick_actions,
          related_entity_type: s.related_entity_type,
          related_entity_id: s.related_entity_id,
          analysis_context: s.analysis_context,
          expires_at: s.expires_at,
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
            category: 'ai_coach',
            type: 'ai_coach_suggestion',
            title: `🤖 ${suggestion.title}`,
            message: suggestion.conversational_message,
            priority: suggestion.priority,
            actionUrl: '/admin/ai-center',
            data: {
              suggestion_type: suggestion.suggestion_type,
              related_entity_type: suggestion.related_entity_type,
              related_entity_id: suggestion.related_entity_id,
            },
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestionsCreated: suggestions.length,
        suggestions: suggestions.map(s => ({ 
          type: s.suggestion_type, 
          title: s.title, 
          priority: s.priority,
          has_quick_actions: s.quick_actions.length > 0,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Business Coach error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
