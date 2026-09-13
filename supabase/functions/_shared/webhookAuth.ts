// WEBHOOK-SIG-1 — de Deno-kant van webhookSignature.ts: secret uit de omgeving
// halen en bij twijfel weigeren. Een ontbrekend secret is een weigering, geen
// doorlaten: een webhook zonder controle is precies het gat dat hier dicht gaat.

import { verifyMetaSignature, verifySvixSignature } from "./webhookSignature.ts";

function reject(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Invalid signature" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** `null` als de svix-handtekening klopt, anders de 401 om terug te geven. */
export async function rejectUnlessSvix(
  req: Request,
  rawBody: string,
  secretEnvName: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const secret = Deno.env.get(secretEnvName) ?? "";
  if (!secret) {
    console.error(`[webhookAuth] ${secretEnvName} is niet ingesteld — aanroep geweigerd`);
    return reject(corsHeaders);
  }
  const ok = await verifySvixSignature(
    secret,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    rawBody,
  );
  return ok ? null : reject(corsHeaders);
}

/** `null` als de Meta-handtekening klopt, anders de 401. Eerste gevonden secret wint. */
export async function rejectUnlessMeta(
  req: Request,
  rawBody: string,
  secretEnvNames: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const secret = secretEnvNames.map((n) => Deno.env.get(n) ?? "").find((v) => v) ?? "";
  if (!secret) {
    console.error(`[webhookAuth] geen van ${secretEnvNames.join(", ")} is ingesteld — aanroep geweigerd`);
    return reject(corsHeaders);
  }
  const ok = await verifyMetaSignature(secret, req.headers.get("x-hub-signature-256"), rawBody);
  return ok ? null : reject(corsHeaders);
}
