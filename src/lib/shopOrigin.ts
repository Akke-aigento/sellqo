// Adres van de standaardshop van een winkel (ook voor het themaschema). Verhuisd uit StorefrontCustomize (UREN-1b).
export function shopOrigin(slug: string): string {
  // ?shop=http://localhost:4321 voor lokaal testen van de standaardshop.
  try {
    const o = new URLSearchParams(window.location.search).get('shop');
    if (o && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
  } catch { /* ignore */ }
  return `https://${slug}.sellqo.shop`;
}
