// PRINT-1 — Star CloudPRNT-server, pure logica (geen Supabase, geen netwerk). De edge function
// `cloudprnt` geeft er een store aan; de tests (cloudprnt.test.ts) een geheugenstore.
//
// Protocol: Star CloudPRNT Protocol Guide (HTTP-versie), geraadpleegd op 23-10-2026:
//   https://star-m.jp/products/s_print/sdk/StarCloudPRNT/manual/en/protocol-reference/http-method-reference/index.html
//   - POST (poll): JSON met o.a. statusCode ("200%20OK"), printerMAC, jobToken, printingInProgress.
//     Antwoord: { jobReady, mediaTypes, jobToken? }. jobReady=true => de printer doet een GET.
//   - GET (job): ?mac=&type=<mediatype>&token=<jobToken>. Antwoord 200 met de data in het
//     gevraagde Content-Type; 404 = geen data; 415 = mediatype niet beschikbaar. Optionele
//     headers voor text/plain: X-Star-Cut (full/partial/none).
//   - DELETE (bevestiging): ?mac=&code=<statuscode>&token=. code begint met "2" (bv. "200 OK")
//     = afgedrukt; anders een foutcode (bv. "511 Media Decoding Error", "520"). Servers die
//     geen DELETE doorlaten: de printer stuurt een GET met de extra parameter "delete".
//   Bevestiging zonder token (oudere firmware): geldt voor de job die nu aan het printen is.
//
// Authenticatie (eigen keuze, het protocol schrijft niets voor): elk verzoek draagt het geheime
// printer-token, als wachtwoord in Basic auth (CloudPRNT-instelling "Authentication"), als
// Bearer, of als query-parameter `key` in de server-URL. We vergelijken SHA-256(token) met
// printers.token_hash. Geen token of onbekend token = 401, zonder te verraden welke.
//
// Wat hier NIET gebeurt (PRINT-1): StarPRNT-bytes. Star-printers krijgen text/plain, dus geen
// QR; queue.ts stuurt daarom geen kasticket naar een Star-printer (PRT-03).

export const CLOUDPRNT_VERSION = 'PRINT-1';

export interface CpPrinter { id: string; tenant_id: string; protocol: string; is_active: boolean }
export interface CpJob { id: string; printer_id: string; status: 'queued' | 'printing' | 'printed' | 'failed'; payload_text: string; payload_escpos: string | null }

export interface CloudPrntStore {
  printerByTokenHash(hash: string): Promise<CpPrinter | null>;
  touchPrinter(printerId: string, info: { mac: string | null; status: string | null }): Promise<void>;
  /** Oudste job met status queued of printing voor deze printer. */
  nextJob(printerId: string): Promise<CpJob | null>;
  jobById(printerId: string, jobId: string): Promise<CpJob | null>;
  /** queued -> printing (attempts + 1, claimed_at). */
  markPrinting(job: CpJob): Promise<void>;
  /** printing -> printed of failed. */
  markDone(job: CpJob, ok: boolean, error: string | null): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Printer-token uit Basic-auth (wachtwoord), Bearer of ?key=. */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const basic = /^Basic\s+(.+)$/i.exec(auth);
  if (basic) {
    try {
      const dec = atob(basic[1].trim());
      const i = dec.indexOf(':');
      const pw = i >= 0 ? dec.slice(i + 1) : dec;
      if (pw) return pw;
    } catch { /* ongeldig base64 = geen token */ }
  }
  const bearer = /^Bearer\s+(\S+)$/i.exec(auth);
  if (bearer) return bearer[1];
  const key = new URL(req.url).searchParams.get('key');
  return key && key.length >= 16 ? key : null;
}

/** Welke mediatypes deze job kan leveren. Star krijgt in PRINT-1 enkel tekst. */
export function mediaTypesFor(job: CpJob, printer: CpPrinter): string[] {
  if (printer.protocol !== 'star_cloudprnt') return [];
  return job.payload_text ? ['text/plain'] : [];
}

/** "200 OK", "200%20OK", "OK" = gelukt; al de rest = fout. */
export function isSuccessCode(code: string | null): boolean {
  if (!code) return false;
  const c = decodeURIComponent(code.replace(/\+/g, ' ')).trim();
  return /^2\d\d(\s|$)/.test(c) || /^ok$/i.test(c);
}

function unauthorized(): Response {
  return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="SellQo CloudPRNT"' } });
}
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function clip(s: unknown, n: number): string | null {
  return typeof s === 'string' && s ? s.slice(0, n) : null;
}

export async function handleCloudPrnt(req: Request, store: CloudPrntStore): Promise<Response> {
  const url = new URL(req.url);
  // Neveneffectvrije versiestempel om een deploy te bewijzen.
  if (req.method === 'GET' && url.searchParams.has('health')) return json(200, { version: CLOUDPRNT_VERSION });

  const token = extractToken(req);
  if (!token) return unauthorized();
  const printer = await store.printerByTokenHash(await sha256Hex(token));
  if (!printer || !printer.is_active || printer.protocol !== 'star_cloudprnt') return unauthorized();

  if (req.method === 'POST') {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { return json(400, { error: 'JSON verwacht' }); }
    const status = clip(body.statusCode, 200);
    await store.touchPrinter(printer.id, { mac: clip(body.printerMAC, 64), status: status ? decodeURIComponent(status) : null });
    const job = await store.nextJob(printer.id);
    const types = job ? mediaTypesFor(job, printer) : [];
    if (!job || !types.length) return json(200, { jobReady: false });
    return json(200, { jobReady: true, mediaTypes: types, jobToken: job.id });
  }

  const jobToken = url.searchParams.get('token');
  const findJob = async (): Promise<CpJob | null> => {
    if (jobToken) return UUID.test(jobToken) ? store.jobById(printer.id, jobToken) : null;
    return store.nextJob(printer.id);
  };

  const isConfirm = req.method === 'DELETE' || (req.method === 'GET' && url.searchParams.has('delete'));
  if (isConfirm) {
    const job = await findJob();
    // Een bevestiging voor een onbekende of al afgehandelde job: 200, zodat de printer verder pollt.
    if (!job || job.status === 'printed' || job.status === 'failed') return new Response(null, { status: 200 });
    const code = url.searchParams.get('code');
    const ok = isSuccessCode(code);
    if (job.status === 'queued') await store.markPrinting(job); // printer bevestigt zonder GET
    await store.markDone(job, ok, ok ? null : (clip(code, 500) ?? 'onbekende fout'));
    return new Response(null, { status: 200 });
  }

  if (req.method === 'GET') {
    const job = await findJob();
    if (!job || (job.status !== 'queued' && job.status !== 'printing')) return new Response(null, { status: 404 });
    const types = mediaTypesFor(job, printer);
    const wanted = (url.searchParams.get('type') ?? types[0] ?? '').split(';')[0].trim();
    if (!types.includes(wanted)) return new Response(null, { status: 415 });
    if (job.status === 'queued') await store.markPrinting(job);
    return new Response(job.payload_text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Star-Cut': 'partial; feed=true' },
    });
  }

  return new Response(null, { status: 405 });
}
