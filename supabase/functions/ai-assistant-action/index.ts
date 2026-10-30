// AI-AGENT-1 — voert één door de gebruiker bevestigde actie van de hulpassistent uit.
//
// Veiligheid:
// - Winkel en rol worden gecontroleerd (tenant_admin of staff; platformadmin mag ook).
// - Het plan moet `ai_actions` hebben (alle betaalde plannen, ook tijdens de proef).
// - De actie wordt opnieuw gevalideerd tegen de actuele data (product van deze winkel,
//   variant, voorraad opgevolgd, prijsgrenzen). Wat de client meestuurt als "before" telt niet.
// - Uitvoeren gebeurt met de JWT van de gebruiker, via dezelfde paden als de UI:
//   record_stock_movement (voorraadlog), products.update (RLS), set_product_sold_out_today.
// - 1 AI-credit per uitgevoerde actie: eerst atomisch afgeboekt, teruggeboekt als de actie
//   mislukt. Idempotentie per kaart. De metadata in ai_usage_log is het auditspoor.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { AI_ACTION_CREDITS, MAX_BULK, bulkNewPrice, buildCreateProduct, planAllowsActions, revalidate, slugify, type ActionKind, type ActionProposal } from "../_shared/aiActions.ts";
import { loadProduct, tenantPlanFeatures } from "../_shared/aiActionsDb.ts";
import { brusselsEndOfDayIso, checkDiscount } from "../_shared/aiTools.ts";

