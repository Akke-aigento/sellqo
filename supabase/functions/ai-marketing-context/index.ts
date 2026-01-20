import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketingContext {
  business: {
    name: string;
    currency: string;
    country: string;
  };
  products: {
    total: number;
    active: number;
    lowStock: Array<{ id: string; name: string; stock: number; price: number; image?: string }>;
    bestsellers: Array<{ id: string; name: string; orderCount: number; revenue: number; image?: string }>;
    newArrivals: Array<{ id: string; name: string; price: number; image?: string; createdAt: string }>;
    featured: Array<{ id: string; name: string; price: number; image?: string }>;
    categories: Array<{ id: string; name: string; productCount: number }>;
  };
  customers: {
    total: number;
    subscribers: number;
    segments: Array<{ id: string; name: string; memberCount: number; description?: string }>;
    topCountries: Array<{ country: string; count: number }>;
    recentSignups: number;
  };
  orders: {
    total: number;
    lastMonth: number;
    avgOrderValue: number;
    topProducts: Array<{ productName: string; quantity: number }>;
  };
  campaigns: {
    total: number;
    avgOpenRate: number;
    avgClickRate: number;
    bestPerforming: Array<{ name: string; openRate: number; clickRate: number }>;
  };
  seasonality: {
    currentMonth: string;
    currentSeason: string;
    upcomingHolidays: Array<{ name: string; date: string; daysUntil: number }>;
  };
  insights: {
    lowStockAlert: boolean;
    winBackOpportunity: number;
    highEngagementSegment?: string;
  };
}

