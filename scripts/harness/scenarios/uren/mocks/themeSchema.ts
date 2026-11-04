// UREN-1b — themaschema zoals de standaardshop het publiceert (enkel wat de schermen lezen).
import { SCHEMA } from './schemaData';
export function useThemeSchema() { return { data: SCHEMA, isLoading: false }; }
export function isHorecaPreset(schema: { presets?: { id: string; vocabulary?: string }[] } | undefined, id: unknown) {
  return !!schema?.presets?.some((p) => p.id === id && p.vocabulary === 'horeca');
}
