// WEBHOOK-SIG-1 — handtekeningen van inkomende webhooks controleren.
//
// Puur: geen Deno, geen imports. Web Crypto bestaat in Deno én in Node, dus
// src/test/webhookSignature.test.ts laadt dit bestand rechtstreeks.
//
// Waarom dit bestaat: tot 13 sep 2026 controleerden shipping-webhook,
// meta-messaging-webhook, whatsapp-webhook, process-email-webhook en
// handle-inbound-email niet wie ze aanriep — terwijl de role-audit twee keer
// "provider-signature verificatie" beweerde. Iedereen kon een nep-e-mail in de
// inbox van een winkel zetten.

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Vergelijkt zonder vroegtijdig af te breken, zodat de looptijd niets verraadt. */
function constantTimeEquals(a: string, b: string): boolean {
  let mismatch = a.length !== b.length ? 1 : 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  // Cast nodig: TS 5.7+ typt Uint8Array als Uint8Array<ArrayBufferLike>, maar
  // Web Crypto's importKey vereist BufferSource (ArrayBufferView<ArrayBuffer>).
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

/**
 * Svix-handtekening, zoals Resend die meestuurt (`svix-id`, `svix-timestamp`,
 * `svix-signature`). Getekend wordt `${id}.${timestamp}.${ruwe body}` met het
 * base64-deel van het secret (na `whsec_`). De header kan meerdere
 * handtekeningen bevatten (`v1,<b64> v1,<b64>`), bij het roteren van een secret.
 *
 * Het tijdvenster (standaard 5 minuten) houdt een onderschepte, geldige
 * aanroep tegen die later opnieuw wordt afgespeeld.
 */
export async function verifySvixSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  let key: Uint8Array;
  try {
    key = fromBase64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }

  const expected = toBase64(await hmacSha256(key, `${id}.${timestamp}.${rawBody}`));
  return signature
    .split(" ")
    .map((part) => part.split(",", 2))
    .some(([version, value]) => version === "v1" && !!value && constantTimeEquals(value, expected));
}

/**
 * Meta-handtekening (`X-Hub-Signature-256: sha256=<hex>`): HMAC-SHA256 over de
 * ruwe body met het App Secret. Geldt voor Messenger, Instagram en WhatsApp
 * Cloud API.
 */
export async function verifyMetaSignature(
  appSecret: string,
  header: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const expected = toHex(await hmacSha256(encoder.encode(appSecret), rawBody));
  return constantTimeEquals(header.slice("sha256=".length).toLowerCase(), expected);
}
