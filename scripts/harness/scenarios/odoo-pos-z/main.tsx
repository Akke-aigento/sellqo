// KASSA-ODOO-1 harnas — twee kaarten "Kassa-omzet naar Odoo": (A) uit, (B) aan met een log met
// needs_review, failed en synced. De kaart zelf rendert ongewijzigd; enkel de Supabase-client is nep.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { OdooPosZCard } from '@/components/admin/accounting/OdooPosZCard';
import type { TenantOdooSettings } from '@/hooks/useTenantOdooSettings';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const base: TenantOdooSettings = {
  tenant_id: 't1', aggregate_b2c_customers: true, b2c_dummy_partner_name: 'Diverse particulieren', b2c_dummy_partner_odoo_id: null,
  aggregate_per_channel: true, odoo_sync_enabled: true, odoo_journal_id: '7', odoo_journal_name: 'Verkopen', peppol_send_enabled: true,
  channel_aliases: {}, channel_partner_ids: {}, odoo_auto_post: true, push_supplier_documents: false,
};
const journals = { isLoading: false, data: [
  { id: 7, name: 'Verkopen', code: 'VK' },
  { id: 9, name: 'Kassa', code: 'KAS' },
  { id: 11, name: 'Verkopen Loveke', code: 'LOV', claimed_by_other_tenant: true },
] };
const off: TenantOdooSettings = { ...base, pos_z_sync_enabled: false, pos_z_sync_from: null };
const on: TenantOdooSettings = { ...base, pos_z_sync_enabled: true, pos_z_sync_from: '2026-10-28', pos_z_enabled_at: '2026-10-28T09:00:00Z', pos_z_journal_id: '9', pos_z_journal_name: 'Kassa' };
const save = (u: unknown) => { (window as unknown as { __saved?: unknown[] }).__saved = [...((window as unknown as { __saved?: unknown[] }).__saved ?? []), u]; };

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <div className="p-4 space-y-6 max-w-3xl mx-auto" data-harness="root">
      <section data-card="off"><OdooPosZCard tenantId="t1" settings={off} isLoading={false} canWrite configured journals={journals} saving={false} onSave={save} /></section>
      <section data-card="on"><OdooPosZCard tenantId="t2" settings={on} isLoading={false} canWrite configured journals={journals} saving={false} onSave={save} /></section>
    </div>
    <Toaster />
  </QueryClientProvider>,
);
