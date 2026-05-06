export class WebhookVerifyError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerifyError";
    this.status = 403;
  }
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

export async function verifyMetaSignature(
  req: Request,
  rawBody: string,
  appSecret: string
): Promise<boolean> {
  const signature = req.headers.get("x-hub-signature-256");
  if (!signature) {
    throw new WebhookVerifyError("Missing X-Hub-Signature-256 header");
  }
  const expectedHash = await hmacSha256(appSecret, rawBody);
  const expected = `sha256=${expectedHash}`;
  if (!timingSafeEqual(signature, expected)) {
    throw new WebhookVerifyError("Invalid Meta webhook signature");
  }
  return true;
}

export async function verifySendcloudSignature(
  req: Request,
  rawBody: string,
  secret: string
): Promise<boolean> {
  const signature = req.headers.get("x-sendcloud-signature");
  if (!signature) {
    throw new WebhookVerifyError("Missing X-Sendcloud-Signature header");
  }
  const expectedHash = await hmacSha256(secret, rawBody);
  if (!timingSafeEqual(signature, expectedHash)) {
    throw new WebhookVerifyError("Invalid SendCloud webhook signature");
  }
  return true;
}

export async function verifyResendSignature(
  req: Request,
  rawBody: string,
  secret: string
): Promise<boolean> {
  const msgId = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signatures = req.headers.get("svix-signature");
  if (!msgId || !timestamp || !signatures) {
    throw new WebhookVerifyError("Missing Svix webhook headers");
  }
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    throw new WebhookVerifyError("Webhook timestamp too old");
  }
  const secretBytes = Uint8Array.from(
    atob(secret.startsWith("whsec_") ? secret.slice(6) : secret),
    (c) => c.charCodeAt(0)
  );
  const toSign = `${msgId}.${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw", secretBytes,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(toSign)
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const expected = `v1,${computed}`;
  const sigList = signatures.split(" ");
  const isValid = sigList.some((s) => timingSafeEqual(s, expected));
  if (!isValid) {
    throw new WebhookVerifyError("Invalid Resend/Svix webhook signature");
  }
  return true;
}

export async function verifyGenericHmac(
  req: Request,
  rawBody: string,
  secret: string,
  headerName: string,
  prefix: string = ""
): Promise<boolean> {
  const signature = req.headers.get(headerName);
  if (!signature) {
    throw new WebhookVerifyError(`Missing ${headerName} header`);
  }
  const hash = await hmacSha256(secret, rawBody);
  const expected = `${prefix}${hash}`;
  if (!timingSafeEqual(signature, expected)) {
    throw new WebhookVerifyError(`Invalid ${headerName} signature`);
  }
  return true;
}