import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTenant } from '@/hooks/useTenant';
import { decidePushTap, initPushNotificationTaps, type PushTapTarget } from '@/native/pushTaps';

/**
 * Stuurt een aangetikte pushmelding naar het juiste scherm, en de juiste tenant.
 *
 * Hangt binnen AdminLayout, niet naast DeepLinkListener in App.tsx: het wisselen
 * van tenant heeft TenantContext nodig, en die bestaat pas onder AdminLayout.
 *
 * Waarom wisselen nodig is: een toestel-token hangt aan een telefoon, niet aan
 * een tenant. Wie VanXcel én Loveke beheert krijgt meldingen van allebei. Tik je
 * op een bestelling van VanXcel terwijl Loveke actief is, dan zou je anders op
 * `/admin/orders/<id>` landen in de verkeerde tenant — een lege of foute pagina.
 *
 * NOTIF-DEEPLINK-1 (19 sep 2026): een tap wordt eerst in een wachtrij gezet en
 * pas beslist als de winkels geladen zijn (`decidePushTap`). Bij een koude start
 * komt het bewaarde tap-event binnen vóór TenantProvider klaar is; tot deze
 * datum telde de winkel dan als "onbekend" en ging de app naar het dashboard.
 * Bij een wissel: eerst wisselen, navigeren zodra `currentTenant` de nieuwe is.
 *
 * Rendert niets. Op web doet de listener niets.
 */
export function PushTapListener() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentTenant, tenants, loading, setCurrentTenant } = useTenant();
  // Een tap die nog niet afgehandeld is: wacht op de winkels of op de wissel.
  const [queued, setQueued] = useState<PushTapTarget | null>(null);
  const switchingTo = useRef<string | null>(null);

  // navigate en setCurrentTenant veranderen per render/route. Via refs, zodat de
  // listener één keer registreert: elke herregistratie is een async gat.
  const navigateRef = useRef(navigate);
  const setTenantRef = useRef(setCurrentTenant);
  navigateRef.current = navigate;
  setTenantRef.current = setCurrentTenant;

  useEffect(() => initPushNotificationTaps((target) => setQueued(target)), []);

  useEffect(() => {
    if (!queued) return;

    // Een wissel is ingezet: wachten tot hij doorgekomen is, dán navigeren.
    if (switchingTo.current) {
      if (currentTenant?.id === switchingTo.current) {
        switchingTo.current = null;
        setQueued(null);
        navigateRef.current(queued.path);
      }
      return;
    }

    const decision = decidePushTap(queued, {
      tenantsLoading: loading,
      currentTenantId: currentTenant?.id ?? null,
      tenantIds: tenants.map((tenant) => tenant.id),
    });

    switch (decision.kind) {
      case 'wait':
        return;
      case 'navigate':
        setQueued(null);
        navigateRef.current(decision.path);
        return;
      case 'switch': {
        const tenant = tenants.find((x) => x.id === decision.tenantId);
        if (!tenant) return;
        switchingTo.current = decision.tenantId;
        setTenantRef.current(tenant);
        return;
      }
      case 'no-access':
        // Geen toegang (meer) tot die winkel: niets van die winkel tonen, wel
        // zeggen waarom. De meldingenlijst, niet het dashboard.
        setQueued(null);
        toast.info(t('admin.pushTap.noAccess'));
        navigateRef.current('/admin/notifications');
        return;
    }
  }, [queued, loading, currentTenant?.id, tenants, t]);

  return null;
}
