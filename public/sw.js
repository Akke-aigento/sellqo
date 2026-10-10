/*
 * WEBPUSH-1 — SellQo service worker: alleen pushmeldingen, GEEN caching.
 *
 * De admin draait altijd live van het netwerk; dit bestand onderschept geen
 * enkele fetch. Hij wordt pas geregistreerd wanneer een gebruiker in de admin
 * (Instellingen → Mijn meldingen) zelf web-meldingen aanzet, en nooit binnen
 * de native app (Capacitor). Winkelbezoekers krijgen hem dus niet.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "SellQo", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "SellQo";
  const options = {
    body: data.body || "",
    icon: "/web-app-manifest-192x192.png",
    badge: "/web-app-manifest-192x192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/admin" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/admin";
  // Alleen paden binnen dezelfde origin; nooit een volledige externe URL volgen.
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : new URL("/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch (e) {
              await self.clients.openWindow(url);
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
