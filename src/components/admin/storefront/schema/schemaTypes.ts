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
}


export function schemaDefaults(fields: SchemaField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f.type !== 'info') out[f.key] = f.default ?? null;
  return out;
}

