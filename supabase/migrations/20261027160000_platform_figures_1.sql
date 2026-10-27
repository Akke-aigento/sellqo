-- PLATFORM-FIGURES-1 — één bron voor de geldcijfers van het platformbeheer.
--
-- Tot 27-10 lazen het platformdashboard en de tenantschermen de lijstprijs van elk plan
-- (MRR €3.253,50 en 27 "betalende klanten", terwijl er één betalende klant was), het oude
-- archief platform_invoices en een dode kolom tenants.subscription_status. De echte
-- facturatie leeft op de interne SellQo-tenant (slug 'sellqo'): subscriptions +
-- subscription_lines (wat er aangerekend wordt), billing_cycles (betaalverzoeken),
-- invoices + credit_notes (wat er gefactureerd en betaald is). Een tenant is daar klant.
--
-- Koppeling klant → tenant, in volgorde van voorrang:
--   1. tenant_subscriptions.billing_customer_id (de huidige facturatieklant),
--   2. customers.linked_tenant_id,
--   3. customers.external_id = 'tenant:<id>' (zo maakt sync-tenant-plan ze aan).
-- Een betaalverzoek hangt via zijn abonnement aan de tenant (billing_subscription_id),
-- pas daarna via de klant.
--
-- Regels:
--   - Gefactureerd ("client") = geen demo, niet intern, niet vrijgesteld, niet on hold
--     (zelfde regel als tenantIsNotBilled in _shared/addonBilling.ts).
--   - MRR = som van de lopende abonnementsregels (aantal × prijs, netto) van een actief
--     native abonnement, herleid naar een maand. Enkel "client"-tenants tellen in de totalen.
--   - Betaald = facturen met status 'paid' min de verstuurde creditnota's op betaalde
--     facturen (of zonder originele factuur), incl. en excl. btw. Een creditnota op een open
--     factuur verlaagt het openstaande bedrag; op een geannuleerde factuur telt ze niet.
--   - Openstaand = open betaalverzoeken (awaiting_payment/processing/reopened, en expired
--     zolang het abonnement niet stopgezet is: een vervallen verzoek van een stopgezet
--     abonnement wordt nooit meer betaald, zie generate-subscription-invoices) plus
--     verstuurde/onbetaalde facturen die niet aan een betaalverzoek hangen, min creditnota's.
--   - Facturen van klanten die aan geen enkele tenant hangen (oude tests) tellen apart
--     ("niet toegewezen"), zodat de totalen optellen tot alle SellQo-facturen.
--   - Platformfees: enkel collected_via = 'invoice' (application fees en vrijgestelde fees
--     worden nooit gefactureerd).
-- p_tenant_id: enkel die tenant (tenantscherm), zonder limiet op documenten. Leeg: het hele
-- platform, de 500 recentste documenten.
-- Enkel leesbaar voor platformbeheerders.

