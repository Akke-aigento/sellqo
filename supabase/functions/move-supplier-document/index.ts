// INKOOP-5 — een inkoopfactuur naar een andere winkel verplaatsen (Akke 27-10: "zoals
// Mancini met zijn 3 webshops"). Verplaatst het document, het bestand en de leverancier.
//
//   GET                                   versie-vingerafdruk
//   POST (ingelogde gebruiker)            { documentId, targetTenantId }
//
// Regels:
//   - de gebruiker is beheerder of medewerker van BEIDE winkels (ook een platformbeheerder:
//     nooit stil een factuur in de winkel van een klant zetten);
//   - staat de factuur al in Odoo, dan enkel naar een winkel met dezelfde Odoo (zelfde
//     URL + databank): de koppeling blijft geldig. Anders weigeren;
//   - geen dubbel in de doelwinkel (zelfde extern id of Odoo-boeking);
//   - het bestand verhuist mee naar de map van de doelwinkel (opslagregels per winkel).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse, type AuthResult } from "../_shared/auth.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";

const VERSION = "INKOOP-5";
const BUCKET = "supplier-documents";
const ROLES = ["tenant_admin", "staff"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function hasOwnRole(auth: AuthResult, tenantId: string): boolean {
  return (auth.roles_by_tenant?.[tenantId] ?? []).some((r) => ROLES.includes(r));
}

async function odooTarget(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data } = await supabase.from("tenant_odoo_credentials").select("odoo_url, odoo_db").eq("tenant_id", tenantId).maybeSingle();
  return data ? `${String(data.odoo_url).replace(/\/+$/, "").toLowerCase()}|${data.odoo_db}` : null;
}

