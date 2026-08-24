import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-storefront-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple JWT-like token generation using HMAC
async function generateToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // Defaults EERST, payload daarna: een meegegeven exp wint nu. Stond de spread
  // vooraan, dan overschreef de 7-daagse default elke kortere exp — waardoor de
  // "1 uur" van de reset-token in de praktijk 7 dagen was.
  const now = Math.floor(Date.now() / 1000);
  const body = btoa(JSON.stringify({ iat: now, exp: now + 86400 * 7, ...payload })); // default 7 dagen
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

/**
 * Basis-URL voor links in klantmails (verificatie, wachtwoordherstel).
 *
 * Volgorde: (1) url_base uit de request, (2) tenants.custom_domain, (3) het oude
 * sellqo.lovable.app/shop/{slug}-pad met een waarschuwing.
 *
 * Stap 1 staat NIET vrij open. Deze functie draait met verify_jwt = false, dus
 * iedereen kan hem aanroepen met een willekeurig e-mailadres. Zou url_base
 * ongefilterd in de mail belanden, dan kan een aanvaller SellQo een gebrande mail
 * met zijn eigen link laten versturen — phishing met onze afzender. Daarom moet de
 * host van url_base bij DEZE tenant horen: verified in tenant_domains, gelijk aan
 * custom_domain, of een lovable.app-preview.
 */
async function resolveStorefrontBase(
  supabase: any,
  tenantId: string,
  urlBaseParam: unknown,
): Promise<{ tenant: any; baseUrl: string; source: string }> {
  // store_name bestaat NIET op tenants; die stond hier eerder wel in, waardoor de
  // hele select faalde en tenant null werd (en de reset-URL een lege slug kreeg).
  const { data: tenant } = await supabase
    .from('tenants').select('name, slug, custom_domain, support_email')
    .eq('id', tenantId).maybeSingle();

  const cleanHost = (v: string) => v.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  const strip = (v: string) => v.replace(/\/+$/, '');

  const candidate = typeof urlBaseParam === 'string' ? urlBaseParam.trim() : '';
  if (candidate) {
    let host = '';
    try {
      const u = new URL(candidate);
      if (u.protocol === 'https:') host = u.hostname.toLowerCase();
    } catch { /* onparseerbaar → val door naar de fallback */ }

    if (host) {
      if (tenant?.custom_domain && host === cleanHost(tenant.custom_domain)) {
        return { tenant, baseUrl: strip(candidate), source: 'url_base/custom_domain' };
      }
      if (host.endsWith('.lovable.app')) {
        return { tenant, baseUrl: strip(candidate), source: 'url_base/lovable' };
      }
      const { data: domains } = await supabase
        .from('tenant_domains').select('domain')
        .eq('tenant_id', tenantId).eq('dns_verified', true).eq('is_active', true);
      if ((domains || []).some((d: any) => typeof d?.domain === 'string' && cleanHost(d.domain) === host)) {
        return { tenant, baseUrl: strip(candidate), source: 'url_base/tenant_domains' };
      }
    }
    console.warn(`[storefront-customer-api] url_base geweigerd voor tenant ${tenantId}: ${candidate}`);
  }

  if (tenant?.custom_domain) {
    return { tenant, baseUrl: `https://${cleanHost(tenant.custom_domain)}`, source: 'custom_domain' };
  }

  console.warn(`[storefront-customer-api] geen custom_domain en geen geldige url_base voor tenant ${tenantId} — terugval op het sellqo.lovable.app-pad`);
  return { tenant, baseUrl: `https://sellqo.lovable.app/shop/${tenant?.slug || ''}`, source: 'legacy' };
}

