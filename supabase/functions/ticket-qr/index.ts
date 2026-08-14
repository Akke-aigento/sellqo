// TICKET-1 fase 4b — publieke QR-image endpoint.
//
// Levert een QR-afbeelding voor een ticket-token als binary image, zodat de
// bevestigingsmail met <img src="..."> kan werken. Mailclients (Gmail/Outlook/
// Apple Mail) blokkeren base64-inline afbeeldingen vaak; een gewone URL wordt
// wél gerenderd (Gmail proxied hem via googleusercontent).
//
// De QR bevat UITSLUITEND het token — geen persoonsgegevens. Dit endpoint doet
// geen database-lookup: het encodeert enkel de meegegeven string, dus er lekt
// niets. Fase 5 (check-in) valideert het token server-side.
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") || "").trim();
    const sizeRaw = parseInt(url.searchParams.get("size") || "220", 10);
    const size = Number.isFinite(sizeRaw) ? Math.min(Math.max(sizeRaw, 120), 600) : 220;

    if (!TOKEN_RE.test(token)) {
      return new Response("invalid token", { status: 400 });
    }

    const dataUrl = String(await qrcode(token, { size }));
    const commaIdx = dataUrl.indexOf(",");
    const meta = dataUrl.slice(5, dataUrl.indexOf(";"));
    const b64 = dataUrl.slice(commaIdx + 1);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": meta || "image/gif",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("[TICKET-QR] error", e instanceof Error ? e.message : String(e));
    return new Response("qr generation failed", { status: 500 });
  }
});
