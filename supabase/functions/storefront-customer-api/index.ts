import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-storefront-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple JWT-like token generation using HMAC
async function generateToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 7 })); // 7 days
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyToken(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split('.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const expectedSig = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, expectedSig, new TextEncoder().encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// Password hashing using PBKDF2
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const derivedHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return derivedHex === hashHex;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role key as HMAC secret

    const { action, tenant_id, params = {} } = await req.json();
    if (!tenant_id) throw new Error('tenant_id is required');

    // Auth helper
    const getCustomer = async (): Promise<any> => {
      const token = req.headers.get('x-storefront-token');
      if (!token) throw new Error('Authentication required');
      const payload = await verifyToken(token, tokenSecret);
      if (!payload || payload.tenant_id !== tenant_id) throw new Error('Invalid or expired token');
      const { data } = await supabase.from('storefront_customers').select('*').eq('id', payload.customer_id).eq('tenant_id', tenant_id).single();
      if (!data || !data.is_active) throw new Error('Account not found or inactive');
      return data;
    };

    let result: unknown;

    switch (action) {
      case 'register': {
        const { email, password, first_name, last_name, phone } = params as any;
        if (!email || !password) throw new Error('email and password are required');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');

        const { data: existing } = await supabase.from('storefront_customers').select('id').eq('tenant_id', tenant_id).eq('email', email.toLowerCase()).maybeSingle();
        if (existing) throw new Error('An account with this email already exists');

        const passwordHash = await hashPassword(password);
        const { data: customer, error } = await supabase
          .from('storefront_customers')
          .insert({ tenant_id, email: email.toLowerCase(), password_hash: passwordHash, first_name: first_name || '', last_name: last_name || '', phone: phone || null })
          .select('id, email, first_name, last_name').single();
        if (error) throw error;

        const token = await generateToken({ customer_id: customer.id, tenant_id, email: customer.email }, tokenSecret);
        result = { customer, token };
        break;
      }

      case 'login': {
        const { email, password } = params as any;
        if (!email || !password) throw new Error('email and password are required');

        const { data: customer } = await supabase
          .from('storefront_customers').select('*')
          .eq('tenant_id', tenant_id).eq('email', email.toLowerCase()).eq('is_active', true).maybeSingle();
        if (!customer) throw new Error('Invalid email or password');

        const valid = await verifyPassword(password, customer.password_hash);
        if (!valid) throw new Error('Invalid email or password');

        await supabase.from('storefront_customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id);

        const token = await generateToken({ customer_id: customer.id, tenant_id, email: customer.email }, tokenSecret);
        result = {
          customer: { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone },
          token,
        };
        break;
      }

      case 'get_profile': {
        const customer = await getCustomer();
        result = { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone, addresses: customer.addresses || [] };
        break;
      }

      case 'update_profile': {
        const customer = await getCustomer();
        const { first_name, last_name, phone } = params as any;
        const updates: any = {};
        if (first_name !== undefined) updates.first_name = first_name;
        if (last_name !== undefined) updates.last_name = last_name;
        if (phone !== undefined) updates.phone = phone;
        const { data, error } = await supabase.from('storefront_customers').update(updates).eq('id', customer.id).select('id, email, first_name, last_name, phone').single();
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_orders': {
        const customer = await getCustomer();
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, status, payment_status, total, currency, created_at')
          .eq('tenant_id', tenant_id).eq('customer_email', customer.email)
          .order('created_at', { ascending: false }).limit(50);
        result = orders || [];
        break;
      }

      case 'get_order': {
        const customer = await getCustomer();
        const orderId = (params as any).order_id;
        if (!orderId) throw new Error('order_id is required');
        const { data: order } = await supabase
          .from('orders')
          .select('*, order_items(product_name, quantity, unit_price, total, product_image)')
          .eq('id', orderId).eq('tenant_id', tenant_id).eq('customer_email', customer.email).single();
        if (!order) throw new Error('Order not found');
        result = order;
        break;
      }

      case 'get_addresses': {
        const customer = await getCustomer();
        result = customer.addresses || [];
        break;
      }

      case 'add_address': {
        const customer = await getCustomer();
        const address = (params as any).address;
        if (!address) throw new Error('address is required');
        const addresses = [...(customer.addresses || []), { ...address, id: crypto.randomUUID() }];
        await supabase.from('storefront_customers').update({ addresses }).eq('id', customer.id);
        result = addresses;
        break;
      }

      case 'update_address': {
        const customer = await getCustomer();
        const { address_id, address } = params as any;
        if (!address_id || !address) throw new Error('address_id and address are required');
        const addresses = (customer.addresses || []).map((a: any) => a.id === address_id ? { ...address, id: address_id } : a);
        await supabase.from('storefront_customers').update({ addresses }).eq('id', customer.id);
        result = addresses;
        break;
      }

      case 'delete_address': {
        const customer = await getCustomer();
        const addressId = (params as any).address_id;
        if (!addressId) throw new Error('address_id is required');
        const addresses = (customer.addresses || []).filter((a: any) => a.id !== addressId);
        await supabase.from('storefront_customers').update({ addresses }).eq('id', customer.id);
        result = addresses;
        break;
      }

      case 'change_password': {
        const customer = await getCustomer();
        const { current_password, new_password } = params as any;
        if (!current_password || !new_password) throw new Error('current_password and new_password are required');
        if (new_password.length < 8) throw new Error('New password must be at least 8 characters');
        const valid = await verifyPassword(current_password, customer.password_hash);
        if (!valid) throw new Error('Current password is incorrect');
        const newHash = await hashPassword(new_password);
        await supabase.from('storefront_customers').update({ password_hash: newHash }).eq('id', customer.id);
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Storefront Customer API error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
