/**
 * Promptinstructies per vaste categorie van de Dagelijkse Menukaart.
 *
 * CONTRACT — dit is de andere helft van wat in
 * `src/config/contentMenuCategories.ts` staat.
 *
 * De frontend bezit de sleutels, de labels en de i18n; deze kant bezit de
 * instructie die de AI krijgt. Reden voor die splitsing: een Deno edge-functie
 * kan niet uit `src/` importeren en `src/` niet uit `supabase/functions/`.
 * Beide helften de instructies laten dragen zou twee waarheden opleveren die
 * gaan afdrijven.
 *
 * De `key`s hieronder MOETEN één-op-één matchen met `CONTENT_MENU_CATEGORIES`
 * in `src/config/contentMenuCategories.ts`. Dat is geen oogtest: er staat een
 * controle op in de post-flight verificatie van MENU-2. Voeg je hier een
 * categorie toe, voeg hem daar ook toe (en omgekeerd).
 *
 * Eigen categorieën van een tenant komen NIET hier vandaan — die dragen hun
 * eigen instructie in `tenant_content_categories.instructions`.
 */

export interface CategoryPrompt {
  key: string;
  /** Nederlandse werkinstructie voor het redactiemodel. */
  instruction: string;
  /**
   * De vrije categorie. Krijgt geen vaste opdracht maar een redactieplan: het
   * model kiest zelf onderwerp en invalshoek.
   */
  isFreeform?: boolean;
}

export const CATEGORY_PROMPTS: CategoryPrompt[] = [
  {
    key: "product_post",
    instruction:
      "Zet één concreet product uit het assortiment in de schijnwerpers. Noem waarom het nú relevant is " +
      "(seizoen, voorraad, nieuw binnen, actie) en eindig met een duidelijke call-to-action. Gebruik de " +
      "echte productnaam en prijs uit de meegeleverde productlijst; verzin geen producten of prijzen.",
  },
  {
    key: "educational",
    instruction:
      "Leg iets uit uit het vakgebied van dit merk waar de klant echt iets aan heeft: een misverstand " +
      "rechtzetten, een keuzehulp, of achtergrond die het product beter doet begrijpen. Verkoop niet — " +
      "de waarde zit in de uitleg. Hooguit een zachte verwijzing op het eind.",
  },
  {
    key: "lifestyle",
    instruction:
      "Toon het product of het merk in het dagelijks leven van de doelgroep. Sfeer boven specificaties: " +
      "schrijf een moment, geen opsomming van kenmerken. Laat de lezer zichzelf erin herkennen.",
  },
  {
    key: "behind_the_scenes",
    instruction:
      "Kijkje achter de schermen: hoe iets gemaakt of klaargezet wordt, wie het doet, wat er misgaat en " +
      "hoe dat opgelost wordt. Menselijk en eerlijk. Kleine imperfecties mogen — die maken het geloofwaardig.",
  },
  {
    key: "customer_story",
    instruction:
      "Een ervaring, review of casus van een klant. Heb je geen echte klantgegevens gekregen, schrijf dan " +
      "een herkenbaar scenario en maak in de tekst duidelijk dat het een voorbeeld is. VERZIN NOOIT een " +
      "citaat, naam of beoordeling en presenteer die als echt.",
  },
  {
    key: "tip_howto",
    instruction:
      "Eén concrete tip of een kort stappenplan dat de lezer meteen kan toepassen. Genummerde stappen of " +
      "korte regels. Praktisch, geen theorie.",
  },
  {
    key: "seasonal",
    instruction:
      "Haak aan bij het seizoen, een naderende feestdag of iets van vandaag — gebruik de meegeleverde " +
      "seizoens- en feestdagcontext. Maak de link met het merk natuurlijk; geforceerd inhaken werkt averechts.",
  },
  {
    key: "surprise_me",
    isFreeform: true,
    instruction:
      "Vrije kaart. Kies ZELF de invalshoek op basis van het merk-DNA en wat er op dit moment speelt: " +
      "een nieuw product, iets dat bijna uitverkocht is, een naderende feestdag, een bestseller of een " +
      "vast thema van het merk. Kies de hoek die vandaag het meeste oplevert en zet in `angle_reason` in " +
      "één zin waarom je juist deze koos. Vermijd een invalshoek die al door een andere kaart in dit menu " +
      "wordt gedekt.",
  },
];

/** Snelle lookup op key. */
export const CATEGORY_PROMPT_BY_KEY: Record<string, CategoryPrompt> =
  Object.fromEntries(CATEGORY_PROMPTS.map((c) => [c.key, c]));

/**
 * Sturing per formaat-nadruk. Dit is een zwaartepunt, geen dwang: het model mag
 * per kaart afwijken als een ander formaat duidelijk beter past.
 */
export const FORMAT_EMPHASIS_GUIDANCE: Record<string, string> = {
  mixed:
    "Geen voorkeur: kies per kaart het formaat dat het beste bij de inhoud past, en varieer over het menu.",
  short:
    "Voorkeur voor korte, snel leesbare teksten. Leun op 'post' en 'story'. Captions kort houden.",
  long:
    "Voorkeur voor uitgebreidere verhalen die ruimte krijgen. Leun op 'post' met een langere caption en op 'carousel'.",
  visual:
    "Voorkeur voor beeldgedreven kaarten: de foto draagt de boodschap, de tekst blijft kort. Leun op 'story' en 'reel'.",
  carousel:
    "Voorkeur voor kaarten die zich in stappen laten vertellen. Leun op 'carousel' met een duidelijke opbouw per kaartje.",
};

/** Toegestane kaartformaten. Wordt in de UI per formaat anders weergegeven. */
export const CARD_FORMATS = ["post", "reel", "story", "carousel"] as const;
export type CardFormat = (typeof CARD_FORMATS)[number];
