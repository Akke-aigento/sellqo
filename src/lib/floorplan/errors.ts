// ZAAL-H1 — databankfout → i18n-key voor een begrijpelijke melding in de editor.
export function floorErrorKey(err: unknown): { key: string; reason?: string } {
  const e = (err ?? {}) as { code?: string; message?: string };
  if (e.code === '23505') return { key: 'admin.floorPlan.error_label_taken' };
  if (e.code === '42501' || /permission denied|row-level security/i.test(e.message || '')) return { key: 'admin.floorPlan.error_no_rights' };
  if (e.code === '23514') return { key: 'admin.floorPlan.error_invalid' };
  return { key: 'admin.floorPlan.error_save', reason: e.message || String(err) };
}
