// KAART-1 — de startkaart voor cafés en bars: klassiekers om aan te vinken.
//
// Productnamen zijn namen van dranken, geen vertaalbare UI-tekst; categorienamen wel (i18n-key).
// Geen prijzen: die verschillen per zaak, de uitbater vult ze zelf in.
// Btw-soort per categorie (Belgische regels, zoals in de horeca gebruikelijk; de zaak laat dit
// nakijken door haar boekhouder):
//   alcohol — 21 % ter plaatse en bij meenemen
//   soft    — 21 % ter plaatse, 6 % bij meenemen (niet-alcoholische dranken)
//   food    — 12 % ter plaatse, 6 % bij meenemen
export type VatKind = 'alcohol' | 'soft' | 'food';

export interface StarterGroup {
  /** i18n-key onder admin.kaart.starter.cat.* — ook de naam van de categorie die we aanmaken. */
  key: string;
  vat: VatKind;
  /** Basis: standaard aangevinkt in de startkaart. */
  basic: string[];
  /** Meer keuze: zichtbaar onder "Meer tonen". */
  more?: string[];
}

export const STARTER_GROUPS: StarterGroup[] = [
  {
    key: 'tap', vat: 'alcohol',
    basic: ['Pils 25cl', 'Pils 33cl', 'Pils 50cl'],
    more: ['Pitcher pils 1,5L', 'Witbier van het vat', 'Tripel van het vat'],
  },
  {
    key: 'beer', vat: 'alcohol',
    basic: ['Duvel', 'Westmalle Tripel', 'Westmalle Dubbel', 'La Chouffe', 'Leffe Blond', 'Leffe Bruin', 'Hoegaarden', 'Kriek', 'Karmeliet Tripel', 'Orval'],
    more: [
      // Trappisten
      'Achel Blond', 'Chimay Blauw', 'Chimay Rood', 'Chimay Tripel', 'Rochefort 6', 'Rochefort 8', 'Rochefort 10', 'Westvleteren 12', 'La Trappe Quadrupel',
      // Abdij- en tripels
      'Affligem Blond', 'Affligem Dubbel', 'Affligem Tripel', 'Grimbergen Blond', 'Grimbergen Dubbel', 'Maredsous 6', 'Maredsous 8', 'Maredsous 10',
      'Leffe Tripel', 'St. Bernardus 8', 'St. Bernardus 12', 'St. Bernardus Tripel', 'Tongerlo Blond', 'Tongerlo Prior', 'Straffe Hendrik Tripel', 'Straffe Hendrik Quadrupel',
      'Gouden Carolus Classic', 'Gouden Carolus Tripel', 'Gouden Carolus Hopsinjoor', 'Brugse Zot Blond', 'Brugse Zot Dubbel', 'Tripel d\'Anvers', 'Kasteel Tripel', 'Kasteel Donker',
      // Blond en speciaal
      'Duvel Tripel Hop', 'Delirium Tremens', 'Delirium Red', 'Kwak', 'Palm', 'De Koninck', 'Omer', 'Brugse Zot', 'Lupulus', 'Piraat', 'Gulden Draak', 'Bourgogne des Flandres', 'Barbãr', 'Cornet', 'Vedett Extra Blond', 'Vedett IPA', 'La Chouffe IPA', 'Houblon Chouffe',
      // Wit en fruit
      'Hoegaarden Rosée', 'Vedett Extra White', 'Lindemans Kriek', 'Lindemans Framboise', 'Lindemans Pêcheresse', 'Liefmans Fruitesse', 'Timmermans Kriek', 'Mort Subite Kriek', 'Kasteel Rouge',
      // Zuur en geuze
      'Oude Geuze Boon', 'Oude Kriek Boon', '3 Fonteinen Oude Geuze', 'Oud Beersel Oude Geuze', 'Rodenbach', 'Rodenbach Grand Cru', 'Duchesse de Bourgogne', 'Petrus Aged Pale', 'Liefmans Goudenband', 'Cantillon Gueuze',
      // Saison
      'Saison Dupont', 'St-Feuillien Saison',
    ],
  },
  {
    key: 'nonalc_beer', vat: 'soft',
    basic: ['Jupiler 0,0', 'Leffe Blond 0,0'],
    more: ['Sportzot', 'La Chouffe 0,0', 'Karmeliet 0,0', 'Brugse Zot 0,0', 'Stella Artois 0,0', 'Hoegaarden 0,0', 'Liefmans 0,0'],
  },
  {
    key: 'soft', vat: 'soft',
    basic: ['Coca-Cola', 'Coca-Cola Zero', 'Fanta', 'Sprite', 'Spa plat', 'Spa bruis', 'Ice Tea', 'Appelsiensap', 'Tonic'],
    more: ['Bitter Lemon', 'Ginger Ale', 'Appelsap', 'Cécémel', 'Red Bull', 'Spa rood/blauw 1L', 'Limonade'],
  },
  {
    key: 'hot', vat: 'soft',
    basic: ['Koffie', 'Espresso', 'Cappuccino', 'Latte macchiato', 'Thee', 'Warme chocomelk'],
    more: ['Dubbele espresso', 'Deca', 'Koffie verkeerd', 'Verse muntthee', 'Irish coffee'],
  },
  {
    key: 'wine', vat: 'alcohol',
    basic: ['Wijn wit (glas)', 'Wijn rood (glas)', 'Rosé (glas)', 'Cava (glas)'],
    more: ['Wijn wit (fles)', 'Wijn rood (fles)', 'Rosé (fles)', 'Cava (fles)', 'Champagne (fles)', 'Porto', 'Martini'],
  },
  {
    key: 'spirits', vat: 'alcohol',
    basic: ['Jenever', 'Gin-tonic', 'Whisky', 'Rum-cola', 'Vodka-fris'],
    more: ['Aperol Spritz', 'Cognac', 'Amaretto', 'Baileys', 'Limoncello', 'Jägermeister', 'Tequila shot', 'Mojito', 'Pastis'],
  },
  {
    key: 'snacks', vat: 'food',
    basic: ['Chips', 'Nootjes', 'Kaasblokjes', 'Salami'],
    more: ['Bittergarnituur', 'Gemengde portie kaas en salami', 'Olijven', 'Croque monsieur', 'Toast kaas-hesp', 'Soep van de dag', 'Spaghetti bolognese'],
  },
];

