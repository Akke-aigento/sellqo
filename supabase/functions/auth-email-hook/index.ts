// Supabase Send-Email Hook → custom Resend route (Stream A, no-reply@sellqo.app).
// Verifies the Standard-Webhooks signature using SUPABASE_AUTH_HOOK_SECRET,
// renders a SellQo-branded HTML+text email, and sends via Resend.

import { Resend } from "https://esm.sh/resend@2.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { PUBLIC_CORS_HEADERS as corsHeaders } from "../_shared/cors.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import {
  renderAuthEmail,
  type AuthEmailAction,
} from "../_shared/email-templates/index.ts";

interface HookPayload {
  user: { email?: string; new_email?: string; id?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailAction;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function json(body: unknown, status = 200) {
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
    return json({ error: "Method not allowed" }, 405);
  }

  const hookSecret = Deno.env.get("SUPABASE_AUTH_HOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!hookSecret) return json({ error: "SUPABASE_AUTH_HOOK_SECRET missing" }, 500);
  if (!resendKey) return json({ error: "RESEND_API_KEY missing" }, 500);

  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  let payload: HookPayload;
  try {
    // Standard Webhooks: accepts the raw `whsec_...` secret string.
    const secret = hookSecret.startsWith("v1,")
      ? hookSecret.slice(3)
      : hookSecret;
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, headers) as HookPayload;
  } catch (err) {
    console.error("auth-email-hook: signature verification failed", err);
    return json({ error: "Invalid signature" }, 401);
  }

  const { user, email_data } = payload;
  const recipient = user?.email;
  if (!recipient) return json({ error: "Missing recipient" }, 400);

  const action = email_data.email_action_type;
  const siteUrl = email_data.site_url?.replace(/\/$/, "") ||
    "https://sellqo.app";

  // Supabase' verify-URL: /auth/v1/verify?token=...&type=...&redirect_to=...
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || siteUrl;
  const confirmationUrl =
    `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify` +
    `?token=${encodeURIComponent(email_data.token_hash)}` +
    `&type=${encodeURIComponent(action)}` +
    `&redirect_to=${encodeURIComponent(email_data.redirect_to || siteUrl)}`;

  const rendered = renderAuthEmail(action, {
    confirmationUrl,
    token: email_data.token,
    siteUrl,
    email: recipient,
    newEmail: user.new_email,
  });

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: EMAIL_SENDERS.noReply.from,
      to: [recipient],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (error) {
      console.error("auth-email-hook: resend send error", error);
      return json({ error: "Email send failed", details: error }, 502);
    }
  } catch (err) {
    console.error("auth-email-hook: resend exception", err);
    return json({ error: "Email send exception" }, 500);
  }

  return json({ ok: true });
});