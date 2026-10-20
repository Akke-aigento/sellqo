// HONEST-SAVE-1 (21-10-2026): een Supabase .update()/.upsert()/.delete() zonder
// .select() geeft géén fout als RLS de rij wegfiltert — er wordt gewoon 0 rijen
// geraakt en de UI meldt "Opgeslagen". Zet daarom .select('id') achter de write en
// geef `data` hier door: 0 rijen = geweigerd, en dat zeggen we ook.
import i18n from 'i18next';

export class NoRowsWrittenError extends Error {
  constructor() {
    super(i18n.t('common.saveNoPermission'));
    this.name = 'NoRowsWrittenError';
  }
}

/** Gooit NoRowsWrittenError als de write geen enkele rij raakte. */
export function assertRowsWritten(data: readonly unknown[] | null | undefined): void {
  if (!data || data.length === 0) throw new NoRowsWrittenError();
}

export function isNoRowsWrittenError(err: unknown): err is NoRowsWrittenError {
  return err instanceof NoRowsWrittenError;
}