const getSeasonAndHolidays = () => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  
  const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 
                      'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
  
  let season = 'winter';
  if (month >= 2 && month <= 4) season = 'lente';
  else if (month >= 5 && month <= 7) season = 'zomer';
  else if (month >= 8 && month <= 10) season = 'herfst';
  
  // Belgian/Dutch holidays
  const holidays = [
    { name: 'Valentijnsdag', month: 1, day: 14 },
    { name: 'Pasen', month: 3, day: 20 },
    { name: 'Moederdag', month: 4, day: 11 },
    { name: 'Vaderdag', month: 5, day: 15 },
    { name: 'Black Friday', month: 10, day: 29 },
    { name: 'Sinterklaas', month: 11, day: 5 },
    { name: 'Kerstmis', month: 11, day: 25 },
    { name: 'Nieuwjaar', month: 0, day: 1 },
  ];
  
  const upcomingHolidays = holidays
    .map(h => {
      let holidayDate = new Date(now.getFullYear(), h.month, h.day);
      if (holidayDate < now) {
        holidayDate = new Date(now.getFullYear() + 1, h.month, h.day);
      }
      const daysUntil = Math.ceil((holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { name: h.name, date: holidayDate.toISOString().split('T')[0], daysUntil };
    })
    .filter(h => h.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);
  
  return {
    currentMonth: monthNames[month],
    currentSeason: season,
    upcomingHolidays,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { tenantId } = await req.json();
    if (!tenantId) throw new Error("Missing tenantId");

    // Fetch all data in parallel
    const [
      tenantResult,
      productsResult,
      lowStockResult,
      customersResult,
      segmentsResult,
      ordersResult,
      orderItemsResult,
      campaignsResult,
      recentProductsResult,
      featuredProductsResult,
    ] = await Promise.all([
      // Tenant info
      supabase.from('tenants').select('name, currency, country').eq('id', tenantId).single(),
      
      // Products count
      supabase.from('products').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
      
      // Low stock products
      supabase.from('products')
        .select('id, name, stock, price, featured_image')
        .eq('tenant_id', tenantId)
        .eq('track_inventory', true)
        .lt('stock', 10)
        .order('stock', { ascending: true })
        .limit(10),
      
      // Customers
      supabase.from('customers')
        .select('id, email_subscribed, billing_country, created_at', { count: 'exact' })
        .eq('tenant_id', tenantId),
      
      // Segments
      supabase.from('customer_segments')
        .select('id, name, member_count, description')
        .eq('tenant_id', tenantId)
        .order('member_count', { ascending: false })
        .limit(10),
      
      // Orders last 30 days
      supabase.from('orders')
        .select('id, total, created_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Top ordered products
      supabase.from('order_items')
        .select('product_name, quantity')
        .limit(100),
      
      // Campaigns
      supabase.from('email_campaigns')
        .select('id, name, total_sent, total_opened, total_clicked, status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // New arrivals
      supabase.from('products')
        .select('id, name, price, featured_image, created_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5),
      
      // Featured products
      supabase.from('products')
        .select('id, name, price, featured_image')
        .eq('tenant_id', tenantId)
        .eq('is_featured', true)
        .eq('is_active', true)
        .limit(5),
    ]);

    const tenant = tenantResult.data || { name: 'Unknown', currency: 'EUR', country: 'BE' };
    const products = productsResult.data || [];
    const lowStockProducts = lowStockResult.data || [];
    const customers = customersResult.data || [];
    const segments = segmentsResult.data || [];
    const recentOrders = ordersResult.data || [];
    const orderItems = orderItemsResult.data || [];
    const campaigns = campaignsResult.data || [];
    const newArrivals = recentProductsResult.data || [];
    const featuredProducts = featuredProductsResult.data || [];

    // Calculate metrics
    const subscribers = customers.filter(c => c.email_subscribed).length;
    const recentSignups = customers.filter(c => {
      const created = new Date(c.created_at);
      return created > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }).length;

    // Country distribution
    const countryMap = new Map<string, number>();
    customers.forEach(c => {
      const country = c.billing_country || 'Onbekend';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    });
    const topCountries = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Order metrics
    const totalOrderValue = recentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = recentOrders.length > 0 ? totalOrderValue / recentOrders.length : 0;

    // Top products by order frequency
    const productCounts = new Map<string, number>();
    orderItems.forEach(item => {
      productCounts.set(item.product_name, (productCounts.get(item.product_name) || 0) + item.quantity);
    });
    const topProducts = Array.from(productCounts.entries())
      .map(([productName, quantity]) => ({ productName, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Campaign metrics
    const sentCampaigns = campaigns.filter(c => c.status === 'sent' || c.status === 'completed');
    const totalOpens = sentCampaigns.reduce((sum, c) => sum + (c.total_opened || 0), 0);
    const totalSent = sentCampaigns.reduce((sum, c) => sum + (c.total_sent || 0), 0);
    const totalClicks = sentCampaigns.reduce((sum, c) => sum + (c.total_clicked || 0), 0);
    const avgOpenRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
    const avgClickRate = totalOpens > 0 ? (totalClicks / totalOpens) * 100 : 0;

    const bestPerforming = sentCampaigns
      .filter(c => c.total_sent && c.total_sent > 0)
      .map(c => ({
        name: c.name,
        openRate: ((c.total_opened || 0) / c.total_sent!) * 100,
        clickRate: c.total_opened && c.total_opened > 0 ? ((c.total_clicked || 0) / c.total_opened) * 100 : 0,
      }))
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 3);

    // Insights
    const winBackOpportunity = customers.length - subscribers;
    const highEngagementSegment = segments.find(s => s.member_count && s.member_count > 50)?.name;

    const context: MarketingContext = {
      business: {
        name: tenant.name,
        currency: tenant.currency,
        country: tenant.country,
      },
      products: {
        total: productsResult.count || 0,
        active: products.length,
        lowStock: lowStockProducts.map(p => ({
          id: p.id,
          name: p.name,
          stock: p.stock || 0,
          price: p.price,
          image: p.featured_image,
        })),
        bestsellers: topProducts.slice(0, 5).map((p, i) => ({
          id: `bestseller-${i}`,
          name: p.productName,
          orderCount: p.quantity,
          revenue: 0,
        })),
        newArrivals: newArrivals.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.featured_image,
          createdAt: p.created_at,
        })),
        featured: featuredProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.featured_image,
        })),
        categories: [],
      },
      customers: {
        total: customersResult.count || 0,
        subscribers,
        segments: segments.map(s => ({
          id: s.id,
          name: s.name,
          memberCount: s.member_count || 0,
          description: s.description,
        })),
        topCountries,
        recentSignups,
      },
      orders: {
        total: ordersResult.count || 0,
        lastMonth: recentOrders.length,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        topProducts,
      },
      campaigns: {
        total: campaigns.length,
        avgOpenRate: Math.round(avgOpenRate * 10) / 10,
        avgClickRate: Math.round(avgClickRate * 10) / 10,
        bestPerforming,
      },
      seasonality: getSeasonAndHolidays(),
      insights: {
        lowStockAlert: lowStockProducts.length > 0,
        winBackOpportunity,
        highEngagementSegment,
      },
    };

    return new Response(JSON.stringify({ context }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-marketing-context:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
