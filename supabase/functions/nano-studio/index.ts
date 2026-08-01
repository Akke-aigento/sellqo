import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMGEDITOR_BASE = "https://imgeditor.co/api/v1/images";

type GenerateBody = {
  action: "generate";
  tenant_id: string;
  prompt: string;
  mode?: "text" | "image";
  model?: string;
  image_url?: string;
  aspect_ratio?: string;
  resolution?: string;
  num_images?: number;
  output_format?: string;
  source_product_id?: string;
};

type StatusBody = {
  action: "status";
  job_id: string;
};

type Body = GenerateBody | StatusBody | { action?: string };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapUpstreamError(status: number, upstream: unknown): { status: number; error: string } {
  if (status === 401) return { status: 502, error: "imgeditor_unauthorized" };
  if (status === 402) return { status: 402, error: "insufficient_credits" };
  if (status === 429) return { status: 429, error: "rate_limit_exceeded" };
  if (status === 451) return { status: 451, error: "content_filtered" };
  const upstreamMsg =
    typeof upstream === "object" && upstream && "message" in upstream
      ? String((upstream as { message: unknown }).message)
      : "imgeditor_error";
  return { status: 502, error: upstreamMsg };
}

function extractRole(authHeader: string): string | null {
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Autorisatie: verify_jwt=true valideert de handtekening op platformniveau;
  // hier controleren we dat de rol expliciet service_role is (anon wordt geweigerd).
  const role = extractRole(req.headers.get("Authorization") || "");
  if (role !== "service_role") {
    console.error("[nano-studio] unauthorized call, role:", role);
    return jsonResponse(403, { success: false, error: "service_role_required" });
  }
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    console.error("[nano-studio] SUPABASE_SERVICE_ROLE_KEY missing");
    return jsonResponse(500, { success: false, error: "service_key_not_configured" });
  }

  const apiKey = Deno.env.get("API_NANO");
  if (!apiKey) {
    console.error("[nano-studio] API_NANO secret is missing");
    return jsonResponse(500, { success: false, error: "api_nano_not_configured" });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse(400, { success: false, error: "invalid_json" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (body.action === "generate") {
      return await handleGenerate(admin, apiKey, body as GenerateBody);
    }
    if (body.action === "status") {
      return await handleStatus(admin, apiKey, body as StatusBody);
    }
    return jsonResponse(400, { success: false, error: "unknown_action" });
  } catch (err) {
    console.error("[nano-studio] unexpected error:", err instanceof Error ? err.message : err);
    return jsonResponse(500, {
      success: false,
      error: err instanceof Error ? err.message : "unknown_error",
    });
  }
});

