// I18N-EDITOR — teksten uit het themaschema (labels, uitleg, keuzes) in de UI-taal.
// Het schema (sellqo-storefront/src/theme/schema.json) blijft de enige bron en is
// Nederlands. Elke tekst krijgt een vaste key afgeleid van de Nederlandse tekst; staat
// die key in de vertalingen, dan toont de editor de vertaling, anders gewoon het origineel.
// Een nieuw veld in het schema werkt dus meteen (in het Nederlands) en wordt vertaald
// zodra de key in de locale-bestanden staat.
import type { TFunction } from 'i18next';

/** Key-deel uit een Nederlandse tekst. Zelfde regels als de generator in het schemascript. */
export function schemaTextKey(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

export function schemaText(t: TFunction, text: string | null | undefined): string {
  if (!text) return '';
  const k = schemaTextKey(text);
  if (!k) return text;
  return t(`admin.storefront.schemaText.${k}`, { defaultValue: text });
}
