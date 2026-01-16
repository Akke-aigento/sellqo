// EU VAT rates as of 2025/2026
// Source: European Commission VAT rates database

export interface VatRate {
  code: string;
  name: string;
  standardRate: number;
  reducedRate: number | null;
}

export const EU_VAT_RATES: VatRate[] = [
  { code: 'AT', name: 'Oostenrijk', standardRate: 20, reducedRate: 10 },
  { code: 'BE', name: 'België', standardRate: 21, reducedRate: 6 },
  { code: 'BG', name: 'Bulgarije', standardRate: 20, reducedRate: 9 },
  { code: 'HR', name: 'Kroatië', standardRate: 25, reducedRate: 13 },
  { code: 'CY', name: 'Cyprus', standardRate: 19, reducedRate: 5 },
  { code: 'CZ', name: 'Tsjechië', standardRate: 21, reducedRate: 12 },
  { code: 'DK', name: 'Denemarken', standardRate: 25, reducedRate: null },
  { code: 'EE', name: 'Estland', standardRate: 22, reducedRate: 9 },
  { code: 'FI', name: 'Finland', standardRate: 25.5, reducedRate: 14 },
  { code: 'FR', name: 'Frankrijk', standardRate: 20, reducedRate: 5.5 },
  { code: 'DE', name: 'Duitsland', standardRate: 19, reducedRate: 7 },
  { code: 'GR', name: 'Griekenland', standardRate: 24, reducedRate: 13 },
  { code: 'HU', name: 'Hongarije', standardRate: 27, reducedRate: 5 },
  { code: 'IE', name: 'Ierland', standardRate: 23, reducedRate: 13.5 },
  { code: 'IT', name: 'Italië', standardRate: 22, reducedRate: 10 },
  { code: 'LV', name: 'Letland', standardRate: 21, reducedRate: 12 },
  { code: 'LT', name: 'Litouwen', standardRate: 21, reducedRate: 9 },
  { code: 'LU', name: 'Luxemburg', standardRate: 17, reducedRate: 8 },
  { code: 'MT', name: 'Malta', standardRate: 18, reducedRate: 5 },
  { code: 'NL', name: 'Nederland', standardRate: 21, reducedRate: 9 },
  { code: 'PL', name: 'Polen', standardRate: 23, reducedRate: 8 },
  { code: 'PT', name: 'Portugal', standardRate: 23, reducedRate: 13 },
  { code: 'RO', name: 'Roemenië', standardRate: 19, reducedRate: 9 },
  { code: 'SK', name: 'Slowakije', standardRate: 23, reducedRate: 10 },
  { code: 'SI', name: 'Slovenië', standardRate: 22, reducedRate: 9.5 },
  { code: 'ES', name: 'Spanje', standardRate: 21, reducedRate: 10 },
  { code: 'SE', name: 'Zweden', standardRate: 25, reducedRate: 12 },
];

export const EU_COUNTRIES = EU_VAT_RATES.map(r => r.code);

export function getVatRate(countryCode: string): VatRate | undefined {
  return EU_VAT_RATES.find(r => r.code === countryCode);
}

export function getStandardVatRate(countryCode: string): number {
  const rate = getVatRate(countryCode);
  return rate?.standardRate ?? 21;
}