async function supplierInTarget(supabase: SupabaseClient, sourceSupplierId: string | null, targetTenantId: string, sameOdoo: boolean): Promise<string | null> {
  if (!sourceSupplierId) return null;
  const { data: src } = await supabase.from("suppliers")
    .select("name, email, vat_number, website, odoo_partner_id").eq("id", sourceSupplierId).maybeSingle();
  if (!src) return null;
  // Een Odoo-partner-id geldt enkel binnen dezelfde Odoo.
  const partnerId = sameOdoo ? src.odoo_partner_id : null;
  if (partnerId) {
    const { data } = await supabase.from("suppliers").select("id").eq("tenant_id", targetTenantId).eq("odoo_partner_id", partnerId).maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data: byName } = await supabase.from("suppliers").select("id").eq("tenant_id", targetTenantId).ilike("name", src.name).limit(1);
  if (byName?.[0]?.id) return byName[0].id as string;
  const { data: created, error } = await supabase.from("suppliers").insert({
    tenant_id: targetTenantId, name: src.name, email: src.email, vat_number: src.vat_number, website: src.website,
    odoo_partner_id: partnerId, country: null,
  }).select("id").single();
  if (error) throw new Error(`leverancier in doelwinkel: ${error.message}`);
  return created.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await authenticateRequest(req);
    if (auth.user_id === "service_role") throw new AuthError("Enkel voor gebruikers", 403);
    const body = (await req.json().catch(() => ({}))) as { documentId?: string; targetTenantId?: string };
    if (!body.documentId || !body.targetTenantId) return json({ success: false, error: "documentId en targetTenantId vereist" }, 400);

    const { data: doc, error } = await supabase.from("supplier_documents")
      .select("id, tenant_id, supplier_id, storage_path, file_name, external_id, odoo_move_id, odoo_status")
      .eq("id", body.documentId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) return json({ success: false, error: "Document niet gevonden" }, 404);
    const source = doc.tenant_id as string;
    const target = body.targetTenantId;
    if (source === target) return json({ success: false, error: "Het document staat al in die winkel" }, 400);
    if (!hasOwnRole(auth, source) || !hasOwnRole(auth, target)) {
      throw new AuthError("Je moet beheerder of medewerker van beide winkels zijn", 403);
    }
    await requireBillingState(supabase, auth, source, "suppliers");
    await requireBillingState(supabase, auth, target, "suppliers");

    if (doc.odoo_status === "pending") return json({ success: false, error: "Wordt net naar Odoo gestuurd. Probeer het zo meteen opnieuw." }, 409);
    const [odooA, odooB] = await Promise.all([odooTarget(supabase, source), odooTarget(supabase, target)]);
    const sameOdoo = !!odooA && odooA === odooB;
    if (doc.odoo_move_id) {
      if (!sameOdoo) {
        return json({ success: false, error: "Deze factuur staat al in de Odoo van de huidige winkel. Verplaatsen kan enkel naar een winkel met dezelfde Odoo." }, 409);
      }
    }
    const conflicts = await supabase.from("supplier_documents").select("id")
      .eq("tenant_id", target)
      .or([doc.external_id ? `external_id.eq."${String(doc.external_id).replace(/"/g, "")}"` : null, doc.odoo_move_id ? `odoo_move_id.eq.${Number(doc.odoo_move_id)}` : null].filter(Boolean).join(",") || "id.is.null")
      .limit(1);
    if (conflicts.error) throw new Error(conflicts.error.message);
    if ((conflicts.data ?? []).length) return json({ success: false, error: "Deze factuur staat al in die winkel" }, 409);

    const supplierId = await supplierInTarget(supabase, doc.supplier_id as string | null, target, sameOdoo);

    let newPath: string | null = null;
    if (doc.storage_path) {
      const rest = String(doc.storage_path).split("/").slice(1).join("/");
      newPath = `${target}/${rest}`;
      const { error: mvErr } = await supabase.storage.from(BUCKET).move(doc.storage_path, newPath);
      if (mvErr) throw new Error(`bestand verplaatsen: ${mvErr.message}`);
    }
    // Voorwaardelijk: niets mag intussen gewijzigd zijn (bv. een push die net startte).
    let upd = supabase.from("supplier_documents").update({
      tenant_id: target, supplier_id: supplierId, purchase_order_id: null,
      ...(newPath ? { storage_path: newPath, file_url: newPath } : {}),
      // Nog niet in Odoo: in de doelwinkel met een schone lei beginnen.
      ...(doc.odoo_move_id ? {} : { odoo_status: null, odoo_error: null, odoo_attempts: 0 }),
    }).eq("id", doc.id).eq("tenant_id", source);
    upd = doc.odoo_move_id
      ? upd.eq("odoo_move_id", doc.odoo_move_id)
      : upd.is("odoo_move_id", null).or("odoo_status.is.null,odoo_status.eq.error");
    const { data: moved, error: upErr } = await upd.select("id");
    if (upErr || !moved?.length) {
      if (newPath) await supabase.storage.from(BUCKET).move(newPath, doc.storage_path);
      if (upErr) throw new Error(`document verplaatsen: ${upErr.message}`);
      return json({ success: false, error: "Het document werd intussen gewijzigd (bv. naar Odoo gestuurd). Probeer het opnieuw." }, 409);
    }

    // Nog niet in Odoo en de doelwinkel stuurt door? Dan meteen (de trigger vuurt enkel bij insert).
    if (!doc.odoo_move_id) {
      const { data: s } = await supabase.from("tenant_odoo_settings").select("push_supplier_documents").eq("tenant_id", target).maybeSingle();
      if (s?.push_supplier_documents) {
        const { data: secret } = await supabase.from("internal_config").select("value").eq("key", "internal_webhook_secret").maybeSingle();
        if (secret?.value) {
          // Wachten (max. 25 s): een losgelaten fetch wordt na het antwoord afgebroken.
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/import-supplier-invoices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-cron-secret": String(secret.value) },
            body: JSON.stringify({ mode: "push", tenantId: target, documentId: doc.id }),
            signal: AbortSignal.timeout(25_000),
          }).catch((e) => console.warn("push na verplaatsen:", e instanceof Error ? e.message : String(e)));
        }
      }
    }
    return json({ success: true, version: VERSION, documentId: doc.id, tenantId: target });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, corsHeaders);
    console.error("move-supplier-document:", e instanceof Error ? e.message : String(e));
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
