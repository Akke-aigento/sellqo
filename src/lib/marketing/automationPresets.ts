/**
 * MAIL-2a — standaardteksten en -instellingen van de vier vaste e-mailautomations.
 *
 * Gaat als `p_presets` naar de RPC automation_ensure_presets (migratie
 * 20261019230000_mail_2a_automations.sql §11). Die maakt enkel ONTBREKENDE presets aan,
 * uitgeschakeld; een bestaande preset (ook met aangepaste teksten) blijft ongemoeid.
 * Teksten hier wijzigen raakt dus enkel winkels die de preset nog niet hebben.
 *
 * De mailteksten zijn klantgericht en volgen de taal van de KLANT (nl/en/fr/de, zoals de
 * campagne-engine); ze staan daarom bewust niet in de i18n-bestanden van de admin.
 * Geen beloftes die de winkel niet waarmaakt (geen kortingen, geen levertermijnen).
 */
export type AutomationPresetKey = 'welcome_series' | 'post_purchase' | 'win_back' | 'abandoned_cart';
export type PresetLang = 'nl' | 'en' | 'fr' | 'de';

export const PRESET_LANGS: PresetLang[] = ['nl', 'en', 'fr', 'de'];
export const PRESET_KEYS: AutomationPresetKey[] = ['welcome_series', 'post_purchase', 'win_back', 'abandoned_cart'];

/** trigger_type per preset; moet overeenkomen met de aanroepen van schedule_automation_run_v2. */
export const PRESET_TRIGGER: Record<AutomationPresetKey, string> = {
  welcome_series: 'newsletter_confirmed',
  post_purchase: 'order_paid',
  win_back: 'customer_inactive',
  abandoned_cart: 'cart_abandoned',
};

/** Vaste sleutel per stap (step_order), voor labels in de admin. */
export const PRESET_STEP_KEYS: Record<AutomationPresetKey, Record<number, string>> = {
  welcome_series: { 1: 'welcome_1', 2: 'welcome_2' },
  post_purchase: { 1: 'thanks', 2: 'review' },
  win_back: { 1: 'win_back' },
  abandoned_cart: { 1: 'cart' },
};

export const DEFAULT_WIN_BACK_DAYS = 90;
export const DEFAULT_CART_DELAY_HOURS = 1;

interface MailText { subject: string; preview_text: string; html_content: string }
type Texts = Record<PresetLang, MailText>;

interface PresetStep {
  step_order: number;
  delay_hours: number;
  name: string;
  texts: Texts;
}

interface Preset {
  preset_key: AutomationPresetKey;
  name: string;
  description: string;
  trigger_config: Record<string, unknown>;
  max_runs_per_customer: number;
  cooldown_hours: number;
  steps: PresetStep[];
}

const p = (...lines: string[]) => lines.map((l) => `<p>${l}</p>`).join('\n');
const button = (href: string, label: string) => `<p><a href="${href}">${label}</a></p>`;

