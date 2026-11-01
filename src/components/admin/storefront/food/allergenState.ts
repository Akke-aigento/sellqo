// ALLERGEEN-ADMIN-1 — drie standen voor de allergenen van een product (ALLERGEEN-VERKLAARD-1):
//   'count'   minstens één allergeen aangevinkt;
//   'none'    bewust "bevat geen van de 14 allergenen" (allergens leeg, allergens_declared = true);
//   'missing' niet ingevuld (leeg en niet verklaard).
// declared === undefined: de kolom bestaat (nog) niet in deze databank → oude regel: leeg = niet ingevuld.
export type AllergenState = { kind: 'count'; n: number } | { kind: 'none' } | { kind: 'missing' };

export function allergenState(allergens: readonly string[] | null | undefined, declared: boolean | null | undefined): AllergenState {
  const n = allergens?.length ?? 0;
  if (n > 0) return { kind: 'count', n };
  return declared === true ? { kind: 'none' } : { kind: 'missing' };
}

/** Postgres "kolom bestaat niet": de admin staat live vóór de migratie (volgorde-fout bij uitrol). */
export const isMissingColumn = (e: unknown) => (e as { code?: string } | null)?.code === '42703';
