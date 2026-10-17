// PLANS-2 — zet de prijzen uit de database als globale i18next-variabelen (zie src/lib/priceVars.ts).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { usePlatformAddons } from '@/hooks/usePlatformAddons';
import { buildPriceVars } from '@/lib/priceVars';

export function PriceVarsSync() {
  const { i18n } = useTranslation();
  const { plans } = usePricingPlans();
  const { addons } = usePlatformAddons();
  const lng = i18n.language;
  const emitted = useRef<string>('');

  useEffect(() => {
    if (!plans.length) return;
    const vars = buildPriceVars(plans as never, addons, lng);
    const interpolation = (i18n.options.interpolation ??= {});
    interpolation.defaultVariables = { ...(interpolation.defaultVariables ?? {}), ...vars };
    const key = `${lng}:${JSON.stringify(vars)}`;
    if (emitted.current === key) return;
    // Eén tik later opnieuw tekenen, zodat ook componenten uit dezelfde render al
    // ingeschreven zijn. Pas na het signaal als "verstuurd" markeren (StrictMode-veilig).
    const id = window.setTimeout(() => {
      emitted.current = key;
      i18n.emit('languageChanged', lng);
    }, 0);
    return () => window.clearTimeout(id);
  }, [plans, addons, lng, i18n]);

  return null;
}
