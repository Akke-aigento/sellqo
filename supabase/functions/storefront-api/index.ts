import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StorefrontRequest {
  action: 'get_tenant' | 'get_products' | 'get_shipping_methods' | 'get_service_points';
  tenant_id: string;
  params?: Record<string, unknown>;
}

interface ServicePoint {
  id: string;
  name: string;
  carrier: string;
  type: 'pickup_point' | 'locker' | 'post_office';
  address: {
    street: string;
    house_number?: string;
    city: string;
    postal_code: string;
    country: string;
  };
  distance?: number;
  latitude?: number;
  longitude?: number;
  opening_hours?: Record<string, string>;
}

async function getTenant(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select(`
      id,
      name,
      logo_url,
      primary_color,
      currency,
      country,
      default_vat_rate,
      store_name,
      store_description,
      contact_email,
      contact_phone
    `)
    .eq('id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Tenant not found');

  return {
    id: data.id,
    name: data.store_name || data.name,
    description: data.store_description,
    logo_url: data.logo_url,
    primary_color: data.primary_color,
    currency: data.currency || 'EUR',
    country: data.country || 'NL',
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
  };
}

async function getProducts(supabase: any, tenantId: string, params: Record<string, unknown>) {
  let query = supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      description,
      price,
      compare_at_price,
      images,
      is_active,
      track_inventory,
      stock,
      sku,
      category_id,
      categories(id, name, slug)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (params?.category_id) {
    query = query.eq('category_id', params.category_id);
  }

  if (params?.search) {
    query = query.ilike('name', `%${params.search}%`);
  }

  if (params?.limit) {
    query = query.limit(Number(params.limit));
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((product: any) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compare_at_price: product.compare_at_price,
    images: product.images || [],
    in_stock: !product.track_inventory || product.stock > 0,
    stock: product.track_inventory ? product.stock : null,
    sku: product.sku,
    category: product.categories ? {
      id: product.categories.id,
      name: product.categories.name,
      slug: product.categories.slug,
    } : null,
  }));
}

async function getShippingMethods(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('shipping_methods')
    .select(`
      id,
      name,
      description,
      price,
      free_above,
      estimated_days_min,
      estimated_days_max,
      is_default
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return data.map((method: any) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    price: method.price,
    free_above: method.free_above,
    estimated_days: method.estimated_days_min && method.estimated_days_max
      ? `${method.estimated_days_min}-${method.estimated_days_max}`
      : method.estimated_days_min || method.estimated_days_max || null,
    is_default: method.is_default,
  }));
}

async function getServicePoints(
  supabase: any,
  tenantId: string,
  params: Record<string, unknown>
): Promise<{ provider: string; service_points: ServicePoint[] }> {
  const { postal_code, country, carrier, house_number } = params as {
    postal_code: string;
    country: string;
    carrier?: string;
    house_number?: string;
  };

  if (!postal_code || !country) {
    throw new Error('postal_code and country are required');
  }

  // Get active shipping integration for tenant
  const { data: integration, error: integrationError } = await supabase
    .from('shipping_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integrationError) throw integrationError;
  if (!integration) {
    return { provider: 'none', service_points: [] };
  }

  const credentials = integration.credentials || {};
  let servicePoints: ServicePoint[] = [];

  switch (integration.provider) {
    case 'sendcloud': {
      const apiKey = credentials.api_key;
      const apiSecret = credentials.api_secret;
      
      if (!apiKey || !apiSecret) {
        throw new Error('Sendcloud credentials not configured');
      }

      const authHeader = btoa(`${apiKey}:${apiSecret}`);
      
      let url = `https://servicepoints.sendcloud.sc/api/v2/service-points?country=${country}&postal_code=${postal_code}`;
      if (carrier) url += `&carrier=${carrier}`;
      if (house_number) url += `&house_number=${house_number}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sendcloud service points error:', errorText);
        throw new Error(`Sendcloud API error: ${response.status}`);
      }

      const data = await response.json();
      
      servicePoints = (data || []).map((point: any) => ({
        id: String(point.id),
        name: point.name,
        carrier: point.carrier,
        type: point.is_locker ? 'locker' : 'pickup_point',
        address: {
          street: point.street,
          house_number: point.house_number,
          city: point.city,
          postal_code: point.postal_code,
          country: point.country,
        },
        distance: point.distance,
        latitude: point.latitude,
        longitude: point.longitude,
        opening_hours: point.formatted_opening_times || {},
      }));
      break;
    }

    case 'myparcel': {
      const apiKey = credentials.api_key;
      
      if (!apiKey) {
        throw new Error('MyParcel API key not configured');
      }

      const carrierMap: Record<string, string> = {
        'postnl': 'postnl',
        'dhl': 'dhlforyou',
        'dpd': 'dpd',
      };

      const myparcelCarrier = carrier ? carrierMap[carrier.toLowerCase()] || carrier : 'postnl';

      const response = await fetch(
        `https://api.myparcel.nl/pickup_locations?cc=${country}&postal_code=${postal_code}&carrier=${myparcelCarrier}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MyParcel pickup locations error:', errorText);
        throw new Error(`MyParcel API error: ${response.status}`);
      }

      const data = await response.json();
      const locations = data.data?.pickup_locations || [];

      servicePoints = locations.map((point: any) => ({
        id: point.location_code || String(point.location_id),
        name: point.location_name || point.retail_network_id,
        carrier: point.carrier?.human || carrier || 'postnl',
        type: point.is_locker ? 'locker' : 'pickup_point',
        address: {
          street: point.street,
          house_number: point.number,
          city: point.city,
          postal_code: point.postal_code,
          country: point.cc,
        },
        distance: point.distance,
        latitude: point.latitude,
        longitude: point.longitude,
        opening_hours: formatMyParcelOpeningHours(point.opening_hours),
      }));
      break;
    }

    case 'manual':
    default:
      return { provider: 'manual', service_points: [] };
  }

  return {
    provider: integration.provider,
    service_points: servicePoints,
  };
}

function formatMyParcelOpeningHours(hours: any[]): Record<string, string> {
  if (!hours || !Array.isArray(hours)) return {};
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const result: Record<string, string> = {};

  hours.forEach((day: any, index: number) => {
    if (day && day.length > 0) {
      const times = day.map((slot: any) => `${slot.start}-${slot.end}`).join(', ');
      result[days[index]] = times;
    }
  });

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: StorefrontRequest = await req.json();
    const { action, tenant_id, params = {} } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: unknown;

    switch (action) {
      case 'get_tenant':
        result = await getTenant(supabase, tenant_id);
        break;
      case 'get_products':
        result = await getProducts(supabase, tenant_id, params);
        break;
      case 'get_shipping_methods':
        result = await getShippingMethods(supabase, tenant_id);
        break;
      case 'get_service_points':
        result = await getServicePoints(supabase, tenant_id, params);
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Storefront API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
