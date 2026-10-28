/**
 * WEBPUSH-1 — Web Push zonder npm `web-push` (pure WebCrypto, draait in Deno).
 *
 * Port van de werkende implementatie in Nomadix Watchtower
 * (src/lib/webpush.server.ts):
 * - payload-encryptie: RFC 8291 (aes128gcm, één record)
 * - afzender-authenticatie: RFC 8292 (VAPID, ES256-JWT)
 *
 * De publieke VAPID-sleutel is publiek (staat ook in src/lib/webPush.ts).
 * De private sleutel staat als JWK in public.internal_config onder
 * `vapid_private_jwk` (RLS aan, geen policies → alleen de service role), nooit
 * in de repo of in een migratie: de repo is publiek.
 */

export const VAPID_PUBLIC_KEY =
  "BCPFT36NUbP7t_OwATpVwFWz-QVgMKr9hzPiaAOf3eyqUiR2lEeIoXR2L3jD3JVyhMIbtGUtTISdwXlxFDbmn9A";
const VAPID_SUBJECT = "mailto:info@sellqo.app";

export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string };
export type WebPushPayload = { title: string; body: string; url?: string; tag?: string };
export type WebPushResult = { endpoint: string; status: number; gone: boolean; error?: string };

const enc = new TextEncoder();

export function b64uToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(b: Uint8Array): string {
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// BufferSource-cast: zelfde TS 5.7-lib-kwestie als in send-push-notification.
const buf = (b: Uint8Array) => b as unknown as BufferSource;

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** RFC 8291: versleutel `plaintext` voor dit abonnement. */
export async function encryptPayload(
  sub: Pick<WebPushSubscription, "p256dh" | "auth">,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const uaPublic = b64uToBytes(sub.p256dh);
  const authSecret = b64uToBytes(sub.auth);

  const ephemeral = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", buf(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, ephemeral.privateKey, 256),
  );

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const record = concat(plaintext, new Uint8Array([2])); // 0x02 = laatste record, geen padding
  const aesKey = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, aesKey, buf(record)),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

/** RFC 8292: VAPID-JWT voor de push-dienst van dit endpoint. */
export async function vapidAuthorization(endpoint: string, privateJwk: JsonWebKey): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64u(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })),
  );
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${payload}`)),
  );
  return `vapid t=${header}.${payload}.${bytesToB64u(sig)}, k=${VAPID_PUBLIC_KEY}`;
}

/** RFC 8030 Topic: maximaal 32 tekens uit het base64url-alfabet. Apple eist bovendien een geldige
 *  base64url-lengte (17 tekens geeft 400 BadWebPushTopic). Daarom: vaste 32 hex-tekens uit SHA-256
 *  van de tag. Dezelfde tag geeft altijd hetzelfde topic, dus samenvoegen blijft werken. */
export async function webPushTopic(tag: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(tag)));
  return Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Eén melding naar één web-abonnement. Gooit nooit; fouten zitten in het resultaat. */
export async function sendWebPush(
  sub: WebPushSubscription,
  payload: WebPushPayload,
  privateJwk: JsonWebKey,
  /** Hoelang de pushdienst het bericht bewaart als het toestel offline is (standaard een dag). */
  ttlSeconds = 86400,
): Promise<WebPushResult> {
  try {
    const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        authorization: await vapidAuthorization(sub.endpoint, privateJwk),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: String(ttlSeconds),
        urgency: "high",
        ...(payload.tag ? { topic: await webPushTopic(payload.tag) } : {}),
      },
      body: buf(body),
    });
    const gone = res.status === 404 || res.status === 410;
    const ok = res.status >= 200 && res.status < 300;
    return {
      endpoint: sub.endpoint,
      status: res.status,
      gone,
      error: ok ? undefined : (await res.text()).slice(0, 300),
    };
  } catch (e) {
    return { endpoint: sub.endpoint, status: 0, gone: false, error: e instanceof Error ? e.message : String(e) };
  }
}
