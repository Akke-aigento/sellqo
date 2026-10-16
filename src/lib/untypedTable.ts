// Getypeerde toegang tot tabellen of kolommen die (nog) niet in de gegenereerde
// supabase-types staan, bv. een tabel uit een migratie die nog niet geregenereerd is.
// Je geeft zelf de rijvorm op; zo blijft de rest van de code vrij van `any`.

import { supabase } from '@/integrations/supabase/client';

export interface DbError {
  message: string;
  code?: string;
}

export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

export interface FilterBuilder<T> extends PromiseLike<DbResult<T[]>> {
  eq(column: string, value: unknown): FilterBuilder<T>;
  in(column: string, values: unknown[]): FilterBuilder<T>;
  contains(column: string, value: unknown[]): FilterBuilder<T>;
  is(column: string, value: null): FilterBuilder<T>;
  order(column: string, opts?: { ascending?: boolean }): FilterBuilder<T>;
  limit(n: number): FilterBuilder<T>;
  range(from: number, to: number): FilterBuilder<T>;
  maybeSingle(): PromiseLike<DbResult<T>>;
}

export interface TableBuilder<T> {
  select(columns: string): FilterBuilder<T>;
  update(row: Record<string, unknown>): FilterBuilder<T>;
  delete(): FilterBuilder<T>;
  insert(row: Record<string, unknown>): PromiseLike<DbResult<null>>;
  upsert(row: Record<string, unknown>, opts?: { onConflict?: string; ignoreDuplicates?: boolean }): PromiseLike<DbResult<null>>;
}

export function untypedTable<T = Record<string, unknown>>(name: string): TableBuilder<T> {
  return (supabase as unknown as { from: (t: string) => TableBuilder<T> }).from(name);
}
