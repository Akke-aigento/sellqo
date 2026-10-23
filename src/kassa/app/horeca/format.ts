// TAFEL-1 — kleine weergavehulpjes voor de kassa.
export function formatEuro(cents: number, lang = 'nl'): string {
  const locale = lang === 'en' ? 'en-BE' : lang === 'fr' ? 'fr-BE' : lang === 'de' ? 'de-BE' : lang === 'uk' ? 'uk-UA' : 'nl-BE';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Hele minuten sinds een tijdstip (nooit negatief). */
export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
