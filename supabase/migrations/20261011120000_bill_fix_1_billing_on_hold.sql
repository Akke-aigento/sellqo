-- BILL-FIX-1 (11-10-2026): "gratis tot omschakeling".
-- Live al uitgevoerd via de connector (idempotent, mag opnieuw draaien).
-- Zolang billing_on_hold true is, start check-expired-trials geen betaalabonnement
-- voor de tenant. Uitzetten = facturatie start bij de volgende nachtrun, als de
-- trial voorbij is. Los van billing_exempt (eigen winkels, nooit facturatie).
alter table public.tenants add column if not exists billing_on_hold boolean not null default false;
comment on column public.tenants.billing_on_hold is 'BILL-FIX-1: gratis tot omschakeling. Zolang true start check-expired-trials geen betaalabonnement voor deze tenant; uitzetten = facturatie start bij de volgende nachtrun (als de trial voorbij is).';
