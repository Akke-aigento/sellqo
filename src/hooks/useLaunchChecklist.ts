import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { useLegalPages } from '@/hooks/useLegalPages';
import { useShippingMethods } from '@/hooks/useShippingMethods';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
  /** Waar de tenant heen moet om dit af te ronden. */
  target: { kind: 'section'; section: string } | { kind: 'route'; href: string };
}

/**
 * De launch-checklist van de Shop Studio.
 *
 * Leest uitsluitend bestaande bronnen; schrijft niets. Elk item is bewust
 * "is er iets ingevuld" en niet "is het goed ingevuld" — de checklist is een
 * wegwijzer, geen keuring.
 */
export function useLaunchChecklist() {
  const { themeSettings, sections, pages } = useStorefront();
  const { currentTenant } = useTenant();
  const { canonicalDomain } = useTenantDomains();
  const { legalPages } = useLegalPages();
  const { shippingMethods } = useShippingMethods();

  // `payment_methods_enabled` staat niet op het gedeelde Tenant-type; dat type
  // verbreden zou veel meer raken dan deze checklist. Daarom apart opgehaald.
  const { data: enabledPaymentMethods = [] } = useQuery({
    queryKey: ['tenant-payment-methods', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('tenants')
        .select('payment_methods_enabled')
        .eq('id', currentTenant.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.payment_methods_enabled ?? []) as string[];
    },
    enabled: !!currentTenant?.id,
  });

  const items = useMemo<ChecklistItem[]>(() => {
    const hasLogo = !!(themeSettings?.logo_url || currentTenant?.logo_url);
    const hasDesign = !!(themeSettings?.theme_id || themeSettings?.brand_color);
    const hasHomepage = sections.some((s) => s.is_visible);
    const hasPages = pages.length > 0;
    const hasLegal = legalPages.some((p) => p.is_published);
    const hasPayment = enabledPaymentMethods.length > 0;
    const hasShipping = shippingMethods.some((m) => m.is_active);
    const hasDomain = !!canonicalDomain;

    return [
      {
        id: 'logo',
        label: 'Logo',
        description: 'Je merk herkenbaar in de winkel',
        done: hasLogo,
        target: { kind: 'section', section: 'design' },
      },
      {
        id: 'design',
        label: 'Design',
        description: 'Kleuren, typografie en layout gekozen',
        done: hasDesign,
        target: { kind: 'section', section: 'design' },
      },
      {
        id: 'homepage',
        label: 'Homepage',
        description: 'Minstens één zichtbare sectie',
        done: hasHomepage,
        target: { kind: 'section', section: 'homepage' },
      },
      {
        id: 'pages',
        label: "Pagina's",
        description: 'Bijvoorbeeld Over ons of Contact',
        done: hasPages,
        target: { kind: 'section', section: 'pages' },
      },
      {
        id: 'legal',
        label: 'Juridische pagina’s',
        description: 'Voorwaarden en privacy gepubliceerd',
        done: hasLegal,
        target: { kind: 'section', section: 'legal' },
      },
      {
        id: 'payment',
        label: 'Betaalmethode',
        description: 'Klanten kunnen afrekenen',
        done: hasPayment,
        target: { kind: 'route', href: '/admin/settings?section=payments' },
      },
      {
        id: 'shipping',
        label: 'Verzending',
        description: 'Minstens één actieve verzendmethode',
        done: hasShipping,
        target: { kind: 'route', href: '/admin/shipping' },
      },
      {
        id: 'domain',
        label: 'Domein',
        description: 'Een geverifieerd eigen domein',
        done: hasDomain,
        target: { kind: 'route', href: '/admin/settings?section=domain' },
      },
    ];
  }, [
    themeSettings,
    currentTenant,
    sections,
    pages,
    legalPages,
    shippingMethods,
    canonicalDomain,
    enabledPaymentMethods,
  ]);

  const completed = items.filter((i) => i.done).length;

  return {
    items,
    completed,
    total: items.length,
    /** Alles behalve het domein — een winkel kan prima live op de /shop-URL. */
    isReadyToLaunch: items.every((i) => i.done || i.id === 'domain'),
  };
}
