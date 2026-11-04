// UREN-1 — weekdagnamen in de UI-taal (0 = zondag). 1 november 2026 is een zondag.
export function dayName(lang: string, d: string | number, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(lang, { weekday: style }).format(new Date(2026, 10, 1 + Number(d)));
}

/** "24 dec." of "24 dec. – 26 dec." in de UI-taal. */
export function closureLabel(lang: string, from: string, to: string): string {
  const f = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: from.slice(0, 4) !== to.slice(0, 4) ? 'numeric' : undefined });
  return from === to ? new Date(`${from}T12:00:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }) : `${f(from)} – ${f(to)}`;
}
