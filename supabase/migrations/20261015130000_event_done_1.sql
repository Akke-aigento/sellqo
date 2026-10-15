-- EVENT-DONE-1 — de ticketmail ís de levering: grandfather voor bestaande bestellingen.
-- Betaalde bestellingen waarvan de ticketmail al vertrok (ticket_mail_log) en waarvan ALLE
-- regels per mail gaan (tickets, combitickets, muntenpakketten) stonden tot nu eeuwig op
-- "In behandeling". Die gaan in één keer naar delivered, met de maildatum als leverdatum
-- (vaste waarde uit het log, geen now(): een re-run raakt geen latere rijen).
-- Nieuwe bestellingen rondt send-ticket-confirmation (EVENT-DONE-1) voortaan zelf af.

UPDATE public.orders o
SET status = 'delivered',
    delivered_at = COALESCE(o.delivered_at, l.last_sent_at),
    updated_at = now()
FROM public.ticket_mail_log l
WHERE l.order_id = o.id
  AND o.payment_status = 'paid'
  AND o.status IN ('pending', 'processing')
  AND l.first_sent_at < '2026-10-15 12:00:00+00'
  AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = o.id
      AND (p.id IS NULL OR NOT (p.product_type = 'ticket' OR p.token_amount IS NOT NULL))
  );
