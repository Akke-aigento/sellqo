// SEC-DOMAIN-2 — server-stub die de handler bewaart, zodat een test de echte
// serve()-handler van een functie (bv. storefront-resolve) kan aanroepen.
type Handler = (req: Request) => Response | Promise<Response>;
export function serve(h: Handler): void { (globalThis as unknown as { __serveHandler?: Handler }).__serveHandler = h; }
