import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@13.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errMsg = (e: unknown) => (e as Error)?.message ?? JSON.stringify(e);

/**
 * Buckets waarvan het eerste pad-segment het tenant_id is.
 * Gemeten op storage.objects + upload-code:
 *  - invoices / credit-notes / peppol-archive / shipping-labels / product-images
 *    / tenant-assets / ai-images        -> {tenant_id}/...
 *  - digital-products                   -> {tenant_id}/{product_id}/...
 *  - supplier-documents                 -> {tenant_id}/{supplier_id}/...
 *  - message-attachments                -> {tenant_id}/{thread}/...
 *  - marketing-assets                   -> GEMENGD: {tenant_id}/... EN blog/...
 *                                          (blog/ is platformbreed en blijft staan)
 *  - tenant-logos                       -> GEMENGD: {tenant_id}/... EN legacy {slug}/...
 *                                          (apart behandeld, zie hieronder)
 */
const TENANT_BUCKETS = [
  "invoices",
  "credit-notes",
  "peppol-archive",
  "shipping-labels",
  "product-images",
  "tenant-assets",
  "ai-images",
  "digital-products",
  "supplier-documents",
  "message-attachments",
  "marketing-assets",
];

/** Recursieve prefix-purge: storage.list is niet recursief. */
async function purgePrefix(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<number> {
  let removed = 0;
  const walk = async (path: string) => {
    const { data, error } = await admin.storage.from(bucket).list(path, { limit: 1000 });
    if (error || !data) {
      if (error) console.warn(`[delete-tenant] list ${bucket}/${path}:`, errMsg(error));
      return;
    }
    const files = data.filter((o) => o.id !== null).map((o) => `${path}/${o.name}`);
    if (files.length) {
      const { error: rmErr } = await admin.storage.from(bucket).remove(files);
      if (rmErr) console.warn(`[delete-tenant] remove ${bucket}:`, errMsg(rmErr));
      else removed += files.length;
    }
    for (const dir of data.filter((o) => o.id === null)) {
      await walk(`${path}/${dir.name}`);
    }
  };
  await walk(prefix);
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ---------- AUTZ: caller moet platform_admin zijn ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      console.error("[delete-tenant] auth failed:", errMsg(userError));
      return json(401, { error: "Unauthorized" });
    }

    const { data: callerRoles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) throw rolesError;

    if (!(callerRoles ?? []).some((r: { role: string }) => r.role === "platform_admin")) {
      return json(403, { error: "Forbidden: platform admin required" });
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id = (body as { tenant_id?: unknown }).tenant_id;
    if (!tenant_id || typeof tenant_id !== "string") {
      return json(400, { error: "tenant_id is verplicht" });
    }

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .select("id, name, slug, stripe_account_id")
      .eq("id", tenant_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) return json(404, { error: "Winkel niet gevonden" });

    // ---------- STAP 1: omzet-guard ----------
    // payment_status enum: pending | paid | refunded | failed | partially_refunded
    const { count: paidCount, error: oErr } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .in("payment_status", ["paid", "refunded", "partially_refunded"]);
    if (oErr) throw oErr;

    if ((paidCount ?? 0) > 0) {
      return json(409, {
        blocked: true,
        reason: "has_paid_orders",
        count: paidCount,
        tenant_name: tenant.name,
      });
    }

    // ---------- STAP 6a: user_ids VOORAF vastleggen ----------
    // Moet vóór de delete: user_roles cascadeert straks weg.
    const { data: tenantRoles, error: trErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", tenant_id);
    if (trErr) throw trErr;
    const candidateUserIds = [
      ...new Set((tenantRoles ?? []).map((r: { user_id: string }) => r.user_id)),
    ];

    // ---------- STAP 2: blokkerende FK-rijen (NO ACTION) ----------
    // credit_note_lines cascadeert op credit_note_id; ai_credit_purchases is los.
    const { error: cnErr } = await admin.from("credit_notes").delete().eq("tenant_id", tenant_id);
    if (cnErr) throw cnErr;
    const { error: acErr } = await admin
      .from("ai_credit_purchases")
      .delete()
      .eq("tenant_id", tenant_id);
    if (acErr) throw acErr;

    // ---------- STAP 5: tenant verwijderen (194 cascades) ----------
    // Bewust vóór de onomkeerbare acties: een gefaalde delete mag nooit een
    // tenant achterlaten die z'n bestanden/Stripe al kwijt is.
    const { error: dErr } = await admin.from("tenants").delete().eq("id", tenant_id);
    if (dErr) throw dErr;

    // ---------- STAP 3: storage purgen (ná de delete) ----------
    const storageReport: Record<string, number> = {};
    for (const bucket of TENANT_BUCKETS) {
      storageReport[bucket] = await purgePrefix(admin, bucket, tenant_id);
    }
    storageReport["tenant-logos"] =
      (await purgePrefix(admin, "tenant-logos", tenant_id)) +
      (tenant.slug ? await purgePrefix(admin, "tenant-logos", tenant.slug) : 0);

    // ---------- STAP 4: Stripe connected account (ná de delete) ----------
    let stripe_disconnected = false;
    let stripe_error: string | null = null;
    if (tenant.stripe_account_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        stripe_error = "STRIPE_SECRET_KEY ontbreekt";
      } else {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
          await stripe.accounts.del(tenant.stripe_account_id);
          stripe_disconnected = true;
        } catch (e) {
          stripe_error = errMsg(e);
        }
      }
    }

    // ---------- STAP 6b: users opruimen ----------
    const deleted_users: string[] = [];
    const detached_users: Array<{ user_id: string; reason: string }> = [];

    for (const uid of candidateUserIds) {
      const { data: remaining, error: remErr } = await admin
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", uid);

      if (remErr) {
        detached_users.push({ user_id: uid, reason: `role_lookup_failed: ${errMsg(remErr)}` });
        continue;
      }

      const rows = (remaining ?? []) as Array<{ role: string; tenant_id: string | null }>;

      // Platform admins overleven ALTIJD.
      if (rows.some((r) => r.role === "platform_admin")) {
        detached_users.push({ user_id: uid, reason: "platform_admin" });
        continue;
      }
      // Nog een andere binding -> enkel loskoppelen.
      if (rows.length > 0) {
        detached_users.push({ user_id: uid, reason: "other_tenant_roles" });
        continue;
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(uid);
      if (delErr) detached_users.push({ user_id: uid, reason: `delete_failed: ${delErr.message}` });
      else deleted_users.push(uid);
    }

    // ---------- STAP 7: rapport ----------
    return json(200, {
      success: true,
      tenant: { id: tenant_id, name: tenant.name, slug: tenant.slug },
      deleted_users,
      detached_users,
      storage: storageReport,
      stripe_disconnected,
      stripe_error,
    });
  } catch (e) {
    console.error("[delete-tenant]", errMsg(e));
    return json(500, { error: errMsg(e) });
  }
});
