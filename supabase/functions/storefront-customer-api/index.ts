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

// Auto-sync storefront_customer to the CRM customers table
async function syncToCustomers(supabase: any, tenantId: string, sfCustomer: any, newsletterOptIn?: boolean) {
  try {
    const email = sfCustomer.email?.toLowerCase();
    if (!email) return;

    // Check if customer already exists by email
    const { data: existing } = await supabase
      .from('customers')
      .select('id, storefront_customer_id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();

    const customerData: Record<string, unknown> = {
      first_name: sfCustomer.first_name || '',
      last_name: sfCustomer.last_name || '',
      phone: sfCustomer.phone || null,
      storefront_customer_id: sfCustomer.id,
      company_name: sfCustomer.company_name || null,
      vat_number: sfCustomer.vat_number || null,
      vat_verified: sfCustomer.vat_verified || false,
    };

    if (newsletterOptIn !== undefined) {
      customerData.email_subscribed = !!newsletterOptIn;
      customerData.email_marketing_status = newsletterOptIn ? 'subscribed' : 'unsubscribed';
    }

    if (existing) {
      await supabase.from('customers').update(customerData).eq('id', existing.id);
    } else {
      await supabase.from('customers').insert({
        ...customerData,
        tenant_id: tenantId,
        email,
        customer_type: sfCustomer.company_name ? 'b2b' : 'b2c',
      });
    }

    // Sync to newsletter_subscribers if opted in
    if (newsletterOptIn) {
      await supabase.from('newsletter_subscribers').upsert(
        { tenant_id: tenantId, email, status: 'active', first_name: sfCustomer.first_name || null, last_name: sfCustomer.last_name || null },
        { onConflict: 'tenant_id,email' }
      );
    }
  } catch (err) {
    console.error('syncToCustomers error:', err);
  }
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
        const { email, password, first_name, last_name, phone, newsletter_opt_in, company_name: regCompany, vat_number: regVat } = params as any;
        if (!email || !password) throw new Error('email and password are required');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        const emailLc = email.toLowerCase().trim();

        const { data: existing } = await supabase.from('storefront_customers')
          .select('id, password_hash, email_verified, first_name, last_name')
          .eq('tenant_id', tenant_id).eq('email', emailLc).maybeSingle();

        const passwordHash = await hashPassword(password);
        // Generate verification token
        const verificationToken = crypto.randomUUID() + '-' + crypto.randomUUID();
        const verificationExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // 24h

        let customerId: string;
        let customerEmail: string;
        let customerFirstName: string;

        if (existing) {
          // Account exists WITH password → already registered
          if (existing.password_hash) {
            throw new Error('Er bestaat al een account met dit e-mailadres. Log in of gebruik wachtwoord vergeten.');
          }
          // Migrated account (no password) → claim it
          const updates: Record<string, unknown> = {
            password_hash: passwordHash,
            email_verified: false,
            email_verification_token: verificationToken,
            email_verification_expires_at: verificationExpires,
          };
          if (first_name) updates.first_name = first_name;
          if (last_name) updates.last_name = last_name;
          if (phone) updates.phone = phone;
          if (newsletter_opt_in !== undefined) {
            updates.newsletter_opted_in = !!newsletter_opt_in;
            if (newsletter_opt_in) updates.newsletter_opted_in_at = new Date().toISOString();
          }
          if (regCompany) updates.company_name = regCompany;
          if (regVat) updates.vat_number = regVat;

          // VIES validation
          if (regVat) {
            try {
              const vatRes = await supabase.functions.invoke('validate-vat', { body: { vat_number: regVat } });
              if (vatRes.data?.valid) { updates.vat_verified = true; updates.vat_verified_at = new Date().toISOString(); }
            } catch { /* skip */ }
          }

          await supabase.from('storefront_customers').update(updates).eq('id', existing.id);
          customerId = existing.id;
          customerEmail = emailLc;
          customerFirstName = first_name || existing.first_name || '';
        } else {
          // Brand new account
          const insertData: Record<string, unknown> = {
            tenant_id, email: emailLc, password_hash: passwordHash,
            first_name: first_name || '', last_name: last_name || '', phone: phone || null,
            newsletter_opted_in: !!newsletter_opt_in,
            newsletter_opted_in_at: newsletter_opt_in ? new Date().toISOString() : null,
            company_name: regCompany || null, vat_number: regVat || null,
            email_verified: false,
            email_verification_token: verificationToken,
            email_verification_expires_at: verificationExpires,
          };

          if (regVat) {
            try {
              const vatRes = await supabase.functions.invoke('validate-vat', { body: { vat_number: regVat } });
              if (vatRes.data?.valid) { insertData.vat_verified = true; insertData.vat_verified_at = new Date().toISOString(); }
            } catch { /* skip */ }
          }

          const { data: customer, error } = await supabase
            .from('storefront_customers')
            .insert(insertData)
            .select('id, email, first_name, last_name, newsletter_opted_in, company_name, vat_number, vat_verified').single();
          if (error) throw error;

          await syncToCustomers(supabase, tenant_id, customer, newsletter_opt_in);
          customerId = customer.id;
          customerEmail = customer.email;
          customerFirstName = customer.first_name || '';
        }

        // Send verification email
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          try {
            const { data: tenant } = await supabase.from('tenants').select('store_name, name, slug').eq('id', tenant_id).single();
            const storeName = tenant?.store_name || tenant?.name || 'Shop';
            const { data: themeRow } = await supabase.from('tenant_theme_settings').select('use_custom_frontend, custom_frontend_url').eq('tenant_id', tenant_id).maybeSingle();
            let verifyUrl: string;
            if (themeRow?.use_custom_frontend && themeRow?.custom_frontend_url) {
              const base = (themeRow.custom_frontend_url as string).replace(/\/+$/, '');
              verifyUrl = `${base}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(emailLc)}`;
            } else {
              verifyUrl = `https://sellqo.lovable.app/shop/${tenant?.slug || ''}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(emailLc)}`;
            }

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${storeName} <noreply@sellqo.nl>`,
                to: [emailLc],
                subject: `Bevestig je e-mailadres — ${storeName}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <h1 style="font-size: 24px; margin-bottom: 16px;">Bevestig je e-mailadres</h1>
                    <p style="color: #555; line-height: 1.6;">Hallo${customerFirstName ? ` ${customerFirstName}` : ''},</p>
                    <p style="color: #555; line-height: 1.6;">Bedankt voor je registratie bij <strong>${storeName}</strong>. Klik op de onderstaande knop om je e-mailadres te bevestigen.</p>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${verifyUrl}" style="background-color: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">E-mailadres bevestigen</a>
                    </div>
                    <p style="color: #888; font-size: 13px; line-height: 1.5;">Deze link is 24 uur geldig. Als je geen account hebt aangemaakt, kun je deze e-mail negeren.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                    <p style="color: #aaa; font-size: 12px;">${storeName}</p>
                  </div>
                `,
              }),
            });
          } catch (emailErr) {
            console.error('Failed to send verification email:', emailErr);
          }
        }

        result = { message: 'Verificatiemail verstuurd. Controleer je inbox om je account te bevestigen.', requires_verification: true };
        break;
      }

      case 'verify_email': {
        const { email: veEmail, token: veToken } = params as any;
        if (!veEmail || !veToken) throw new Error('email and token are required');
        const emailLc = veEmail.toLowerCase().trim();

        const { data: customer } = await supabase.from('storefront_customers')
          .select('id, email, first_name, last_name, phone, email_verification_token, email_verification_expires_at, email_verified')
          .eq('tenant_id', tenant_id).eq('email', emailLc).maybeSingle();

        if (!customer) throw new Error('Account niet gevonden');
        if (customer.email_verified) {
          // Already verified — just return token
          const token = await generateToken({ customer_id: customer.id, tenant_id, email: customer.email }, tokenSecret);
          result = { message: 'E-mailadres is al bevestigd.', customer: { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone }, token };
          break;
        }
        if (customer.email_verification_token !== veToken) throw new Error('Ongeldige verificatielink');
        if (customer.email_verification_expires_at && new Date(customer.email_verification_expires_at) < new Date()) {
          throw new Error('Verificatielink is verlopen. Vraag een nieuwe aan.');
        }

        await supabase.from('storefront_customers').update({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires_at: null,
        }).eq('id', customer.id);

        const token = await generateToken({ customer_id: customer.id, tenant_id, email: customer.email }, tokenSecret);
        result = {
          message: 'E-mailadres succesvol bevestigd!',
          customer: { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone },
          token,
        };
        break;
      }

      case 'resend_verification': {
        const { email: rvEmail } = params as any;
        if (!rvEmail) throw new Error('email is required');
        const emailLc = rvEmail.toLowerCase().trim();

        const { data: customer } = await supabase.from('storefront_customers')
          .select('id, email, first_name, email_verified, password_hash')
          .eq('tenant_id', tenant_id).eq('email', emailLc).eq('is_active', true).maybeSingle();

        // Don't leak info
        if (!customer || customer.email_verified || !customer.password_hash) {
          result = { message: 'Als er een onbevestigd account bestaat, is er een nieuwe verificatiemail verstuurd.' };
          break;
        }

        const newToken = crypto.randomUUID() + '-' + crypto.randomUUID();
        const newExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await supabase.from('storefront_customers').update({
          email_verification_token: newToken,
          email_verification_expires_at: newExpires,
        }).eq('id', customer.id);

        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          try {
            const { data: tenant } = await supabase.from('tenants').select('store_name, name, slug').eq('id', tenant_id).single();
            const storeName = tenant?.store_name || tenant?.name || 'Shop';
            const { data: themeRow } = await supabase.from('tenant_theme_settings').select('use_custom_frontend, custom_frontend_url').eq('tenant_id', tenant_id).maybeSingle();
            let verifyUrl: string;
            if (themeRow?.use_custom_frontend && themeRow?.custom_frontend_url) {
              const base = (themeRow.custom_frontend_url as string).replace(/\/+$/, '');
              verifyUrl = `${base}/verify-email?token=${encodeURIComponent(newToken)}&email=${encodeURIComponent(emailLc)}`;
            } else {
              verifyUrl = `https://sellqo.lovable.app/shop/${tenant?.slug || ''}/verify-email?token=${encodeURIComponent(newToken)}&email=${encodeURIComponent(emailLc)}`;
            }

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${storeName} <noreply@sellqo.nl>`,
                to: [emailLc],
                subject: `Bevestig je e-mailadres — ${storeName}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <h1 style="font-size: 24px; margin-bottom: 16px;">Bevestig je e-mailadres</h1>
                    <p style="color: #555; line-height: 1.6;">Hallo${customer.first_name ? ` ${customer.first_name}` : ''},</p>
                    <p style="color: #555; line-height: 1.6;">Klik op de onderstaande knop om je e-mailadres te bevestigen.</p>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${verifyUrl}" style="background-color: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">E-mailadres bevestigen</a>
                    </div>
                    <p style="color: #888; font-size: 13px; line-height: 1.5;">Deze link is 24 uur geldig.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                    <p style="color: #aaa; font-size: 12px;">${storeName}</p>
                  </div>
                `,
              }),
            });
          } catch (emailErr) {
            console.error('Failed to send verification email:', emailErr);
          }
        }

        result = { message: 'Als er een onbevestigd account bestaat, is er een nieuwe verificatiemail verstuurd.' };
        break;
      }

      case 'login': {
        const { email, password } = params as any;
        if (!email || !password) throw new Error('email and password are required');

        const { data: customer } = await supabase
          .from('storefront_customers').select('*')
          .eq('tenant_id', tenant_id).eq('email', email.toLowerCase()).eq('is_active', true).maybeSingle();
        if (!customer) throw new Error('Invalid email or password');
        if (!customer.password_hash) throw new Error('Invalid email or password');

        const valid = await verifyPassword(password, customer.password_hash);
        if (!valid) throw new Error('Invalid email or password');

        // Check email verification
        if (!customer.email_verified) {
          throw new Error('EMAIL_NOT_VERIFIED:Bevestig eerst je e-mailadres. Controleer je inbox voor de verificatielink.');
        }

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
        const { first_name, last_name, phone, newsletter_opt_in, company_name: upCompany, vat_number: upVat } = params as any;
        const updates: Record<string, unknown> = {};
        if (first_name !== undefined) updates.first_name = first_name;
        if (last_name !== undefined) updates.last_name = last_name;
        if (phone !== undefined) updates.phone = phone;
        if (upCompany !== undefined) updates.company_name = upCompany;
        if (upVat !== undefined) updates.vat_number = upVat;
        if (newsletter_opt_in !== undefined) {
          updates.newsletter_opted_in = !!newsletter_opt_in;
          if (newsletter_opt_in && !customer.newsletter_opted_in) {
            updates.newsletter_opted_in_at = new Date().toISOString();
          }
        }
        const { data, error } = await supabase.from('storefront_customers').update(updates).eq('id', customer.id).select('id, email, first_name, last_name, phone, newsletter_opted_in, company_name, vat_number, vat_verified').single();
        if (error) throw error;

        // Sync changes to customers table
        await syncToCustomers(supabase, tenant_id, data, newsletter_opt_in);

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

      // ============ PASSWORD RESET ============

      case 'request_password_reset': {
        const email = ((params as any).email || '').trim().toLowerCase();
        if (!email) throw new Error('email is required');

        const { data: customer } = await supabase
          .from('storefront_customers').select('id, email, first_name')
          .eq('tenant_id', tenant_id).eq('email', email).eq('is_active', true).maybeSingle();

        // Always return success (don't leak whether email exists)
        if (!customer) {
          result = { message: 'If an account with that email exists, a reset link has been sent.' };
          break;
        }

        // Generate reset token (HMAC-based, 1 hour expiry)
        const resetPayload = { customer_id: customer.id, tenant_id, email, purpose: 'password_reset' };
        const resetToken = await generateToken({ ...resetPayload, exp: Math.floor(Date.now() / 1000) + 3600 }, tokenSecret);
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

        await supabase.from('storefront_customers').update({
          password_reset_token: resetToken,
          password_reset_expires_at: expiresAt,
        }).eq('id', customer.id);

        // Send password reset email via Resend
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          try {
            // Get tenant info for branding
            const { data: tenant } = await supabase.from('tenants').select('store_name, name, slug').eq('id', tenant_id).single();
            const storeName = tenant?.store_name || tenant?.name || 'Shop';

            // Check for custom frontend URL
            const { data: themeRow } = await supabase.from('tenant_theme_settings').select('use_custom_frontend, custom_frontend_url').eq('tenant_id', tenant_id).maybeSingle();
            let resetUrl: string;
            if (themeRow?.use_custom_frontend && themeRow?.custom_frontend_url) {
              const base = (themeRow.custom_frontend_url as string).replace(/\/+$/, '');
              resetUrl = `${base}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;
            } else {
              resetUrl = `https://sellqo.lovable.app/shop/${tenant?.slug || ''}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;
            }

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${storeName} <noreply@sellqo.nl>`,
                to: [email],
                subject: `Wachtwoord herstellen — ${storeName}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <h1 style="font-size: 24px; margin-bottom: 16px;">Wachtwoord herstellen</h1>
                    <p style="color: #555; line-height: 1.6;">Hallo${customer.first_name ? ` ${customer.first_name}` : ''},</p>
                    <p style="color: #555; line-height: 1.6;">We hebben een verzoek ontvangen om het wachtwoord van je account bij <strong>${storeName}</strong> te herstellen.</p>
                    <p style="color: #555; line-height: 1.6;">Klik op de onderstaande knop om een nieuw wachtwoord in te stellen. Deze link is 1 uur geldig.</p>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${resetUrl}" style="background-color: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Nieuw wachtwoord instellen</a>
                    </div>
                    <p style="color: #888; font-size: 13px; line-height: 1.5;">Als je dit verzoek niet hebt gedaan, kun je deze e-mail negeren. Je wachtwoord blijft ongewijzigd.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                    <p style="color: #aaa; font-size: 12px;">${storeName}</p>
                  </div>
                `,
              }),
            });
            if (!emailRes.ok) {
              console.error('Resend error:', await emailRes.text());
            }
          } catch (emailErr) {
            console.error('Failed to send reset email:', emailErr);
          }
        }

        result = { message: 'If an account with that email exists, a reset link has been sent.' };
        break;
      }

      case 'reset_password': {
        const { email: resetEmail, reset_token, new_password: resetNewPassword } = params as any;
        if (!resetEmail || !reset_token || !resetNewPassword) throw new Error('email, reset_token and new_password are required');
        if (resetNewPassword.length < 8) throw new Error('Password must be at least 8 characters');

        const emailLower = resetEmail.trim().toLowerCase();

        // Verify token is valid HMAC token
        const payload = await verifyToken(reset_token, tokenSecret);
        if (!payload || payload.email !== emailLower || payload.purpose !== 'password_reset') {
          throw new Error('Invalid or expired reset token');
        }

        // Check token matches stored token and hasn't expired
        const { data: customer } = await supabase
          .from('storefront_customers').select('id, password_reset_token, password_reset_expires_at')
          .eq('tenant_id', tenant_id).eq('email', emailLower).eq('is_active', true).maybeSingle();

        if (!customer || customer.password_reset_token !== reset_token) {
          throw new Error('Invalid or expired reset token');
        }
        if (customer.password_reset_expires_at && new Date(customer.password_reset_expires_at) < new Date()) {
          throw new Error('Reset token has expired');
        }

        const newHash = await hashPassword(resetNewPassword);
        await supabase.from('storefront_customers').update({
          password_hash: newHash,
          password_reset_token: null,
          password_reset_expires_at: null,
        }).eq('id', customer.id);

        result = { message: 'Password reset successfully' };
        break;
      }

      // ============ WISHLIST / FAVORITES ============

      case 'wishlist_get': {
        const customer = await getCustomer();
        const { data: favorites } = await supabase
          .from('storefront_favorites')
          .select('id, product_id, created_at')
          .eq('tenant_id', tenant_id).eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        // Enrich with product data
        const productIds = (favorites || []).map((f: any) => f.product_id);
        let products: any[] = [];
        if (productIds.length > 0) {
          const { data: prods } = await supabase
            .from('products')
            .select('id, name, slug, price, compare_at_price, images, track_inventory, stock, is_active')
            .in('id', productIds);
          products = prods || [];
        }

        const productMap = new Map(products.map((p: any) => [p.id, p]));
        result = (favorites || []).map((f: any) => {
          const p = productMap.get(f.product_id);
          return {
            id: f.id, product_id: f.product_id, created_at: f.created_at,
            product: p ? {
              name: p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price,
              image: p.images?.[0] || null, in_stock: !p.track_inventory || p.stock > 0, is_active: p.is_active,
            } : null,
          };
        });
        break;
      }

      case 'wishlist_add': {
        const customer = await getCustomer();
        const productId = (params as any).product_id;
        if (!productId) throw new Error('product_id is required');

        // Verify product exists
        const { data: product } = await supabase
          .from('products').select('id').eq('id', productId).eq('tenant_id', tenant_id).eq('is_active', true).maybeSingle();
        if (!product) throw new Error('Product not found');

        const { error } = await supabase.from('storefront_favorites').upsert(
          { tenant_id, customer_id: customer.id, product_id: productId },
          { onConflict: 'tenant_id,customer_id,product_id' }
        );
        if (error) throw error;
        result = { message: 'Product added to wishlist' };
        break;
      }

      case 'wishlist_remove': {
        const customer = await getCustomer();
        const productId = (params as any).product_id;
        if (!productId) throw new Error('product_id is required');

        await supabase.from('storefront_favorites')
          .delete()
          .eq('tenant_id', tenant_id).eq('customer_id', customer.id).eq('product_id', productId);
        result = { message: 'Product removed from wishlist' };
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
