// KASSA-0 — de FDM-simulator als lokale HTTP-server op POST /graphql (FDM-09), zodat een
// kassa-toestel of een test er net als tegen een echte zwarte doos mee praat.
//
//   npx tsx scripts/gks/fdm-simulator-server.ts [--port 8780] [--fdm SIM01000001] [--pos CPOS0031234567,...]
//
// GEEN ECHTE HANDTEKENINGEN. Enkel voor ontwikkeling en tests; nooit op een kassa bij een klant.
import http from 'node:http';
import { FdmSimulator } from '../../src/kassa/fiscal/simulator/fdmSimulator';
import type { MessageCode } from '../../src/kassa/fiscal/types';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const port = Number(arg('port', '8780'));
const sim = new FdmSimulator({
  fdmId: arg('fdm', 'SIM01000001'),
  posAllowList: arg('pos', '').split(',').filter(Boolean),
});

const server = http.createServer(async (req, res) => {
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, fdmId: sim.fdmId, total: sim.counter('total') });
  // Testhaak: fout instellen (FDM_LOCKED, BUFFER_FULL, ...) of wissen met code=null.
  if (req.method === 'POST' && req.url?.startsWith('/_fault')) {
    const code = new URL(req.url, 'http://x').searchParams.get('code');
    sim.setFault(code && code !== 'null' ? (code as MessageCode) : null);
    return send(200, { fault: code });
  }
  if (req.method !== 'POST' || req.url !== '/graphql') return send(404, { errors: [{ message: 'POST /graphql' }] });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw);
    send(200, await sim.handleGraphQL(body));
  } catch (e) {
    send(400, { errors: [{ message: e instanceof Error ? e.message : String(e) }] });
  }
});
server.listen(port, () => console.log(`FDM-simulator ${sim.fdmId} luistert op http://localhost:${port}/graphql (geen echte handtekeningen)`));
