-- SCHEMA-FIX-1 (13-10-2026) — AI-kennisbank kon nooit iets wegschrijven.
--
-- ai-build-knowledge-index doet upserts met onConflict 'tenant_id,source_type,source_id'.
-- De enige unieke index op die kolommen is PARTIEEL (WHERE source_id IS NOT NULL);
-- Postgres kan een partiële index niet als ON CONFLICT-doel afleiden zonder dat
-- predicaat, en supabase-js kan het niet meegeven. Elke upsert faalde dus: de tabel
-- had 0 rijen, ooit, en de AI-functies werkten zonder kennis van producten,
-- categorieën en verzendmethoden.
--
-- Een volledige unieke index op dezelfde kolommen is semantisch gelijk voor
-- source_id IS NOT NULL (NULLs blijven onderling verschillend; de regel voor
-- source_id IS NULL blijft bij idx_ai_knowledge_unique_null). Additief, tabel leeg.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_knowledge_upsert_target
  ON public.ai_knowledge_index (tenant_id, source_type, source_id);