/** Btw-tarieven (in %) per soort: [ter plaatse, meenemen]. */
export const VAT_BY_KIND: Record<VatKind, [number, number]> = {
  alcohol: [21, 21],
  soft: [21, 6],
  food: [12, 6],
};

// Woordgrenzen: "Shots" is geen "hot", "Steaks" geen "tea", "Waterzooi" geen "water".
// Eten wordt eerst getest ("Warme gerechten" is eten), "warm/hot" telt enkel samen met drank.
// Unicode-woordgrenzen (\b kent in JS enkel ASCII: "Thé" en Cyrillisch vielen er anders door).
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, 'iu');
const FOOD = word("snacks?|eten|food|hapjes?|knabbel\\p{L}*|tapas|soep\\p{L}*|soups?|pasta'?s?|pizza'?s?|burgers?|friet\\p{L}*|frites|desserts?|nagerecht\\p{L}*|salades?|salads?|croques?|toast\\p{L}*|spaghetti|lunch|diner|dinner|\\p{L}*gerecht\\p{L}*|plats?|brood\\p{L}*|sandwich\\p{L}*|ontbijt|breakfast|ijs|gebak|cake|wafels?|pannenkoek\\p{L}*|kebab|grill\\p{L}*|vis|vlees|veggie|vegetarisch|steaks?|hotdogs?|kaas\\p{L}*|cheese|charcuterie|bitterbal\\p{L}*|waterzooi|stoofvlees|stoemp|mosselen|entrées?|desserts?|закуск\\p{L}*|страв\\p{L}*|їжа|десерт\\p{L}*|суп\\p{L}*|speisen|vorspeisen|hauptgerichte|essen");
const SOFT = word("fris\\p{L}*|softs?|soft drinks?|koffie\\p{L}*|coffee|caf[eé]s?|thee|teas?|thés?|infusions?|tisanes?|waters?|eaux?|sap|sappen|sapjes|juices?|jus|limonades?|mocktails?|alcoholvrij\\p{L}*|alcohol-?free|non-?alcoholic|sans alcool|alkoholfrei\\p{L}*|warme dranken?|hot drinks?|boissons chaudes|heißgetränke|kaffee|tee|безалког\\p{L}*|кав\\p{L}*|ча[йї]\\p{L}*|сік|соки|вода|0[.,]0");

/** Btw-soort raden uit een categorienaam (de gebruiker ziet en wijzigt dit in het voorbeeld). */
export function guessVatKind(categoryName: string): VatKind {
  if (FOOD.test(categoryName)) return 'food';
  if (SOFT.test(categoryName)) return 'soft';
  return 'alcohol';
}