async function handleGenerate(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  body: GenerateBody,
): Promise<Response> {
  if (!body.tenant_id) return jsonResponse(400, { success: false, error: "tenant_id_required" });
  if (!body.prompt || !body.prompt.trim())
    return jsonResponse(400, { success: false, error: "prompt_required" });

  const mode = body.mode ?? "text";
  if (mode !== "text" && mode !== "image")
    return jsonResponse(400, { success: false, error: "invalid_mode" });
  if (mode === "image" && !body.image_url)
    return jsonResponse(400, { success: false, error: "image_url_required_for_image_mode" });

  const model = body.model ?? "nano-banana-pro";
  const resolution = body.resolution ?? "2K";
  const aspect_ratio = body.aspect_ratio ?? "4:5";
  const num_images = body.num_images ?? 1;
  const requestedFormat = body.output_format ?? "jpeg";
  let output_format = requestedFormat;
  if (output_format !== "png" && output_format !== "jpeg") {
    console.warn(
      `[nano-studio] invalid output_format "${requestedFormat}", falling back to jpeg`,
    );
    output_format = "jpeg";
  }

  const upstreamPayload: Record<string, unknown> = {
    prompt: body.prompt,
    model,
    mode,
    aspect_ratio,
    resolution,
    num_images,
    output_format,
  };
  if (mode === "image") upstreamPayload.image_url = body.image_url;

  const res = await fetch(`${IMGEDITOR_BASE}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamPayload),
  });

  const raw = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    const mapped = mapUpstreamError(res.status, parsed);
    console.error("[nano-studio] generate upstream failed", {
      status: res.status,
      error: mapped.error,
    });
    return jsonResponse(mapped.status, { success: false, error: mapped.error });
  }

  const task_id =
    (parsed.task_id as string | undefined) ??
    (parsed.id as string | undefined) ??
    ((parsed.data as { task_id?: string } | undefined)?.task_id);
  if (!task_id) {
    console.error("[nano-studio] no task_id in upstream response");
    return jsonResponse(502, { success: false, error: "no_task_id_from_upstream" });
  }

  const credits_used =
    (parsed.credits_used as number | undefined) ??
    ((parsed.data as { credits_used?: number } | undefined)?.credits_used) ??
    null;
  const credits_remaining =
    (parsed.credits_remaining as number | undefined) ??
    ((parsed.data as { credits_remaining?: number } | undefined)?.credits_remaining) ??
    null;

  const { data: job, error: insertError } = await admin
    .from("nano_image_jobs")
    .insert({
      tenant_id: body.tenant_id,
      task_id,
      status: "pending",
      prompt: body.prompt,
      model,
      mode,
      source_image_url: body.image_url ?? null,
      aspect_ratio,
      resolution,
      output_format,
      credits_used,
      source_product_id: body.source_product_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !job) {
    console.error("[nano-studio] failed to insert job:", insertError?.message);
    return jsonResponse(500, { success: false, error: "job_insert_failed" });
  }

  return jsonResponse(200, {
    success: true,
    job_id: job.id,
    task_id,
    credits_used,
    credits_remaining,
  });
}

async function handleStatus(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  body: StatusBody,
): Promise<Response> {
  if (!body.job_id) return jsonResponse(400, { success: false, error: "job_id_required" });

  const { data: job, error: jobError } = await admin
    .from("nano_image_jobs")
    .select("*")
    .eq("id", body.job_id)
    .single();
  if (jobError || !job) {
    return jsonResponse(404, { success: false, error: "job_not_found" });
  }

  if (job.status === "completed") {
    return jsonResponse(200, {
      success: true,
      status: "completed",
      result_url: job.result_url,
      storage_path: job.storage_path,
    });
  }
  if (job.status === "failed") {
    return jsonResponse(200, {
      success: false,
      status: "failed",
      error: job.error_message,
    });
  }

  const statusRes = await fetch(
    `${IMGEDITOR_BASE}/status?task_id=${encodeURIComponent(job.task_id)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const statusRaw = await statusRes.text();
  let statusJson: Record<string, unknown> = {};
  try {
    statusJson = statusRaw ? JSON.parse(statusRaw) : {};
  } catch {
    statusJson = {};
  }

  if (!statusRes.ok) {
    const mapped = mapUpstreamError(statusRes.status, statusJson);
    console.error("[nano-studio] status upstream failed", {
      status: statusRes.status,
      error: mapped.error,
    });
    return jsonResponse(mapped.status, { success: false, error: mapped.error });
  }

  const data = (statusJson.data as Record<string, unknown> | undefined) ?? statusJson;
  const upstreamStatus = String(
    (data.status as string | undefined) ?? (statusJson.status as string | undefined) ?? "pending",
  ).toLowerCase();
  const progress =
    (data.progress as number | undefined) ??
    (statusJson.progress as number | undefined) ??
    null;

  const isDone =
    upstreamStatus === "completed" ||
    upstreamStatus === "success" ||
    upstreamStatus === "succeeded" ||
    upstreamStatus === "done";
  const isFailed =
    upstreamStatus === "failed" ||
    upstreamStatus === "error" ||
    upstreamStatus === "cancelled";

  if (!isDone && !isFailed) {
    return jsonResponse(200, { success: true, status: "pending", progress });
  }

  if (isFailed) {
    const errMsg =
      (data.error as string | undefined) ??
      (statusJson.error as string | undefined) ??
      "generation_failed";
    await admin
      .from("nano_image_jobs")
      .update({ status: "failed", error_message: errMsg, completed_at: new Date().toISOString() })
      .eq("id", job.id);
    return jsonResponse(200, { success: false, status: "failed", error: errMsg });
  }

  // Done: pak eerste image_url en pas dán bijwerken als download + upload lukt.
  const images =
    (data.images as Array<{ image_url?: string; url?: string }> | undefined) ??
    (statusJson.images as Array<{ image_url?: string; url?: string }> | undefined) ??
    [];
  const firstImageUrl =
    images[0]?.image_url ??
    images[0]?.url ??
    (data.image_url as string | undefined) ??
    (statusJson.image_url as string | undefined);

  if (!firstImageUrl) {
    console.error("[nano-studio] completed but no image url in upstream response");
    return jsonResponse(502, { success: false, error: "no_image_url_from_upstream" });
  }

  const dlRes = await fetch(firstImageUrl);
  if (!dlRes.ok) {
    console.error("[nano-studio] download failed", { status: dlRes.status });
    return jsonResponse(502, { success: false, error: "image_download_failed" });
  }
  const imgBuf = new Uint8Array(await dlRes.arrayBuffer());

  const storagePath = `${job.tenant_id}/nano/${job.id}.png`;
  const { error: upErr } = await admin.storage
    .from("ai-images")
    .upload(storagePath, imgBuf, { contentType: "image/png", upsert: true });
  if (upErr) {
    console.error("[nano-studio] storage upload failed:", upErr.message);
    return jsonResponse(502, { success: false, error: "storage_upload_failed" });
  }

  const { data: publicUrlData } = admin.storage.from("ai-images").getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  const { error: updateError } = await admin
    .from("nano_image_jobs")
    .update({
      status: "completed",
      result_url: publicUrl,
      storage_path: storagePath,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (updateError) {
    console.error("[nano-studio] job update failed:", updateError.message);
    return jsonResponse(500, { success: false, error: "job_update_failed" });
  }

  const enhancementType = job.mode === "image" ? "enhance" : "generate";
  const { error: aiInsertError } = await admin.from("ai_generated_images").insert({
    tenant_id: job.tenant_id,
    prompt: job.prompt,
    image_url: publicUrl,
    storage_path: storagePath,
    source_image_url: job.source_image_url,
    source_product_id: job.source_product_id,
    credits_used: job.credits_used ?? 0,
    enhancement_type: enhancementType,
    style: "nano_studio",
  });
  if (aiInsertError) {
    // Non-fataal: job is klaar en bestand staat in storage. Loggen en doorgaan.
    console.error(
      "[nano-studio] ai_generated_images insert failed (job stays completed):",
      aiInsertError.message,
      { job_id: job.id, enhancement_type: enhancementType },
    );
  }

  return jsonResponse(200, {
    success: true,
    status: "completed",
    result_url: publicUrl,
    storage_path: storagePath,
    ai_image_logged: !aiInsertError,
  });
}