const PRESETS: Preset[] = [
  {
    preset_key: 'welcome_series',
    name: 'Welkomstreeks',
    description: 'Twee mails na het bevestigen van de nieuwsbrief.',
    trigger_config: {},
    max_runs_per_customer: 1,
    cooldown_hours: 0,
    steps: [
      {
        step_order: 1, delay_hours: 0, name: 'Welkomstreeks: welkom',
        texts: {
          nl: { subject: 'Welkom bij {{company_name}}', preview_text: 'Fijn dat je erbij bent.', html_content: p('Hallo {{customer_first_name}},', 'Bedankt voor je inschrijving. Vanaf nu hoor je als eerste van nieuwe producten en nieuws van {{company_name}}.') + button('{{shop_url}}', 'Bekijk de winkel') },
          en: { subject: 'Welcome to {{company_name}}', preview_text: 'Glad to have you with us.', html_content: p('Hi {{customer_first_name}},', 'Thank you for subscribing. From now on you will be the first to hear about new products and news from {{company_name}}.') + button('{{shop_url}}', 'Visit the shop') },
          fr: { subject: 'Bienvenue chez {{company_name}}', preview_text: 'Ravis de vous compter parmi nous.', html_content: p('Bonjour {{customer_first_name}},', 'Merci pour votre inscription. Vous serez désormais parmi les premiers informés des nouveautés et actualités de {{company_name}}.') + button('{{shop_url}}', 'Découvrir la boutique') },
          de: { subject: 'Willkommen bei {{company_name}}', preview_text: 'Schön, dass Sie dabei sind.', html_content: p('Hallo {{customer_first_name}},', 'vielen Dank für Ihre Anmeldung. Ab sofort erfahren Sie als Erste von neuen Produkten und Neuigkeiten von {{company_name}}.') + button('{{shop_url}}', 'Zum Shop') },
        },
      },
      {
        step_order: 2, delay_hours: 72, name: 'Welkomstreeks: tweede mail',
        texts: {
          nl: { subject: 'Even voorstellen: {{company_name}}', preview_text: 'Wat je bij ons vindt.', html_content: p('Hallo {{customer_first_name}},', 'Een paar dagen geleden schreef je je in. Benieuwd wat we in huis hebben? Neem gerust een kijkje in de winkel.', 'Heb je een vraag? Beantwoord deze mail gewoon.') + button('{{shop_url}}', 'Naar de winkel') },
          en: { subject: 'Get to know {{company_name}}', preview_text: 'What you will find with us.', html_content: p('Hi {{customer_first_name}},', 'You subscribed a few days ago. Curious about what we offer? Feel free to have a look in the shop.', 'Any questions? Simply reply to this email.') + button('{{shop_url}}', 'Go to the shop') },
          fr: { subject: 'Faisons connaissance : {{company_name}}', preview_text: 'Ce que vous trouverez chez nous.', html_content: p('Bonjour {{customer_first_name}},', 'Vous vous êtes inscrit il y a quelques jours. Curieux de découvrir notre offre ? N’hésitez pas à parcourir la boutique.', 'Une question ? Répondez simplement à cet e-mail.') + button('{{shop_url}}', 'Aller à la boutique') },
          de: { subject: 'Lernen Sie {{company_name}} kennen', preview_text: 'Was Sie bei uns finden.', html_content: p('Hallo {{customer_first_name}},', 'vor ein paar Tagen haben Sie sich angemeldet. Neugierig auf unser Angebot? Schauen Sie sich gern im Shop um.', 'Haben Sie eine Frage? Antworten Sie einfach auf diese E-Mail.') + button('{{shop_url}}', 'Zum Shop') },
        },
      },
    ],
  },
  {
    preset_key: 'post_purchase',
    name: 'Na aankoop',
    description: 'Bedankmail na een betaalde bestelling en later een reviewvraag.',
    trigger_config: {},
    max_runs_per_customer: 0,
    cooldown_hours: 0,
    steps: [
      {
        step_order: 1, delay_hours: 24, name: 'Na aankoop: bedankt',
        texts: {
          nl: { subject: 'Bedankt voor je bestelling', preview_text: 'Bestelling {{order_number}}', html_content: p('Hallo {{customer_first_name}},', 'Bedankt voor je bestelling {{order_number}} bij {{company_name}}. We hopen dat je er veel plezier aan hebt.', 'Heb je een vraag over je bestelling? Beantwoord deze mail gewoon.') },
          en: { subject: 'Thank you for your order', preview_text: 'Order {{order_number}}', html_content: p('Hi {{customer_first_name}},', 'Thank you for your order {{order_number}} at {{company_name}}. We hope you enjoy it.', 'Any questions about your order? Simply reply to this email.') },
          fr: { subject: 'Merci pour votre commande', preview_text: 'Commande {{order_number}}', html_content: p('Bonjour {{customer_first_name}},', 'Merci pour votre commande {{order_number}} chez {{company_name}}. Nous espérons qu’elle vous plaira.', 'Une question sur votre commande ? Répondez simplement à cet e-mail.') },
          de: { subject: 'Vielen Dank für Ihre Bestellung', preview_text: 'Bestellung {{order_number}}', html_content: p('Hallo {{customer_first_name}},', 'vielen Dank für Ihre Bestellung {{order_number}} bei {{company_name}}. Wir hoffen, sie gefällt Ihnen.', 'Haben Sie eine Frage zu Ihrer Bestellung? Antworten Sie einfach auf diese E-Mail.') },
        },
      },
      {
        step_order: 2, delay_hours: 336, name: 'Na aankoop: reviewvraag',
        texts: {
          nl: { subject: 'Hoe bevalt je bestelling?', preview_text: 'Je mening helpt ons en andere klanten.', html_content: p('Hallo {{customer_first_name}},', 'Een tijdje geleden bestelde je bij {{company_name}}. We horen graag wat je ervan vindt. Een korte review helpt ons en andere klanten.') + button('{{review_url}}', 'Laat een review achter') },
          en: { subject: 'How are you finding your order?', preview_text: 'Your opinion helps us and other customers.', html_content: p('Hi {{customer_first_name}},', 'A while ago you ordered from {{company_name}}. We would love to hear what you think. A short review helps us and other customers.') + button('{{review_url}}', 'Leave a review') },
          fr: { subject: 'Votre commande vous plaît-elle ?', preview_text: 'Votre avis nous aide, ainsi que les autres clients.', html_content: p('Bonjour {{customer_first_name}},', 'Vous avez commandé chez {{company_name}} il y a quelque temps. Votre avis nous intéresse. Un court avis nous aide, ainsi que les autres clients.') + button('{{review_url}}', 'Laisser un avis') },
          de: { subject: 'Wie gefällt Ihnen Ihre Bestellung?', preview_text: 'Ihre Meinung hilft uns und anderen Kunden.', html_content: p('Hallo {{customer_first_name}},', 'vor einiger Zeit haben Sie bei {{company_name}} bestellt. Wir würden gern wissen, wie es Ihnen gefällt. Eine kurze Bewertung hilft uns und anderen Kunden.') + button('{{review_url}}', 'Bewertung abgeben') },
        },
      },
    ],
  },
  {
    preset_key: 'win_back',
    name: 'Win-back',
    description: 'Eén mail naar klanten die al een tijd niets bestelden.',
    trigger_config: { days: DEFAULT_WIN_BACK_DAYS },
    max_runs_per_customer: 0,
    cooldown_hours: 180 * 24,
    steps: [
      {
        step_order: 1, delay_hours: 0, name: 'Win-back',
        texts: {
          nl: { subject: 'We hebben je gemist', preview_text: 'Kijk wat er nieuw is bij {{company_name}}.', html_content: p('Hallo {{customer_first_name}},', 'Het is een tijdje geleden dat je bij {{company_name}} bestelde. Benieuwd wat er intussen nieuw is? Neem gerust een kijkje.') + button('{{shop_url}}', 'Naar de winkel') },
          en: { subject: 'We have missed you', preview_text: 'See what is new at {{company_name}}.', html_content: p('Hi {{customer_first_name}},', 'It has been a while since you ordered from {{company_name}}. Curious about what is new? Feel free to have a look.') + button('{{shop_url}}', 'Go to the shop') },
          fr: { subject: 'Vous nous avez manqué', preview_text: 'Découvrez les nouveautés de {{company_name}}.', html_content: p('Bonjour {{customer_first_name}},', 'Votre dernière commande chez {{company_name}} date d’il y a un moment. Envie de voir les nouveautés ? N’hésitez pas à jeter un œil.') + button('{{shop_url}}', 'Aller à la boutique') },
          de: { subject: 'Wir haben Sie vermisst', preview_text: 'Sehen Sie, was es Neues bei {{company_name}} gibt.', html_content: p('Hallo {{customer_first_name}},', 'Ihre letzte Bestellung bei {{company_name}} ist schon eine Weile her. Neugierig, was es Neues gibt? Schauen Sie gern vorbei.') + button('{{shop_url}}', 'Zum Shop') },
        },
      },
    ],
  },
  {
    preset_key: 'abandoned_cart',
    name: 'Verlaten winkelwagen',
    description: 'Eén herinnering als iemand bij het afrekenen afhaakte.',
    trigger_config: {},
    max_runs_per_customer: 0,
    cooldown_hours: 0,
    steps: [
      {
        step_order: 1, delay_hours: DEFAULT_CART_DELAY_HOURS, name: 'Verlaten winkelwagen: herinnering',
        texts: {
          nl: { subject: 'Je winkelwagen staat nog klaar', preview_text: 'Rond je bestelling af wanneer het je past.', html_content: p('Hallo {{customer_first_name}},', 'Je liet nog producten achter in je winkelwagen bij {{company_name}}. Ze staan voor je klaar, zolang de voorraad strekt.') + button('{{cart_url}}', 'Naar je winkelwagen') },
          en: { subject: 'Your cart is still waiting', preview_text: 'Complete your order whenever it suits you.', html_content: p('Hi {{customer_first_name}},', 'You left some products in your cart at {{company_name}}. They are waiting for you, while stock lasts.') + button('{{cart_url}}', 'Go to your cart') },
          fr: { subject: 'Votre panier vous attend', preview_text: 'Finalisez votre commande quand cela vous convient.', html_content: p('Bonjour {{customer_first_name}},', 'Vous avez laissé des produits dans votre panier chez {{company_name}}. Ils vous attendent, dans la limite des stocks disponibles.') + button('{{cart_url}}', 'Voir mon panier') },
          de: { subject: 'Ihr Warenkorb wartet noch', preview_text: 'Schließen Sie Ihre Bestellung ab, wann es Ihnen passt.', html_content: p('Hallo {{customer_first_name}},', 'Sie haben noch Produkte in Ihrem Warenkorb bei {{company_name}}. Sie liegen für Sie bereit, solange der Vorrat reicht.') + button('{{cart_url}}', 'Zum Warenkorb') },
        },
      },
    ],
  },
];

/** Payload voor automation_ensure_presets: NL in de hoofdvelden, andere talen in translations. */
export function buildAutomationPresetsPayload(keys: AutomationPresetKey[] = PRESET_KEYS) {
  return PRESETS.filter((preset) => keys.includes(preset.preset_key)).map((preset) => ({
    preset_key: preset.preset_key,
    name: preset.name,
    description: preset.description,
    trigger_type: PRESET_TRIGGER[preset.preset_key],
    trigger_config: preset.trigger_config,
    max_runs_per_customer: preset.max_runs_per_customer,
    cooldown_hours: preset.cooldown_hours,
    steps: preset.steps.map((s) => ({
      step_order: s.step_order,
      delay_hours: s.delay_hours,
      name: s.name,
      subject: s.texts.nl.subject,
      preview_text: s.texts.nl.preview_text,
      html_content: s.texts.nl.html_content,
      translations: Object.fromEntries(PRESET_LANGS.filter((l) => l !== 'nl').map((l) => [l, s.texts[l]])),
      available_languages: PRESET_LANGS,
    })),
  }));
}
