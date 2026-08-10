// SHIP-GEO-1 — landen en regio-presets voor verzendmethodes.
// Eén bron van waarheid voor admin-UI en storefront-checkout.

export interface CountryOption {
  code: string;
  name: string;
}

export const EU_COUNTRIES: CountryOption[] = [
  { code: "AT", name: "Oostenrijk" },
  { code: "BE", name: "België" },
  { code: "BG", name: "Bulgarije" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Tsjechië" },
  { code: "DE", name: "Duitsland" },
  { code: "DK", name: "Denemarken" },
  { code: "EE", name: "Estland" },
  { code: "ES", name: "Spanje" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "Frankrijk" },
  { code: "GR", name: "Griekenland" },
  { code: "HR", name: "Kroatië" },
  { code: "HU", name: "Hongarije" },
  { code: "IE", name: "Ierland" },
  { code: "IT", name: "Italië" },
  { code: "LT", name: "Litouwen" },
  { code: "LU", name: "Luxemburg" },
  { code: "LV", name: "Letland" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Nederland" },
  { code: "PL", name: "Polen" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Roemenië" },
  { code: "SE", name: "Zweden" },
  { code: "SI", name: "Slovenië" },
  { code: "SK", name: "Slowakije" },
];

export const EUROPE_NON_EU_COUNTRIES: CountryOption[] = [
  { code: "CH", name: "Zwitserland" },
  { code: "GB", name: "Verenigd Koninkrijk" },
  { code: "IS", name: "IJsland" },
  { code: "NO", name: "Noorwegen" },
];

export const WORLDWIDE_COUNTRIES: CountryOption[] = [
  { code: "AE", name: "Verenigde Arabische Emiraten" },
  { code: "AU", name: "Australië" },
  { code: "BR", name: "Brazilië" },
  { code: "CA", name: "Canada" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hongkong" },
  { code: "IL", name: "Israël" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "MA", name: "Marokko" },
  { code: "MX", name: "Mexico" },
  { code: "NZ", name: "Nieuw-Zeeland" },
  { code: "SG", name: "Singapore" },
  { code: "TR", name: "Turkije" },
  { code: "US", name: "Verenigde Staten" },
  { code: "ZA", name: "Zuid-Afrika" },
];

export const ALL_SHIPPING_COUNTRIES: CountryOption[] = [
  ...EU_COUNTRIES,
  ...EUROPE_NON_EU_COUNTRIES,
  ...WORLDWIDE_COUNTRIES,
].sort((a, b) => a.name.localeCompare(b.name, "nl"));

export const BENELUX_CODES = ["BE", "NL", "LU"];
export const EU_CODES = EU_COUNTRIES.map((c) => c.code);
export const EUROPE_NON_EU_CODES = EUROPE_NON_EU_COUNTRIES.map((c) => c.code);

export const REGION_PRESETS: { key: string; label: string; codes: string[] }[] = [
  { key: "eu", label: "EU (27)", codes: EU_CODES },
  { key: "benelux", label: "Benelux", codes: BENELUX_CODES },
  { key: "europe_non_eu", label: "Europa niet-EU", codes: EUROPE_NON_EU_CODES },
];

export function countryName(code: string): string {
  return ALL_SHIPPING_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code.toUpperCase();
}

/** Korte samenvatting van een landenselectie voor lijstweergaves. */
export function summarizeCountries(codes: string[] | null | undefined): string {
  if (!codes || codes.length === 0) return "Alle landen";
  const set = new Set(codes.map((c) => c.toUpperCase()));
  for (const preset of REGION_PRESETS) {
    if (preset.codes.length === set.size && preset.codes.every((c) => set.has(c))) {
      return preset.label;
    }
  }
  if (set.size <= 3) return [...set].map(countryName).join(", ");
  return `${set.size} landen`;
}
