// SOCIAL-1 — welke app-credentials gebruikt een social OAuth-flow?
//
// Volgorde:
//   1. De eigen app van de tenant (tenant_oauth_credentials) — bestaand gedrag, blijft voorrang hebben.
//   2. De SellQo-platformapp uit de secrets, maar ENKEL voor tenants die daarvoor
//      vrijgegeven zijn. Zolang de Meta-app in Development mode staat (geen App Review),
//      kunnen enkel accounts met een rol op die app inloggen. Een willekeurige tenant
//      zou dan op een foutmelding van Meta landen; daarom expliciet vrijgeven:
//        SOCIAL_PLATFORM_APP_TENANT_IDS = komma-gescheiden tenant-id's
//        SOCIAL_PLATFORM_APP_PUBLIC     = "true" zodra de app publiek goedgekeurd is
//
// Secrets (Supabase → Edge Functions → Secrets), nooit in code of chat:
//   META_APP_ID / META_APP_SECRET            Facebook Login (facebook, whatsapp)
//   INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET  Instagram Login (instagram); te vinden bij
//                                            het product "Instagram" in dezelfde Meta-app

import type { SocialDbClient } from "./socialPublish.ts";

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  source: "tenant" | "platform";
}

function platformAppAllowed(tenantId: string): boolean {
  if (Deno.env.get("SOCIAL_PLATFORM_APP_PUBLIC") === "true") return true;
  const list = (Deno.env.get("SOCIAL_PLATFORM_APP_TENANT_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(tenantId);
}

function platformEnv(credentialPlatform: string): { id?: string; secret?: string } {
  if (credentialPlatform === "facebook") {
    return { id: Deno.env.get("META_APP_ID"), secret: Deno.env.get("META_APP_SECRET") };
  }
  if (credentialPlatform === "instagram") {
    return { id: Deno.env.get("INSTAGRAM_APP_ID"), secret: Deno.env.get("INSTAGRAM_APP_SECRET") };
  }
  return {};
}

/** whatsapp gebruikt de Meta-app (facebook). */
export function credentialPlatformFor(platform: string): string {
  return platform === "whatsapp" ? "facebook" : platform;
}

export async function getOAuthCredentials(
  db: SocialDbClient,
  tenantId: string,
  platform: string,
): Promise<OAuthCredentials | null> {
  const credentialPlatform = credentialPlatformFor(platform);

  const { data } = await db
    .from("tenant_oauth_credentials")
    .select("client_id, client_secret")
    .eq("tenant_id", tenantId)
    .eq("platform", credentialPlatform)
    .eq("is_active", true)
    .maybeSingle();
  if (data?.client_id && data?.client_secret) {
    return { clientId: data.client_id, clientSecret: data.client_secret, source: "tenant" };
  }

  if (!platformAppAllowed(tenantId)) return null;
  const env = platformEnv(credentialPlatform);
  if (env.id && env.secret) {
    return { clientId: env.id, clientSecret: env.secret, source: "platform" };
  }
  return null;
}
