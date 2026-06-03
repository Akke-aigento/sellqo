import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  AuthError,
  authenticateRequest,
  authErrorResponse,
  requireRole,
} from "../_shared/auth.ts";

type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "partially_returned";

interface RequestBody {
  tenant_id: string;
  order_id: string;
  new_status: OrderStatus;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

// status transition matrix
// returned (and partially_returned) are explicitly NOT allowed through this
// function — that flow lives in the returns module.
const TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  returned: [],
  partially_returned: [],
};

// transitions that require tenant_admin or staff (not warehouse)
const ADMIN_OR_STAFF_ONLY_TARGETS: OrderStatus[] = ["cancelled"];

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const {
    tenant_id,
    order_id,
    new_status,
    tracking_number,
    tracking_url,
    shipped_at,
    delivered_at,
  } = body ?? {};

  if (!tenant_id || !order_id || !new_status) {
    return json(
      { success: false, error: "tenant_id, order_id and new_status are required" },
      400,
    );
  }

  if (!(new_status in TRANSITIONS)) {
    return json({ success: false, error: `Unknown status: ${new_status}` }, 400);
  }

  let auth;
  try {
    auth = await authenticateRequest(req, tenant_id);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    throw err;
  }

  try {
    requireRole(auth, tenant_id, ["tenant_admin", "staff", "warehouse"]);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    throw err;
  }

  // Warehouse may not trigger admin-only transitions (e.g. cancelled).
  if (ADMIN_OR_STAFF_ONLY_TARGETS.includes(new_status)) {
    try {
      requireRole(auth, tenant_id, ["tenant_admin", "staff"]);
    } catch (err) {
      if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
      throw err;
    }
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load current order to validate transition + tenant binding.
  const { data: currentOrder, error: loadError } = await admin
    .from("orders")
    .select("id, tenant_id, status")
    .eq("id", order_id)
    .maybeSingle();

  if (loadError) {
    return json({ success: false, error: loadError.message }, 500);
  }
  if (!currentOrder) {
    return json({ success: false, error: "Order not found" }, 404);
  }
  if (currentOrder.tenant_id !== tenant_id) {
    return json({ success: false, error: "Order does not belong to tenant" }, 403);
  }

  const fromStatus = currentOrder.status as OrderStatus;

  // Allow no-op (same status) so bulk actions are idempotent.
  if (fromStatus !== new_status) {
    const allowed = TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(new_status)) {
      return json(
        {
          success: false,
          error: `Invalid status transition: ${fromStatus} → ${new_status}`,
        },
        422,
      );
    }
  }

  // Build whitelist of mutable fields. Everything else is ignored.
  const update: Record<string, unknown> = {
    status: new_status,
    updated_at: new Date().toISOString(),
  };
  const fieldsUpdated: string[] = ["status"];

  if (tracking_number !== undefined) {
    update.tracking_number = tracking_number;
    fieldsUpdated.push("tracking_number");
  }
  if (tracking_url !== undefined) {
    update.tracking_url = tracking_url;
    fieldsUpdated.push("tracking_url");
  }

  // Auto-stamp timestamps if caller didn't supply them.
  if (new_status === "shipped") {
    update.shipped_at = shipped_at ?? new Date().toISOString();
    fieldsUpdated.push("shipped_at");
  } else if (shipped_at !== undefined) {
    update.shipped_at = shipped_at;
    fieldsUpdated.push("shipped_at");
  }

  if (new_status === "delivered") {
    update.delivered_at = delivered_at ?? new Date().toISOString();
    fieldsUpdated.push("delivered_at");
  } else if (delivered_at !== undefined) {
    update.delivered_at = delivered_at;
    fieldsUpdated.push("delivered_at");
  }

  if (new_status === "cancelled") {
    update.cancelled_at = new Date().toISOString();
    fieldsUpdated.push("cancelled_at");
  }

  const { data: updatedOrder, error: updateError } = await admin
    .from("orders")
    .update(update)
    .eq("id", order_id)
    .eq("tenant_id", tenant_id)
    .select()
    .maybeSingle();

  if (updateError) {
    return json({ success: false, error: updateError.message }, 500);
  }

  // Audit trail — best-effort, do not fail the request on log errors.
  const { error: auditError } = await admin.from("admin_actions_log").insert({
    admin_user_id: auth.user_id === "service_role" ? null : auth.user_id,
    target_tenant_id: tenant_id,
    action_type: "order_fulfillment_status_update",
    action_details: {
      order_id,
      from_status: fromStatus,
      to_status: new_status,
      fields_updated: Array.from(new Set(fieldsUpdated)),
    },
  });
  if (auditError) {
    console.error("[update-order-fulfillment-status] audit log failed:", auditError);
  }

  return json({ success: true, order: updatedOrder }, 200);
});