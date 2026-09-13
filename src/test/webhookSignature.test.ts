import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature, verifySvixSignature } from '../../supabase/functions/_shared/webhookSignature.ts';

// WEBHOOK-SIG-1: de verwachte handtekening wordt hier onafhankelijk berekend met
// node:crypto, zodat de test niet de eigen implementatie met zichzelf vergelijkt.

const SECRET_B64 = Buffer.from('een-geheime-sleutel-voor-de-test').toString('base64');
const SECRET = `whsec_${SECRET_B64}`;
const ID = 'msg_test123';
const NOW = 1_789_300_000;
const BODY = '{"type":"email.received","data":{"email_id":"abc"}}';

function svixSig(body: string, ts: number, id = ID) {
  return createHmac('sha256', Buffer.from(SECRET_B64, 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
}

describe('verifySvixSignature', () => {
  it('accepteert een geldige handtekening', async () => {
    const headers = { id: ID, timestamp: String(NOW), signature: `v1,${svixSig(BODY, NOW)}` };
    expect(await verifySvixSignature(SECRET, headers, BODY, NOW)).toBe(true);
  });

  it('accepteert als één van meerdere handtekeningen klopt (secret-rotatie)', async () => {
    const headers = { id: ID, timestamp: String(NOW), signature: `v1,Zm91dA== v1,${svixSig(BODY, NOW)}` };
    expect(await verifySvixSignature(SECRET, headers, BODY, NOW)).toBe(true);
  });

  it('weigert een aangepaste body', async () => {
    const headers = { id: ID, timestamp: String(NOW), signature: `v1,${svixSig(BODY, NOW)}` };
    expect(await verifySvixSignature(SECRET, headers, BODY.replace('abc', 'xyz'), NOW)).toBe(false);
  });

  it('weigert een oude aanroep (replay buiten 5 minuten)', async () => {
    const old = NOW - 301;
    const headers = { id: ID, timestamp: String(old), signature: `v1,${svixSig(BODY, old)}` };
    expect(await verifySvixSignature(SECRET, headers, BODY, NOW)).toBe(false);
  });

  it('weigert zonder headers of zonder secret', async () => {
    expect(await verifySvixSignature(SECRET, { id: null, timestamp: null, signature: null }, BODY, NOW)).toBe(false);
    const headers = { id: ID, timestamp: String(NOW), signature: `v1,${svixSig(BODY, NOW)}` };
    expect(await verifySvixSignature('', headers, BODY, NOW)).toBe(false);
  });
});

describe('verifyMetaSignature', () => {
  const APP_SECRET = 'meta-app-secret-test';
  const sig = (body: string) => `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;

  it('accepteert een geldige handtekening', async () => {
    expect(await verifyMetaSignature(APP_SECRET, sig(BODY), BODY)).toBe(true);
  });

  it('weigert een aangepaste body, een verkeerd secret of geen header', async () => {
    expect(await verifyMetaSignature(APP_SECRET, sig(BODY), `${BODY} `)).toBe(false);
    expect(await verifyMetaSignature('ander-secret', sig(BODY), BODY)).toBe(false);
    expect(await verifyMetaSignature(APP_SECRET, null, BODY)).toBe(false);
  });
});
