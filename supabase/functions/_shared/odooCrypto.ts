// AES-GCM encryption for Odoo API keys. Ciphertext format: "base64(iv).base64(ct+tag)".
// Key is provided as base64 in the ODOO_CREDENTIALS_KEY env secret (32 bytes / 256-bit).

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function loadKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('ODOO_CREDENTIALS_KEY');
  if (!raw) throw new Error('ODOO_CREDENTIALS_KEY is not configured');
  // Accept base64 (preferred) or raw text. Normalize to 32 bytes via SHA-256 if not 32 bytes decoded.
  let keyBytes: Uint8Array;
  try {
    const decoded = b64decode(raw);
    keyBytes = decoded.length === 32 ? decoded : new Uint8Array(await crypto.subtle.digest('SHA-256', decoded));
  } catch {
    keyBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  }
  return await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptOdooKey(plaintext: string): Promise<string> {
  const key = await loadKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
  return `${b64encode(iv)}.${b64encode(ct)}`;
}

export async function decryptOdooKey(ciphertext: string): Promise<string> {
  const parts = ciphertext.split('.');
  if (parts.length !== 2) throw new Error('Invalid ciphertext format');
  const iv = b64decode(parts[0]);
  const ct = b64decode(parts[1]);
  const key = await loadKey();
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  return new TextDecoder().decode(pt);
}