CREATE OR REPLACE FUNCTION public.platform_billing_overview(p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_billing uuid;
  v_month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'Europe/Brussels';
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_billing FROM public.tenants WHERE slug = 'sellqo';

  WITH
  link_raw AS (
    SELECT ts.billing_customer_id AS customer_id, ts.tenant_id, 1 AS prio
      FROM public.tenant_subscriptions ts
     WHERE ts.billing_customer_id IS NOT NULL
    UNION ALL
    SELECT c.id, c.linked_tenant_id, 2
      FROM public.customers c
     WHERE c.tenant_id = v_billing AND c.linked_tenant_id IS NOT NULL
    UNION ALL
    SELECT c.id, t.id, 3
      FROM public.customers c
      JOIN public.tenants t ON c.external_id = 'tenant:' || t.id::text
     WHERE c.tenant_id = v_billing
  ),
  link AS (
    SELECT DISTINCT ON (customer_id) customer_id, tenant_id
      FROM link_raw
     ORDER BY customer_id, prio
  ),
  inv AS (
    SELECT i.id, i.customer_id, i.status::text AS status, i.subtotal, i.tax_amount, i.total,
           i.paid_at, i.issue_date, i.due_date, i.created_at, i.invoice_number, l.tenant_id
      FROM public.invoices i
      LEFT JOIN link l ON l.customer_id = i.customer_id
     WHERE i.tenant_id = v_billing
       AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
  ),
  cn_all AS (
    SELECT n.id, n.customer_id, coalesce(n.status, 'sent') AS status, n.subtotal, n.tax_amount, n.total,
           n.issue_date, n.created_at, n.credit_note_number, n.original_invoice_id, l.tenant_id,
           o.status::text AS original_status
      FROM public.credit_notes n
      LEFT JOIN link l ON l.customer_id = n.customer_id
      LEFT JOIN public.invoices o ON o.id = n.original_invoice_id
     WHERE n.tenant_id = v_billing
       AND coalesce(n.status, 'sent') NOT IN ('draft', 'cancelled')
       AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
  ),
  -- Creditnota's die het betaalde bedrag verlagen.
  cn AS (
    SELECT * FROM cn_all WHERE original_status = 'paid' OR original_invoice_id IS NULL
  ),
  cyc AS (
    SELECT b.id, b.total, b.due_date, b.status::text AS status, b.invoice_id,
           coalesce(ts.tenant_id, l.tenant_id) AS tenant_id
      FROM public.billing_cycles b
      LEFT JOIN public.tenant_subscriptions ts ON ts.billing_subscription_id = b.subscription_id
      LEFT JOIN link l ON l.customer_id = b.customer_id
      LEFT JOIN public.subscriptions s ON s.id = b.subscription_id
     WHERE b.tenant_id = v_billing
       AND (b.status IN ('awaiting_payment', 'processing', 'reopened')
            OR (b.status = 'expired' AND coalesce(s.status, '') <> 'cancelled'))
  ),
  open_inv AS (
    SELECT x.* FROM (
      SELECT i.id, i.tenant_id, i.due_date,
             i.total - coalesce((SELECT sum(a.total) FROM cn_all a WHERE a.original_invoice_id = i.id), 0) AS total
        FROM inv i
       WHERE i.status IN ('sent', 'unpaid', 'processing')
         AND NOT EXISTS (SELECT 1 FROM public.billing_cycles b WHERE b.invoice_id = i.id)
    ) x WHERE x.total > 0
  ),
  mrr AS (
    SELECT ts.tenant_id,
           round(sum(coalesce(sl.quantity, 1) * coalesce(sl.unit_price, 0)
             / CASE s.interval
                 WHEN 'yearly'    THEN 12.0
                 WHEN 'quarterly' THEN 3.0
                 WHEN 'weekly'    THEN 12.0 / 52.0
                 ELSE 1.0
               END
             / greatest(coalesce(s.interval_count, 1), 1)), 2) AS mrr_net
      FROM public.tenant_subscriptions ts
      JOIN public.subscriptions s ON s.id = ts.billing_subscription_id AND s.status = 'active'
      JOIN public.subscription_lines sl ON sl.subscription_id = s.id
                                       AND (sl.end_date IS NULL OR sl.end_date >= current_date)
     WHERE (p_tenant_id IS NULL OR ts.tenant_id = p_tenant_id)
     GROUP BY ts.tenant_id
  ),
  fees AS (
    SELECT tenant_id, sum(fee_cents) AS cents,
           sum(fee_cents) FILTER (WHERE billing_cycle_id IS NULL) AS cents_uninvoiced
      FROM (SELECT tenant_id, fee_cents, billing_cycle_id, collected_via FROM public.platform_order_fees
            UNION ALL
            SELECT tenant_id, fee_cents, billing_cycle_id, collected_via FROM public.platform_ticket_fees) f
     WHERE collected_via = 'invoice'
       AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
     GROUP BY tenant_id
  ),
  -- Omzet van de winkel zelf (live, i.p.v. de tellers tenants.lifetime_*): betaalde orders,
  -- bij een gedeeltelijke terugbetaling min de creditnota's op de factuur van die order.
  shop AS (
    SELECT o.tenant_id, count(*) AS orders,
           sum(o.total) - coalesce(sum(r.refunded), 0) AS revenue_gross
      FROM public.orders o
      LEFT JOIN LATERAL (
        SELECT sum(n.total) AS refunded
          FROM public.invoices i
          JOIN public.credit_notes n ON n.original_invoice_id = i.id
                                    AND coalesce(n.status, 'sent') NOT IN ('draft', 'cancelled')
         WHERE i.order_id = o.id AND o.payment_status = 'partially_refunded'
      ) r ON true
     WHERE o.payment_status IN ('paid', 'partially_refunded')
       AND (p_tenant_id IS NULL OR o.tenant_id = p_tenant_id)
     GROUP BY o.tenant_id
  ),
  inv_agg AS (
    SELECT tenant_id,
           sum(total) FILTER (WHERE status = 'paid') AS paid_gross,
           sum(subtotal) FILTER (WHERE status = 'paid') AS paid_net,
           count(*) FILTER (WHERE status = 'paid') AS paid_invoices,
           max(coalesce(paid_at, issue_date::timestamptz)) FILTER (WHERE status = 'paid') AS last_paid_at,
           sum(total) FILTER (WHERE status = 'paid' AND coalesce(paid_at, issue_date::timestamptz) >= v_month_start) AS paid_gross_month
      FROM inv GROUP BY tenant_id
  ),
  cn_agg AS (
    SELECT tenant_id, sum(total) AS gross, sum(subtotal) AS net,
           sum(total) FILTER (WHERE coalesce(issue_date::timestamptz, created_at) >= v_month_start) AS gross_month
      FROM cn GROUP BY tenant_id
  ),
  open_agg AS (
    SELECT tenant_id, sum(total) AS gross, min(due_date) AS due_date,
           bool_or(status = 'expired') AS expired
      FROM (SELECT tenant_id, total, due_date, status FROM cyc
            UNION ALL
            SELECT tenant_id, total, due_date, 'sent' FROM open_inv) x
     GROUP BY tenant_id
  ),
  per_tenant AS (
    SELECT t.id AS tenant_id, t.name,
           CASE WHEN t.is_demo THEN 'demo'
                WHEN t.is_internal_tenant OR t.billing_exempt THEN 'own'
                WHEN t.billing_on_hold THEN 'on_hold'
                ELSE 'client' END AS category,
           ts.status::text AS status, ts.plan_id, ts.billing_interval, ts.trial_end,
           coalesce(m.mrr_net, 0) AS mrr_net,
           coalesce(ia.paid_gross, 0) - coalesce(ca.gross, 0) AS paid_gross,
           coalesce(ia.paid_net, 0) - coalesce(ca.net, 0) AS paid_net,
           coalesce(ia.paid_gross_month, 0) - coalesce(ca.gross_month, 0) AS paid_gross_month,
           coalesce(ca.gross, 0) AS credited_gross,
           coalesce(ia.paid_invoices, 0) AS paid_invoices,
           ia.last_paid_at,
           coalesce(oa.gross, 0) AS open_gross,
           oa.due_date AS open_due_date,
           coalesce(oa.expired, false) AS open_expired,
           round(coalesce(f.cents, 0) / 100.0, 2) AS fees_net,
           round(coalesce(f.cents_uninvoiced, 0) / 100.0, 2) AS fees_uninvoiced_net,
           coalesce(sh.orders, 0) AS shop_orders,
           coalesce(sh.revenue_gross, 0) AS shop_revenue_gross,
           (SELECT count(*) FROM public.customers c WHERE c.tenant_id = t.id) AS shop_customers
      FROM public.tenants t
      LEFT JOIN public.tenant_subscriptions ts ON ts.tenant_id = t.id
      LEFT JOIN mrr m ON m.tenant_id = t.id
      LEFT JOIN fees f ON f.tenant_id = t.id
      LEFT JOIN shop sh ON sh.tenant_id = t.id
      LEFT JOIN inv_agg ia ON ia.tenant_id = t.id
      LEFT JOIN cn_agg ca ON ca.tenant_id = t.id
      LEFT JOIN open_agg oa ON oa.tenant_id = t.id
     WHERE t.id <> v_billing
       AND (p_tenant_id IS NULL OR t.id = p_tenant_id)
  ),
  docs AS (
    SELECT 'invoice' AS kind, i.id, i.invoice_number AS number, i.status, i.subtotal, i.tax_amount, i.total,
           coalesce(i.issue_date, i.created_at::date) AS doc_date, i.paid_at, i.tenant_id,
           coalesce(c.company_name, c.email) AS customer_name
      FROM inv i LEFT JOIN public.customers c ON c.id = i.customer_id
    UNION ALL
    SELECT 'credit_note', n.id, n.credit_note_number, n.status, -n.subtotal, -n.tax_amount, -n.total,
           coalesce(n.issue_date, n.created_at::date), NULL, n.tenant_id,
           coalesce(c.company_name, c.email)
      FROM cn_all n LEFT JOIN public.customers c ON c.id = n.customer_id
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'tenants', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.name) FROM per_tenant p), '[]'::jsonb),
    'totals', jsonb_build_object(
      'mrr_net',          coalesce((SELECT sum(mrr_net) FROM per_tenant WHERE category = 'client'), 0),
      'paying_customers', (SELECT count(*) FROM per_tenant WHERE category = 'client' AND mrr_net > 0),
      'paid_gross',       coalesce((SELECT sum(paid_gross) FROM per_tenant WHERE category = 'client'), 0),
      'paid_net',         coalesce((SELECT sum(paid_net) FROM per_tenant WHERE category = 'client'), 0),
      'paid_gross_this_month', coalesce((SELECT sum(paid_gross_month) FROM per_tenant WHERE category = 'client'), 0),
      'open_gross',       coalesce((SELECT sum(open_gross) FROM per_tenant WHERE category = 'client'), 0),
      'open_count',       (SELECT count(*) FROM per_tenant WHERE category = 'client' AND open_gross > 0),
      'paid_gross_other', coalesce((SELECT sum(paid_gross) FROM per_tenant WHERE category <> 'client'), 0),
      'paid_gross_unassigned',
        coalesce((SELECT sum(total) FROM inv WHERE tenant_id IS NULL AND status = 'paid'), 0)
        - coalesce((SELECT sum(total) FROM cn WHERE tenant_id IS NULL), 0),
      'paid_gross_all',
        coalesce((SELECT sum(total) FROM inv WHERE status = 'paid'), 0)
        - coalesce((SELECT sum(total) FROM cn), 0)
    ),
    'by_plan', coalesce((
      SELECT jsonb_agg(jsonb_build_object('plan_id', plan_id, 'count', n, 'mrr_net', mrr) ORDER BY mrr DESC)
        FROM (SELECT plan_id, count(*) AS n, sum(mrr_net) AS mrr
                FROM per_tenant WHERE category = 'client' AND mrr_net > 0 GROUP BY plan_id) x), '[]'::jsonb),
    'documents', coalesce((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.doc_date DESC, d.number DESC)
        FROM (SELECT d.*, t.name AS tenant_name FROM docs d LEFT JOIN public.tenants t ON t.id = d.tenant_id
               ORDER BY d.doc_date DESC, d.number DESC
               LIMIT CASE WHEN p_tenant_id IS NULL THEN 500 END) d), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_billing_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_billing_overview(uuid) TO authenticated;
