import { useStorefront } from '@/hooks/useStorefront';

/**
 * Frontend mode: SellQo built-in storefront vs custom (headless) frontend.
 * Used to conditionally show "Alleen SellQo-frontend" hints/banners.
 */
export function useFrontendMode() {
  const { themeSettings } = useStorefront();
  const isCustomFrontend = !!themeSettings?.use_custom_frontend;
  return {
    isCustomFrontend,
    isSellqoFrontend: !isCustomFrontend,
    customFrontendUrl: themeSettings?.custom_frontend_url ?? null,
  };
}