const VERSION = "AI-AGENT-2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenant_id || "");
    const action = body?.action as { kind?: ActionKind; product_id?: string; variant_id?: string | null; after?: unknown; delta?: unknown; mode?: unknown; amount?: unknown; payload?: Record<string, unknown> } | undefined;
    const MULTI = ["create_product", "bulk_price", "discount_code"];
    if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !action?.kind || (!MULTI.includes(action.kind) && !action.product_id)) {
      return json({ success: false, error: "invalid_request" }, 400);
    }

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin", "staff"]);
    if (auth.user_id === "service_role") return json({ success: false, error: "user_required" }, 403);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Client met de rechten van de gebruiker: RLS en de tenantcontrole in de RPC's gelden.
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: { persistSession: false },
    });

    if (!auth.is_platform_admin && !planAllowsActions(await tenantPlanFeatures(admin, tenantId))) {
      return json({ success: false, error: "feature_not_in_plan" }, 403);
    }

    // Hervalideren tegen de actuele data. Wat de client meestuurt, telt enkel als intentie.
    let checked: { ok: true; value: ActionProposal } | { ok: false; error: string };
    const pl = (action.payload ?? {}) as Record<string, unknown>;
    if (action.kind === "create_product") {
      let catId: string | null = null;
      if (typeof pl.category_id === "string") {
        const { data: cat } = await admin.from("categories").select("id").eq("tenant_id", tenantId).eq("id", pl.category_id).maybeSingle();
        catId = cat?.id ?? null;
      }
      const base = slugify(String(pl.name || ""));
      const { data: slugRows } = await admin.from("products").select("slug").eq("tenant_id", tenantId).like("slug", `${base}%`).limit(300);
      checked = buildCreateProduct({ ...pl }, new Set(((slugRows ?? []) as Array<{ slug: string }>).map((x) => x.slug)), catId);
    } else if (action.kind === "bulk_price") {
      // Bindend: precies de getoonde prijzen. Is een prijs intussen veranderd, dan "stale" (409)
      // in plaats van opnieuw te rekenen (anders stapelt een procent bij een tweede kaart).
      const proposed = Array.isArray(pl.items) ? (pl.items as Array<{ product_id?: string; before?: unknown; after?: unknown }>) : [];
      const wanted = proposed.map((x) => String(x.product_id || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
      if (!wanted.length || wanted.length !== proposed.length || wanted.length > MAX_BULK) checked = { ok: false, error: "invalid_request" };
      else {
        const { data: rows } = await admin.from("products").select("id, name, price").eq("tenant_id", tenantId).in("id", wanted);
        const cur = new Map(((rows ?? []) as Array<{ id: string; name: string; price: number }>).map((x) => [x.id, x]));
        let stale = false, bad = false;
        const items = proposed.map((x) => {
          const c = cur.get(String(x.product_id));
          const before = Number(x.before), after = Number(x.after);
          if (!c) { bad = true; return null; }
          if (Number(c.price) !== before) { stale = true; return null; }
          if (bulkNewPrice(before, pl.mode, pl.value) !== after) { bad = true; return null; }
          return { product_id: c.id, product_name: c.name, before, after };
        }).filter(Boolean) as Array<{ product_id: string; product_name: string; before: number; after: number }>;
        checked = bad ? { ok: false, error: "invalid_request" }
          : stale ? { ok: false, error: "stale" }
          : { ok: true, value: { kind: "bulk_price", product_id: "", variant_id: null, product_name: String(action.product_id || ""), before: null, after: items.length, payload: { mode: pl.mode, value: pl.value, items } } };
      }
    } else if (action.kind === "discount_code") {
      const d = checkDiscount({ code: pl.code, discount_type: pl.discount_type, value: pl.discount_value, valid_until: pl.valid_until, minimum_order_amount: pl.minimum_order_amount, usage_limit: pl.usage_limit });
      if (!d.ok) checked = d;
      else {
        const { count } = await admin.from("discount_codes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).ilike("code", String(d.value.code).replace(/[%_]/g, (m) => `\\${m}`));
        checked = (count ?? 0) > 0 ? { ok: false, error: "code_exists" } : { ok: true, value: { kind: "discount_code", product_id: "", variant_id: null, product_name: d.value.code as string, before: null, after: Number(d.value.discount_value), payload: d.value } };
      }
    } else {
      const product = await loadProduct(admin, tenantId, action.product_id!);
      checked = revalidate(
        { kind: action.kind, product_id: action.product_id!, variant_id: action.variant_id ?? null, after: action.after, delta: action.delta, mode: action.mode, amount: action.amount },
        product,
      );
    }
    if (!checked.ok) return json({ success: false, error: checked.error }, checked.error === "no_change" || checked.error === "stale" ? 409 : 422);
    const p = checked.value;

    // Idempotentie: één sleutel per kaart. Een herhaalde tik of een retry na een verloren
    // antwoord voert de actie geen tweede keer uit en boekt geen tweede credit af.
    const idem = typeof body?.idempotency_key === "string" && /^[0-9a-f-]{36}$/i.test(body.idempotency_key) ? body.idempotency_key : null;
    if (!idem) return json({ success: false, error: "invalid_request" }, 400);
    const { data: prior } = await admin
      .from("ai_usage_log")
      .select("feature")
      .eq("tenant_id", tenantId)
      .in("feature", ["ai_actions", "ai_actions_refund"])
      .eq("metadata->>idempotency_key", idem);
    const priorRows = (prior ?? []) as Array<{ feature: string }>;
    if (priorRows.some((r) => r.feature === "ai_actions") && !priorRows.some((r) => r.feature === "ai_actions_refund")) {
      return json({ success: true, duplicate: true, action: p });
    }

    // Eerst afboeken (atomisch in use_ai_credits; vrijgestelde winkels: 0 en gelogd), dan
    // uitvoeren, en bij een mislukte actie terugboeken. Platformadmins: 0 credits, wel gelogd,
    // zodat elke actie een auditspoor heeft (wie, wat, voor/na).
    const meta = { kind: p.kind, product_id: p.product_id, variant_id: p.variant_id, before: p.before, after: p.after, user_id: auth.user_id, idempotency_key: idem };
    const cost = auth.is_platform_admin ? 0 : AI_ACTION_CREDITS;
    const { data: charged, error: chargeErr } = await admin.rpc("use_ai_credits", {
      p_tenant_id: tenantId, p_credits: cost, p_feature: "ai_actions", p_model: null, p_metadata: meta,
    });
    if (chargeErr) return json({ success: false, error: "internal_error" }, 500);
    if (charged === false) return json({ success: false, error: "insufficient_credits" }, 402);

    const refund = async (reason: string) => {
      if (cost > 0) {
        const { data: row } = await admin.from("tenant_ai_credits").select("credits_used").eq("tenant_id", tenantId).maybeSingle();
        const { data: t } = await admin.from("tenants").select("is_internal_tenant, billing_exempt").eq("id", tenantId).maybeSingle();
        // Vrijgestelde winkels werden niet aangerekend: dan ook niets terugboeken.
        if (row && !(t?.is_internal_tenant || t?.billing_exempt)) {
          await admin.from("tenant_ai_credits")
            .update({ credits_used: Math.max(0, Number(row.credits_used ?? 0) - cost), updated_at: new Date().toISOString() })
            .eq("tenant_id", tenantId);
        }
      }
      await admin.from("ai_usage_log").insert({ tenant_id: tenantId, feature: "ai_actions_refund", credits_used: 0, model_used: null, metadata: { ...meta, reason } });
    };

    let result: unknown = null;
    if (p.kind === "stock") {
      const { data, error } = await asUser.rpc("record_stock_movement", {
        p_tenant_id: null,
        p_product_id: p.variant_id ? null : p.product_id,
        p_variant_id: p.variant_id,
        p_delta: p.delta,
        p_reason: "manual",
        p_reference_type: null,
        p_reference_id: null,
        p_note: "AI-assistent",
        p_created_by: null,
      });
      if (error || data == null) { await refund("stock_update_failed"); return json({ success: false, error: "stock_update_failed" }, 500); }
      result = { stock: data };
    } else if (p.kind === "price") {
      const { data, error } = await asUser
        .from("products")
        .update({ price: p.after, updated_at: new Date().toISOString() })
        .eq("id", p.product_id)
        .eq("tenant_id", tenantId)
        .select("price")
        .maybeSingle();
      if (error || !data) { await refund("price_update_failed"); return json({ success: false, error: "price_update_failed" }, 500); }
      result = { price: Number(data.price) };
    } else if (p.kind === "sold_out") {
      const { error } = await asUser.rpc("set_product_sold_out_today", { p_product_id: p.product_id, p_sold_out: p.after });
      if (error) { await refund("sold_out_update_failed"); return json({ success: false, error: "sold_out_update_failed" }, 500); }
      result = { sold_out: p.after };
    } else if (p.kind === "active") {
      const { data, error } = await asUser.from("products").update({ is_active: p.after, updated_at: new Date().toISOString() })
        .eq("id", p.product_id).eq("tenant_id", tenantId).select("is_active").maybeSingle();
      if (error || !data) { await refund("active_update_failed"); return json({ success: false, error: "active_update_failed" }, 500); }
      result = { active: data.is_active };
    } else if (p.kind === "create_product") {
      const v = p.payload as Record<string, unknown>;
      // Als concept (inactief): de gebruiker voegt foto's toe en zet het zelf live.
      const { data, error } = await asUser.from("products").insert({
        tenant_id: tenantId, name: v.name, slug: v.slug, price: v.price, description: v.description || null,
        category_id: v.category_id ?? null, is_food: v.is_food === true, product_type: "physical", is_active: false,
      }).select("id").maybeSingle();
      if (error || !data) { await refund("create_failed"); return json({ success: false, error: "create_failed" }, 500); }
      let categoryLinked = !v.category_id;
      if (v.category_id) {
        const { error: linkErr } = await asUser.from("product_categories").insert({ product_id: data.id, category_id: v.category_id, is_primary: true, sort_order: 0 });
        if (linkErr) console.error("ai-assistant-action: categorie koppelen mislukt", linkErr.message);
        categoryLinked = !linkErr;
      }
      result = { product_id: data.id, category_linked: categoryLinked };
    } else if (p.kind === "bulk_price") {
      const items = ((p.payload as Record<string, unknown>).items ?? []) as Array<{ product_id: string; after: number }>;
      let done = 0;
      for (const it of items) {
        const { error } = await asUser.from("products").update({ price: it.after, updated_at: new Date().toISOString() }).eq("id", it.product_id).eq("tenant_id", tenantId);
        if (!error) done++;
      }
      if (done === 0) { await refund("bulk_failed"); return json({ success: false, error: "price_update_failed" }, 500); }
      result = { updated: done, total: items.length };
    } else if (p.kind === "discount_code") {
      const v = p.payload as Record<string, unknown>;
      const { data, error } = await asUser.from("discount_codes").insert({
        tenant_id: tenantId, code: v.code, discount_type: v.discount_type, discount_value: v.discount_value,
        minimum_order_amount: v.minimum_order_amount ?? null, usage_limit: v.usage_limit ?? null,
        valid_until: v.valid_until ? brusselsEndOfDayIso(String(v.valid_until)) : null, is_active: true, applies_to: "all",
        description: "Aangemaakt door de AI-assistent",
      }).select("id").maybeSingle();
      if (error || !data) { await refund("discount_failed"); return json({ success: false, error: "discount_failed" }, 500); }
      result = { discount_code_id: data.id };
    }

    return json({ success: true, action: p, result });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    console.error("ai-assistant-action error:", err instanceof Error ? err.message : err);
    return json({ success: false, error: "internal_error" }, 500);
  }
});
