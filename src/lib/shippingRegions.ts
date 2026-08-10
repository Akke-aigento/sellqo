// SHIP-GEO-1 — landen en regio-presets voor verzendmethodes.
// Eén bron van waarheid voor admin-UI en storefront-checkout.
// SHIP-GEO-3 — volledige ISO 3166-1 alpha-2 dekking (incl. Oekraïne, Servië, Kosovo, ...).

export interface CountryOption {
  code: string;
  name: string;
}

export const EU_COUNTRIES: CountryOption[] = [
  { code: "BE", name: "België" },
  { code: "BG", name: "Bulgarije" },
  { code: "CY", name: "Cyprus" },
  { code: "DK", name: "Denemarken" },
  { code: "DE", name: "Duitsland" },
  { code: "EE", name: "Estland" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "Frankrijk" },
  { code: "GR", name: "Griekenland" },
  { code: "HU", name: "Hongarije" },
  { code: "IE", name: "Ierland" },
  { code: "IT", name: "Italië" },
  { code: "HR", name: "Kroatië" },
  { code: "LV", name: "Letland" },
  { code: "LT", name: "Litouwen" },
  { code: "LU", name: "Luxemburg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Nederland" },
  { code: "AT", name: "Oostenrijk" },
  { code: "PL", name: "Polen" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Roemenië" },
  { code: "SI", name: "Slovenië" },
  { code: "SK", name: "Slowakije" },
  { code: "ES", name: "Spanje" },
  { code: "CZ", name: "Tsjechië" },
  { code: "SE", name: "Zweden" },
];

/** Europa buiten de EU (incl. Oekraïne, Westelijke Balkan, VK, Zwitserland, Turkije). */
export const EUROPE_NON_EU_COUNTRIES: CountryOption[] = [
  { code: "AL", name: "Albanië" },
  { code: "AD", name: "Andorra" },
  { code: "BY", name: "Belarus" },
  { code: "BA", name: "Bosnië en Herzegovina" },
  { code: "FO", name: "Faeröer" },
  { code: "GI", name: "Gibraltar" },
  { code: "GG", name: "Guernsey" },
  { code: "IS", name: "IJsland" },
  { code: "IM", name: "Isle of Man" },
  { code: "JE", name: "Jersey" },
  { code: "XK", name: "Kosovo" },
  { code: "LI", name: "Liechtenstein" },
  { code: "MD", name: "Moldavië" },
  { code: "MC", name: "Monaco" },
  { code: "ME", name: "Montenegro" },
  { code: "MK", name: "Noord-Macedonië" },
  { code: "NO", name: "Noorwegen" },
  { code: "UA", name: "Oekraïne" },
  { code: "RU", name: "Rusland" },
  { code: "SM", name: "San Marino" },
  { code: "RS", name: "Servië" },
  { code: "TR", name: "Turkije" },
  { code: "VA", name: "Vaticaanstad" },
  { code: "GB", name: "Verenigd Koninkrijk" },
  { code: "CH", name: "Zwitserland" },
];

/** Alle overige landen en gebieden wereldwijd. */
export const WORLDWIDE_COUNTRIES: CountryOption[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AX", name: "Åland" },
  { code: "DZ", name: "Algerije" },
  { code: "AS", name: "Amerikaans-Samoa" },
  { code: "VI", name: "Amerikaanse Maagdeneilanden" },
  { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" },
  { code: "AQ", name: "Antarctica" },
  { code: "AG", name: "Antigua en Barbuda" },
  { code: "AR", name: "Argentinië" },
  { code: "AM", name: "Armenië" },
  { code: "AW", name: "Aruba" },
  { code: "AU", name: "Australië" },
  { code: "AZ", name: "Azerbeidzjan" },
  { code: "BS", name: "Bahama’s" },
  { code: "BH", name: "Bahrein" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BW", name: "Botswana" },
  { code: "BV", name: "Bouveteiland" },
  { code: "BR", name: "Brazilië" },
  { code: "IO", name: "Brits Indische Oceaanterritorium" },
  { code: "VG", name: "Britse Maagdeneilanden" },
  { code: "BN", name: "Brunei" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "KH", name: "Cambodja" },
  { code: "CA", name: "Canada" },
  { code: "BQ", name: "Caribisch Nederland" },
  { code: "CF", name: "Centraal-Afrikaanse Republiek" },
  { code: "CL", name: "Chili" },
  { code: "CN", name: "China" },
  { code: "CX", name: "Christmaseiland" },
  { code: "CC", name: "Cocoseilanden" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoren" },
  { code: "CG", name: "Congo-Brazzaville" },
  { code: "CD", name: "Congo-Kinshasa" },
  { code: "CK", name: "Cookeilanden" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "CW", name: "Curaçao" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominicaanse Republiek" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypte" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatoriaal-Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopië" },
  { code: "FK", name: "Falklandeilanden" },
  { code: "FJ", name: "Fiji" },
  { code: "PH", name: "Filipijnen" },
  { code: "GF", name: "Frans-Guyana" },
  { code: "PF", name: "Frans-Polynesië" },
  { code: "TF", name: "Franse Gebieden in de zuidelijke Indische Oceaan" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgië" },
  { code: "GH", name: "Ghana" },
  { code: "GD", name: "Grenada" },
  { code: "GL", name: "Groenland" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinee" },
  { code: "GW", name: "Guinee-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haïti" },
  { code: "HM", name: "Heard en McDonaldeilanden" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hongkong SAR van China" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesië" },
  { code: "IQ", name: "Irak" },
  { code: "IR", name: "Iran" },
  { code: "IL", name: "Israël" },
  { code: "CI", name: "Ivoorkust" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "YE", name: "Jemen" },
  { code: "JO", name: "Jordanië" },
  { code: "KY", name: "Kaaimaneilanden" },
  { code: "CV", name: "Kaapverdië" },
  { code: "CM", name: "Kameroen" },
  { code: "KZ", name: "Kazachstan" },
  { code: "KE", name: "Kenia" },
  { code: "KG", name: "Kirgizië" },
  { code: "KI", name: "Kiribati" },
  { code: "UM", name: "Kleine afgelegen eilanden van de Verenigde Staten" },
  { code: "KW", name: "Koeweit" },
  { code: "LA", name: "Laos" },
  { code: "LS", name: "Lesotho" },
  { code: "LB", name: "Libanon" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libië" },
  { code: "MO", name: "Macau SAR van China" },
  { code: "MG", name: "Madagaskar" },
  { code: "MW", name: "Malawi" },
  { code: "MV", name: "Maldiven" },
  { code: "MY", name: "Maleisië" },
  { code: "ML", name: "Mali" },
  { code: "MA", name: "Marokko" },
  { code: "MH", name: "Marshalleilanden" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritanië" },
  { code: "MU", name: "Mauritius" },
  { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MN", name: "Mongolië" },
  { code: "MS", name: "Montserrat" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar (Birma)" },
  { code: "NA", name: "Namibië" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NI", name: "Nicaragua" },
  { code: "NC", name: "Nieuw-Caledonië" },
  { code: "NZ", name: "Nieuw-Zeeland" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NU", name: "Niue" },
  { code: "KP", name: "Noord-Korea" },
  { code: "MP", name: "Noordelijke Marianen" },
  { code: "NF", name: "Norfolk" },
  { code: "UG", name: "Oeganda" },
  { code: "UZ", name: "Oezbekistan" },
  { code: "OM", name: "Oman" },
  { code: "TL", name: "Oost-Timor" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestijnse gebieden" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papoea-Nieuw-Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PN", name: "Pitcairneilanden" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar" },
  { code: "RE", name: "Réunion" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts en Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent en de Grenadines" },
  { code: "BL", name: "Saint-Barthélemy" },
  { code: "MF", name: "Saint-Martin" },
  { code: "PM", name: "Saint-Pierre en Miquelon" },
  { code: "SB", name: "Salomonseilanden" },
  { code: "WS", name: "Samoa" },
  { code: "ST", name: "Sao Tomé en Principe" },
  { code: "SA", name: "Saoedi-Arabië" },
  { code: "SN", name: "Senegal" },
  { code: "SC", name: "Seychellen" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SH", name: "Sint-Helena" },
  { code: "SX", name: "Sint-Maarten" },
  { code: "SD", name: "Soedan" },
  { code: "SO", name: "Somalië" },
  { code: "SJ", name: "Spitsbergen en Jan Mayen" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SR", name: "Suriname" },
  { code: "SY", name: "Syrië" },
  { code: "TJ", name: "Tadzjikistan" },
  { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TG", name: "Togo" },
  { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad en Tobago" },
  { code: "TD", name: "Tsjaad" },
  { code: "TN", name: "Tunesië" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TC", name: "Turks- en Caicoseilanden" },
  { code: "TV", name: "Tuvalu" },
  { code: "UY", name: "Uruguay" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" },
  { code: "AE", name: "Verenigde Arabische Emiraten" },
  { code: "US", name: "Verenigde Staten" },
  { code: "VN", name: "Vietnam" },
  { code: "WF", name: "Wallis en Futuna" },
  { code: "EH", name: "Westelijke Sahara" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "ZA", name: "Zuid-Afrika" },
  { code: "GS", name: "Zuid-Georgia en Zuidelijke Sandwicheilanden" },
  { code: "KR", name: "Zuid-Korea" },
  { code: "SS", name: "Zuid-Soedan" },
];

export const ALL_SHIPPING_COUNTRIES: CountryOption[] = [
  ...EU_COUNTRIES,
  ...EUROPE_NON_EU_COUNTRIES,
  ...WORLDWIDE_COUNTRIES,
].sort((a, b) => a.name.localeCompare(b.name, "nl"));

export const BENELUX_CODES = ["BE", "NL", "LU"];
export const EU_CODES = EU_COUNTRIES.map((c) => c.code);
export const EUROPE_NON_EU_CODES = EUROPE_NON_EU_COUNTRIES.map((c) => c.code);
export const EUROPE_CODES = [...EU_CODES, ...EUROPE_NON_EU_CODES];
export const ALL_COUNTRY_CODES = ALL_SHIPPING_COUNTRIES.map((c) => c.code);

export const REGION_PRESETS: { key: string; label: string; codes: string[] }[] = [
  { key: "eu", label: "EU (27)", codes: EU_CODES },
  { key: "benelux", label: "Benelux", codes: BENELUX_CODES },
  { key: "europe_non_eu", label: "Europa niet-EU", codes: EUROPE_NON_EU_CODES },
  { key: "europe", label: "Heel Europa", codes: EUROPE_CODES },
  { key: "worldwide", label: "Wereldwijd", codes: ALL_COUNTRY_CODES },
];

export function countryName(code: string): string {
  return ALL_SHIPPING_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code.toUpperCase();
}

/**
 * SHIP-GEO-2 — landnaam in de actieve storefront-taal.
 * Valt terug op de Nederlandse naam wanneer Intl.DisplayNames niet beschikbaar is.
 */
export function localizedCountryName(code: string, locale?: string): string {
  const iso = code.toUpperCase();
  try {
    const dn = new Intl.DisplayNames([locale || "nl"], { type: "region" });
    return dn.of(iso) || countryName(iso);
  } catch {
    return countryName(iso);
  }
}

/** Landenopties (code + gelokaliseerde naam), gesorteerd volgens de actieve taal. */
export function localizedCountryOptions(codes: string[] | null | undefined, locale?: string): CountryOption[] {
  const source = codes && codes.length > 0
    ? codes.map((c) => c.toUpperCase())
    : ALL_SHIPPING_COUNTRIES.map((c) => c.code);
  const lang = locale || "nl";
  return source
    .map((code) => ({ code, name: localizedCountryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
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
