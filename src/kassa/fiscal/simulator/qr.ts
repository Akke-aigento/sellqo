// KASSA-0 — verificationUrl-codering van de FDM (FDM-detailbeschrijving v1.4 §3.11/§3.12).
// Port van het bewezen Python-prototype (exact op alle officiële antwoorden met echte
// handtekening). BigInt volgt de onbegrensde, ondertekende rekenkunde van het origineel
// (C#: ~byte wordt een negatieve int).

const B = BigInt;

function charFor(bits: number): string {
  return String.fromCharCode(bits + (bits < 10 ? 48 : bits > 35 ? 61 : 55));
}

function maskFrom(sig: Uint8Array): bigint {
  const s0 = B(sig[0]);
  const s1 = B(sig[1]);
  let mask = s1;
  mask = (mask << 8n) + s0;
  mask = (mask << 8n) + ~s0;
  mask = (mask << 8n) + ~s1;
  mask = (mask << 8n) + s0;
  mask = (mask << 8n) + s1;
  return mask;
}

/** 19 tekens voor de QR (achter https://gs2.be/). fdmId = 3 letters + 8 cijfers. */
export function encodeVerification(fdmId: string, totalCounter: number, sig: Uint8Array): string {
  if (!/^[A-Z]{3}\d{8}$/.test(fdmId)) throw new Error(`fdmId ongeldig: ${fdmId}`);
  if (sig.length < 5) throw new Error('handtekening te kort');
  const mask = maskFrom(sig);
  const total = B(totalCounter);
  for (let modifier = 4; modifier > 0; modifier--) {
    const out: string[] = [];
    let bs = 0n;
    let ln = 0;
    let restart = false;
    for (let state = 0; state < 7 && !restart; state++) {
      if (state === 1) { bs = (bs << 2n) | B(modifier - 1); ln += 2; }
      else if (state === 2) {
        for (let i = 0; i < 5; i++) bs = (bs << 8n) | B(sig[i]);
        ln += 40;
        const undo = 4 * (4 - modifier);
        bs >>= B(undo);
        ln -= undo;
      } else if (state === 3) {
        const c1 = B(fdmId.charCodeAt(0) - 65);
        const c2 = B(fdmId.charCodeAt(1) - 65);
        const c3 = B(fdmId.charCodeAt(2) - 65);
        const ms = B(parseInt(fdmId.slice(3, 11), 10));
        const m41 = mask & ((1n << 41n) - 1n);
        const v = ((((((ms * 26n) + c3) * 26n) + c2) * 26n) + c1) ^ m41;
        bs = (bs << 41n) | v;
        ln += 41;
      } else if (state === 4) {
        const m30 = ~mask & ((1n << 30n) - 1n);
        bs = (bs << 30n) | (total ^ m30);
        ln += 30;
      } else if (state === 5) {
        if (ln !== 0) { const n = 6 - ln; bs <<= B(n); ln += n; }
      } else if (state === 6) {
        while (out.length < 19) out.push('0');
        return out.join('');
      }
      while (ln >= 6) {
        if (out.length >= 19) { restart = true; break; }
        let read = 6;
        let bits = Number((bs >> B(ln - read)) & 63n);
        if (bits === 0) read = 5;
        else if (bits === 1) { bits = 0; read = 5; }
        else if (bits === 62 || bits === 63) { bits = 1; read = 5; }
        out.push(charFor(bits));
        ln -= read;
        bs &= (1n << B(ln)) - 1n;
      }
    }
  }
  throw new Error('verificationUrl kon niet gecodeerd worden');
}

export interface DecodedVerification { signatureBits: number; signaturePrefixHex: string; fdmId: string; totalCounter: number }

export function decodeVerification(code: string): DecodedVerification | null {
  const vals: number[] = [];
  for (const ch of code) {
    let b = ch.charCodeAt(0);
    if (b >= 48 && b <= 57) b -= 48;
    else if (b >= 65 && b <= 90) b -= 55;
    else if (b >= 97 && b <= 122) b -= 61;
    else return null;
    vals.push(b);
  }
  let bs = 0n;
  let ln = 0;
  let state = 0;
  let i = 0;
  let sigbits = 40;
  const sb = [0, 0, 0, 0, 0];
  let mask = 0n;
  let fdm = '';
  let tc = 0;
  while (state <= 10) {
    if (i < vals.length) {
      const b = vals[i];
      bs &= (1n << B(ln)) - 1n;
      if (b === 0) { bs <<= 5n; ln += 5; }
      else if (b === 1) { bs = (bs << 5n) | 31n; ln += 5; }
      else { bs = (bs << 6n) | B(b); ln += 6; }
      i++;
    } else {
      i++;
      if (i > vals.length + 1) return null;
    }
    const take = (n: number) => Number((bs >> B(ln - n)) & ((1n << B(n)) - 1n));
    if (state === 0 && ln >= 2) { const m = take(2) + 1; sigbits -= 4 * (4 - m); ln -= 2; state++; }
    else if (state >= 1 && state <= 3 && ln >= 8) { sb[state - 1] = take(8); ln -= 8; state++; }
    else if (state === 4 && ln >= 4) { if (sigbits >= 28) { sb[3] |= take(4) << 4; ln -= 4; } state++; }
    else if (state === 5 && ln >= 4) { if (sigbits >= 32) { sb[3] |= take(4); ln -= 4; } state++; }
    else if (state === 6 && ln >= 4) { if (sigbits >= 36) { sb[4] |= take(4) << 4; ln -= 4; } state++; }
    else if (state === 7 && ln >= 4) { if (sigbits >= 40) { sb[4] |= take(4); ln -= 4; } state++; }
    else if (state === 8 && ln >= 41) {
      mask = maskFrom(Uint8Array.from(sb));
      const v = ((bs >> B(ln - 41)) & 0x1ffffffffffn) ^ (mask & ((1n << 41n) - 1n));
      fdm = String.fromCharCode(Number(v % 26n) + 65) + String.fromCharCode(Number((v / 26n) % 26n) + 65)
        + String.fromCharCode(Number((v / 676n) % 26n) + 65) + String(v / 17576n).padStart(8, '0');
      ln -= 41;
      state++;
    } else if (state === 9 && ln >= 30) {
      tc = Number(((bs >> B(ln - 30)) & 0x3fffffffn) ^ (~mask & ((1n << 30n) - 1n)));
      ln -= 30;
      state++;
    } else if (state === 10) {
      return {
        signatureBits: sigbits,
        signaturePrefixHex: sb.map((x) => x.toString(16).padStart(2, '0')).join(''),
        fdmId: fdm,
        totalCounter: tc,
      };
    }
  }
  return null;
}

export const VERIFICATION_BASE = 'https://gs2.be/';
