// Re-export from the shared edge-function module so both edge & frontend
// stay in sync. The single source of truth lives at:
//   supabase/functions/_shared/peppol/identifiers.ts
export * from "../../../supabase/functions/_shared/peppol/identifiers";
