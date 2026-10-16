// MEDIA-1 (16-10-2026) — media_assets schrijven vanuit de browser.
//
// Best effort: registreren mag een upload NOOIT laten mislukken. Lukt het niet, dan
// loggen we en vangt de DB-trigger de foto alsnog op zodra hij op een product belandt.

import { fileNameFromUrl } from './mediaLibrary';

export interface RegisterMediaInput {
  tenantId: string;
  url: string;
  folder?: string;
  source?: string;
  title?: string | null;
  fileName?: string;
  fileType?: string;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}

// Minimale vorm van de supabase-client (testbaar zonder echte client).
interface QueryResult {
  data?: unknown;
  error: { code?: string; message: string } | null;
}
interface TableLike {
  upsert: (row: Record<string, unknown>, opts: { onConflict: string; ignoreDuplicates: boolean }) => PromiseLike<QueryResult>;
  insert: (row: Record<string, unknown>) => PromiseLike<QueryResult>;
  select: (cols: string) => {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => { limit: (n: number) => PromiseLike<QueryResult> };
    };
  };
  update: (row: Record<string, unknown>) => {
    eq: (c: string, v: string) => { is: (c: string, v: null) => PromiseLike<QueryResult> };
  };
}
export interface MediaClientLike {
  from: (table: string) => unknown;
}

const table = (client: MediaClientLike) => client.from('media_assets') as TableLike;

export function buildMediaRow(input: RegisterMediaInput): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    file_name: input.fileName || fileNameFromUrl(input.url),
    file_url: input.url,
    file_type: input.fileType || 'image/jpeg',
    file_size: input.fileSize ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    title: input.title ?? null,
    source: input.source || 'upload',
    folder: input.folder || 'general',
    tags: [],
    is_ai_generated: false,
    is_favorite: false,
  };
}

/**
 * Zet een beeld in de bibliotheek. Bestaat de URL al voor deze winkel, dan gebeurt er niets.
 * Geeft true terug als het gelukt is (of de rij al bestond).
 */
export async function registerMediaAsset(client: MediaClientLike, input: RegisterMediaInput): Promise<boolean> {
  if (!input.tenantId || !input.url) return false;
  const row = buildMediaRow(input);
  try {
    const { error } = await table(client).upsert(row, { onConflict: 'tenant_id,file_url', ignoreDuplicates: true });
    if (!error) return true;
    // 42P10 = de unieke sleutel bestaat (nog) niet, bv. vóór de MEDIA-1-migratie live staat.
    if (error.code !== '42P10') {
      console.warn('[media] registreren mislukt:', error.message);
      return false;
    }
    const { data } = await table(client).select('id').eq('tenant_id', input.tenantId).eq('file_url', input.url).limit(1);
    if (Array.isArray(data) && data.length > 0) return true;
    const ins = await table(client).insert(row);
    if (ins.error) {
      console.warn('[media] registreren mislukt:', ins.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[media] registreren mislukt:', e);
    return false;
  }
}

/** Vult ontbrekende afmetingen aan; overschrijft nooit bestaande. */
export async function recordMediaDimensions(client: MediaClientLike, id: string, width: number, height: number): Promise<void> {
  if (!id || !(width > 0) || !(height > 0)) return;
  try {
    await table(client).update({ width, height }).eq('id', id).is('width', null);
  } catch {
    // Puur informatief; stil laten vallen is hier correct.
  }
}
