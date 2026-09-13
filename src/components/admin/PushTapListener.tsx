import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { initPushNotificationTaps, type PushTapTarget } from '@/native/pushTaps';

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
 * Eerst wisselen en pas navigeren zodra de wissel doorgekomen is. Meteen na
 * `setCurrentTenant` navigeren zou de bestemming één render lang met de oude
 * tenant tonen.
 *
 * Rendert niets. Op web doet de listener niets.
 */
export function PushTapListener() {
  const navigate = useNavigate();
  const { currentTenant, tenants, setCurrentTenant } = useTenant();
  const pending = useRef<PushTapTarget | null>(null);

  // Refs zodat de listener één keer registreert en toch altijd de actuele
  // waarden ziet. Dat geldt ook voor setCurrentTenant: in useTenant is dat een
  // gewone functie die elke render opnieuw ontstaat. Als effect-dependency zou
  // hij de listener bij élke render afbreken en opnieuw registreren — en een
  // bewaard tap-event van een koude start kan precies in dat gat vallen.
  const tenantsRef = useRef(tenants);
  const currentRef = useRef(currentTenant);
  const setTenantRef = useRef(setCurrentTenant);
  tenantsRef.current = tenants;
  currentRef.current = currentTenant;
  setTenantRef.current = setCurrentTenant;

  useEffect(
    () =>
      initPushNotificationTaps((target) => {
        const active = currentRef.current;

        if (!target.tenantId || target.tenantId === active?.id) {
          navigate(target.path);
          return;
        }

        const tenant = tenantsRef.current.find((t) => t.id === target.tenantId);
        if (!tenant) {
          // Geen toegang (meer) tot die tenant: dan ook niet naar een
          // tenant-gebonden pagina. Het dashboard is de veilige landing.
          console.info('[push] melding voor een tenant zonder toegang — naar dashboard');
          navigate('/admin');
          return;
        }

        pending.current = target;
        setTenantRef.current(tenant);
      }),
    [navigate],
  );

  useEffect(() => {
    const target = pending.current;
    if (target && currentTenant?.id === target.tenantId) {
      pending.current = null;
      navigate(target.path);
    }
  }, [currentTenant?.id, navigate]);

  return null;
}