/** Verificatiemail voor een nieuw of nog niet bevestigd klantaccount. */
async function sendVerificationEmail(
  supabase: any,
  tenantId: string,
  opts: { email: string; firstName?: string | null; token: string; urlBase: unknown },
): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[storefront-customer-api] RESEND_API_KEY ontbreekt — verificatiemail NIET verstuurd');
    return;
  }
  try {
    const { tenant, baseUrl, source } = await resolveStorefrontBase(supabase, tenantId, opts.urlBase);
    const storeName = tenant?.name || 'Shop';
    const verifyUrl = `${baseUrl}/account/verify?token=${encodeURIComponent(opts.token)}&email=${encodeURIComponent(opts.email)}`;
    console.log(`[storefront-customer-api] verificatielink via ${source} voor tenant ${tenantId}`);

    const { EMAIL_SENDERS } = await import('../_shared/emailSenders.ts');
    const sender = EMAIL_SENDERS.customerService(storeName, tenant?.support_email);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender.from,
        reply_to: sender.replyTo,
        to: [opts.email],
        subject: `Bevestig je e-mailadres — ${storeName}`,
        html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <h1 style="font-size: 24px; margin-bottom: 16px;">Bevestig je e-mailadres</h1>
                    <p style="color: #555; line-height: 1.6;">Hallo${opts.firstName ? ` ${opts.firstName}` : ''},</p>
                    <p style="color: #555; line-height: 1.6;">Bedankt voor je account bij <strong>${storeName}</strong>. Bevestig je e-mailadres om je bestelgeschiedenis te kunnen bekijken.</p>
                    <p style="color: #555; line-height: 1.6;">Deze link is 48 uur geldig.</p>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${verifyUrl}" style="background-color: #000; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">E-mailadres bevestigen</a>
                    </div>
                    <p style="color: #888; font-size: 13px; line-height: 1.5;">Heb je zelf geen account aangemaakt? Dan kun je deze e-mail negeren.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                    <p style="color: #aaa; font-size: 12px;">${storeName}</p>
                  </div>
                `,
      }),
    });
    if (!res.ok) console.error('Resend error (verification):', await res.text());
  } catch (err) {
    console.error('Failed to send verification email:', err);
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
      // Sessietokens dragen geen purpose. Een reset- of verificatietoken heeft er wél
      // een en mag hier niet als sessie gelden — anders is een wachtwoordherstel-link
      // een volwaardig inlogtoken. Achterwaarts compatibel: bestaande sessietokens
      // hebben geen purpose en komen ongehinderd door.
      if (payload.purpose && payload.purpose !== 'session') throw new Error('Invalid or expired token');
      const { data } = await supabase.from('storefront_customers').select('*').eq('id', payload.customer_id).eq('tenant_id', tenant_id).single();
      if (!data || !data.is_active) throw new Error('Account not found or inactive');
      return data;
    };

    let result: unknown;

    switch (action) {
      case 'register': {
        const { email, password, first_name, last_name, phone, url_base: regUrlBase } = params as any;
        if (!email || !password) throw new Error('email and password are required');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');

        const { data: existing } = await supabase.from('storefront_customers').select('id').eq('tenant_id', tenant_id).eq('email', email.toLowerCase()).maybeSingle();
        if (existing) throw new Error('An account with this email already exists');

        const passwordHash = await hashPassword(password);
        const regEmail = email.toLowerCase();

        // Verificatietoken, 48 uur. email_verified wordt EXPLICIET op false gezet:
        // de kolom heeft geen migratie in de repo, dus we vertrouwen niet op de
        // database-default — anders zou de enforcement op de order-endpoints stil
        // een no-op zijn als die default ooit true blijkt.
        const regNow = Math.floor(Date.now() / 1000);
        // Geen customer_id: de rij bestaat nog niet. verify_email zoekt op e-mailadres
        // en heeft hem niet nodig.
        const verifyToken = await generateToken(
          { tenant_id, email: regEmail, purpose: 'email_verification', exp: regNow + 48 * 3600 },
          tokenSecret,
        );
        const verifyExpiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        const { data: customer, error } = await supabase
          .from('storefront_customers')
          .insert({
            tenant_id,
            email: regEmail,
            password_hash: passwordHash,
            first_name: first_name || '',
            last_name: last_name || '',
            phone: phone || null,
            email_verified: false,
            email_verification_token: verifyToken,
            email_verification_expires_at: verifyExpiresAt,
          })
          .select('id, email, first_name, last_name, email_verified').single();
        if (error) throw error;

        // Mail is best-effort: een registratie mag niet stuklopen omdat Resend hapert.
        await sendVerificationEmail(supabase, tenant_id, {
          email: regEmail, firstName: customer.first_name, token: verifyToken, urlBase: regUrlBase,
        });

        // Response ongewijzigd op het additieve email_verified na: de klant wordt
        // nog steeds direct ingelogd. Alleen de order-endpoints zijn gated.
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
          customer: { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone, email_verified: customer.email_verified ?? false },
          token,
        };
        break;
      }

      case 'get_profile': {
        const customer = await getCustomer();
        result = { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name, phone: customer.phone, newsletter_opt_in: customer.newsletter_opt_in ?? false, email_verified: customer.email_verified ?? false, addresses: customer.addresses || [] };
        break;
      }

      case 'update_profile': {
        const customer = await getCustomer();
        const { first_name, last_name, phone, newsletter_opt_in } = params as any;
        const updates: any = {};
        if (first_name !== undefined) updates.first_name = first_name;
        if (last_name !== undefined) updates.last_name = last_name;
        if (phone !== undefined) updates.phone = phone;
        if (newsletter_opt_in !== undefined) updates.newsletter_opt_in = newsletter_opt_in;
        const { data, error } = await supabase.from('storefront_customers').update(updates).eq('id', customer.id).select('id, email, first_name, last_name, phone, newsletter_opt_in').single();
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_orders': {
        const customer = await getCustomer();
        // Orders worden gekoppeld op customer_email. Zonder bevestigd e-mailadres
        // zou registreren met andermans adres volstaan om hun gastbestellingen te
        // lezen. Accounts van vóór de invoering zijn gegrandfatherd in migratie
        // <ts>_custauth1_grandfather_email_verified.sql en raken hier niets kwijt.
        if (!customer.email_verified) {
          return new Response(
            JSON.stringify({ success: false, error: 'EMAIL_NOT_VERIFIED' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
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
        // Orders worden gekoppeld op customer_email. Zonder bevestigd e-mailadres
        // zou registreren met andermans adres volstaan om hun gastbestellingen te
        // lezen. Accounts van vóór de invoering zijn gegrandfatherd in migratie
        // <ts>_custauth1_grandfather_email_verified.sql en raken hier niets kwijt.
        if (!customer.email_verified) {
          return new Response(
            JSON.stringify({ success: false, error: 'EMAIL_NOT_VERIFIED' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
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

      // ============ E-MAILVERIFICATIE ============

      case 'verify_email': {
        // Bewust NIET geauthenticeerd: de klik komt vaak uit een andere browser
        // dan waar de klant is ingelogd. E-mail + token zijn hier het bewijs.
        const vEmail = ((params as any).email || '').trim().toLowerCase();
        const vToken = (params as any).token;
        if (!vEmail || !vToken) throw new Error('email and token are required');

        const payload = await verifyToken(vToken, tokenSecret);
        if (!payload || payload.email !== vEmail || payload.purpose !== 'email_verification' || payload.tenant_id !== tenant_id) {
          throw new Error('Invalid or expired verification token');
        }

        const { data: vCustomer } = await supabase
          .from('storefront_customers')
          .select('id, email_verified, email_verification_token, email_verification_expires_at')
          .eq('tenant_id', tenant_id).eq('email', vEmail).eq('is_active', true).maybeSingle();

        if (!vCustomer || vCustomer.email_verification_token !== vToken) {
          throw new Error('Invalid or expired verification token');
        }
        if (vCustomer.email_verification_expires_at && new Date(vCustomer.email_verification_expires_at) < new Date()) {
          throw new Error('Verification token has expired');
        }

        await supabase.from('storefront_customers').update({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires_at: null,
        }).eq('id', vCustomer.id);

        result = { message: 'Email verified successfully', email_verified: true };
        break;
      }

      case 'resend_verification': {
        // Nodig, niet optioneel: zonder deze action zit een klant wiens mail in spam
        // belandde of wiens token na 48 uur verliep permanent vast — opnieuw
        // registreren kan niet (e-mail bestaat al) en er is geen andere weg terug.
        const customer = await getCustomer();
        if (customer.email_verified) {
          result = { message: 'Email is already verified', email_verified: true };
          break;
        }

        const rvNow = Math.floor(Date.now() / 1000);
        const rvToken = await generateToken(
          { customer_id: customer.id, tenant_id, email: customer.email, purpose: 'email_verification', exp: rvNow + 48 * 3600 },
          tokenSecret,
        );
        await supabase.from('storefront_customers').update({
          email_verification_token: rvToken,
          email_verification_expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        }).eq('id', customer.id);

        await sendVerificationEmail(supabase, tenant_id, {
          email: customer.email, firstName: customer.first_name, token: rvToken, urlBase: (params as any).url_base,
        });

        result = { message: 'Verification email sent', email_verified: false };
        break;
      }

      // ============ PASSWORD RESET ============

      case 'request_password_reset': {
        const email = ((params as any).email || '').trim().toLowerCase();
        const resetUrlBase = (params as any).url_base;
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
        if (!resendApiKey) {
          // Stond hier eerder stil: de caller kreeg "reset link has been sent" terwijl
          // er niets vertrok en er geen spoor in de logs stond.
          console.error('[storefront-customer-api] RESEND_API_KEY ontbreekt — resetmail NIET verstuurd');
        }
        if (resendApiKey) {
          try {
            // store_name bestaat NIET op tenants; die kolom in de select liet de hele
            // query falen, waardoor tenant null werd, storeName op 'Shop' viel en de
            // reset-URL een lege slug kreeg. resolveStorefrontBase haalt de tenant nu
            // op met de kolommen die er wél zijn.
            const { tenant, baseUrl, source } = await resolveStorefrontBase(supabase, tenant_id, resetUrlBase);
            const storeName = tenant?.name || 'Shop';
            console.log(`[storefront-customer-api] resetlink via ${source} voor tenant ${tenant_id}`);

            const resetUrl = `${baseUrl}/account/reset?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;

            const { EMAIL_SENDERS: _SENDERS_PWR } = await import('../_shared/emailSenders.ts');
            const _pwSender = _SENDERS_PWR.customerService(storeName, tenant?.support_email);
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: _pwSender.from,
                reply_to: _pwSender.replyTo,
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
