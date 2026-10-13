// THEME-SCHEMA-1 — vorm van het themaschema van de standaardshop.
export type SchemaValue = string | number | boolean | null | Record<string, unknown>[] | undefined;
export interface SchemaField {
  key: string;
  type: 'text' | 'textarea' | 'color' | 'select' | 'toggle' | 'range' | 'info' | 'icon';
  label: string;
  default?: SchemaValue;
  options?: { value: string; label: string }[];
  min?: number; max?: number; step?: number; unit?: string;
  placeholder?: string; help?: string; pattern?: string;
  showIf?: { key: string; equals: SchemaValue };
}
export interface SchemaBlocks { key: string; label: string; plural?: string; max?: number; default?: Record<string, unknown>[]; fields: SchemaField[] }
export interface SchemaSection { label: string; hint?: string; fields: SchemaField[]; blocks?: SchemaBlocks }
export interface ThemeSchema {
  id: string; name: string; version: number;
  settings: { id: string; label: string; fields: SchemaField[] }[];
  product_page: SchemaField[];
  tracking: SchemaField[];
  section_style: SchemaField[];
  product_section_style: SchemaField[];
  sections: Record<string, SchemaSection>;
  icons: string[];
  presets?: ThemePreset[];
}
export interface PresetSection { section_type: string; title: string | null; subtitle?: string | null; content: Record<string, unknown>; settings: Record<string, unknown> }
export interface ThemePreset {
  id: string; name: string; description: string;
  preview: { background: string; text: string; accent: string | null; image: string | null };
  theme: { brand_color?: string; heading_font: string | null; body_font: string | null };
  settings: Record<string, unknown>;
  product_page: Record<string, unknown>;
  sections: PresetSection[];
  /** DEMO-1 — een echte demowinkel die dit thema gebruikt. */
  example?: { url: string; label: string };
}


export function schemaDefaults(fields: SchemaField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f.type !== 'info') out[f.key] = f.default ?? null;
  return out;
}

