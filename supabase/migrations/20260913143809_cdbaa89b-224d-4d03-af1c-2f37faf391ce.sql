-- NOTIF-RLS-1 — meldingen volgen de rechtenmatrix.
--
-- WAAROM. De leesregel op notifications (notifications_select_members) keek
-- alleen of je bij de winkel hoort:
--   tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) OR is_platform_admin(auth.uid())
-- Elk teamlid zag dus elke melding van zijn winkel, ook "Factuur betaald" en
-- "Chargeback ontvangen" met bedragen in `data` — terwijl de tabel invoices zelf
-- magazijn en marketing buitensluit. Gevonden bij PUSH-2 (13 sep 2026).
--
-- DE AFBEELDING. Categorie → leesrecht, gelijk aan src/lib/notificationResources.ts
-- en de read-rollen in src/hooks/useCan.ts (PERMISSION_MATRIX). platform_admin mag
-- altijd. src/test/notificationReadRoles.test.ts leest deze migratie en faalt zodra
-- de rollen hieronder afwijken van de matrix.
--
--   orders, customers, products           → orders/customers/products: iedereen
--   invoices, quotes, subscriptions       → invoices
--   payments                              → payments
--   marketing                             → marketing
--   team                                  → team
--   messages                              → inbox
--   integrations                          → integrations
--   ai_coach                              → ai_coach
--   system                                → settings_general
--
-- EEN FUNCTIE, TWEE GEBRUIKERS. De RLS roept hem aan met auth.uid();
-- send-push-notification roept hem met de service-role aan per ontvanger, zodat
-- push dezelfde regel volgt zonder een kopie van de matrix in TypeScript.
--
-- WIE MAG HEM AANROEPEN. SECURITY DEFINER leest user_roles. Een ingelogde
-- gebruiker mag hem alleen voor zichzelf gebruiken — anders kon je de rollen van
-- anderen aftasten. auth.uid() is NULL voor de service-role; die mag elke
-- gebruiker. anon en PUBLIC krijgen geen EXECUTE.
--
-- Getroffen op 13 sep 2026: één marketinggebruiker ziet geen meldingen over
-- facturen, offertes, abonnementen, betalingen, team, integraties en systeem
-- meer. De andere gebruikers zijn tenant_admin of platform_admin.
--
-- Ook: de drie testmeldingen van de pushtest (Demo Bakkerij, 13 sep) verdwijnen.
--
-- Idempotent: CREATE OR REPLACE, DROP POLICY IF EXISTS, DELETE op vaste id's.
--
-- Handmatig terugdraaien:
--   DROP POLICY IF EXISTS notifications_select_by_role ON public.notifications;
--   CREATE POLICY notifications_select_members ON public.notifications
--     FOR SELECT TO authenticated
--     USING ((tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))) OR is_platform_admin(auth.uid()));
--   DROP FUNCTION IF EXISTS public.can_read_notification_category(uuid, uuid, text);
-- (en send-push-notification terug naar de versie zonder rpc-aanroep)

CREATE OR REPLACE FUNCTION public.can_read_notification_category(
  _user_id uuid,
  _tenant_id uuid,
  _category text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (auth.uid() IS NULL OR _user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND (
          ur.role = 'platform_admin'::public.app_role
          OR (
            ur.tenant_id = _tenant_id
            AND ur.role::text = ANY (
              CASE _category
                WHEN 'orders'        THEN ARRAY['tenant_admin','accountant','staff','warehouse','viewer','marketing']
                WHEN 'customers'     THEN ARRAY['tenant_admin','accountant','staff','warehouse','viewer','marketing']
                WHEN 'products'      THEN ARRAY['tenant_admin','accountant','staff','warehouse','viewer','marketing']
                WHEN 'invoices'      THEN ARRAY['tenant_admin','accountant','staff','viewer']
                WHEN 'quotes'        THEN ARRAY['tenant_admin','accountant','staff','viewer']
                WHEN 'subscriptions' THEN ARRAY['tenant_admin','accountant','staff','viewer']
                WHEN 'payments'      THEN ARRAY['tenant_admin','staff','accountant','viewer']
                WHEN 'marketing'     THEN ARRAY['tenant_admin','staff','viewer','marketing']
                WHEN 'team'          THEN ARRAY['tenant_admin']
                WHEN 'messages'      THEN ARRAY['tenant_admin','staff','viewer','marketing']
                WHEN 'integrations'  THEN ARRAY['tenant_admin','viewer']
                WHEN 'ai_coach'      THEN ARRAY['tenant_admin','staff','viewer']
                WHEN 'system'        THEN ARRAY['tenant_admin','viewer']
                -- Een onbekende categorie is voor niemand behalve platform_admin:
                -- liever een melding te weinig dan een die iemand niet mocht zien.
                ELSE ARRAY[]::text[]
              END
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_notification_category(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_notification_category(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_notification_category(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS notifications_select_members ON public.notifications;
DROP POLICY IF EXISTS notifications_select_by_role ON public.notifications;
CREATE POLICY notifications_select_by_role ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.can_read_notification_category(auth.uid(), tenant_id, category::text)
  );

DELETE FROM public.notifications
WHERE id IN (
  '62140257-ae53-4d99-af3e-102cb0b1c0d6',
  '7967bdcd-2c6f-49f2-abfb-96dd1a5824ca',
  '1d9be0d5-d64b-4520-b204-3525ab9bbb05'
)
AND tenant_id = 'c11441ef-52d8-406a-b0df-800d09b027b2'
AND data->>'test' = 'true';