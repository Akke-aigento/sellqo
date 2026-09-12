import { useCallback } from 'react';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { canWithRoles, type Resource } from '@/hooks/useCan';
import { WAREHOUSE_ALLOWED_ITEMS, type NavItem } from './sidebarConfig';

/**
 * Wie mag welk navigatie-item zien.
 *
 * Deze regels stonden tot 12 september 2026 alleen in `AdminSidebar`, en de
 * mobiele onderbalk paste ze helemaal niet toe — geen rol, geen abonnement,
 * geen page-override. Die balk toonde dus tabs waar de gebruiker niets te
 * zoeken had, en bij Inbox was dat een echt gat: `inbox.read` sluit warehouse
 * en accountant uit, maar de route had geen guard.
 *
 * Ze staan hier los zodat er één definitie is voor beide weergaven. Kopiëren
 * was geen optie: twee kopieën van zichtbaarheidsregels lopen na de eerste
 * wijziging uit elkaar, en dat merkt niemand tot een tab ergens naartoe leidt
 * waar hij niet hoort.
 */
export function useNavItemVisibility() {
  const { isPlatformAdmin, userRole, isWarehouse, roles } = useAuth();
  const { currentTenant } = useTenant();
  const { isItemHidden } = useSidebarPreferences();
  const { isPageHidden, isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  const { isAdminView } = usePlatformViewMode();

  // H4a — whitelist via permissie-matrix. Filter rollen per-tenant (matcht
  // useCan H4-5 hardening) en evalueer `requireRead` per item.
  const scopedRoles = (roles ?? [])
    .filter((r) => {
      if (r.role === 'platform_admin') return true;
      if (r.tenant_id == null) return true;
      if (!currentTenant?.id) return false;
      return r.tenant_id === currentTenant.id;
    })
    .map((r) => r.role as AppRole);

  const isResourceHidden = useCallback(
    (resource?: Resource): boolean => {
      if (!resource) return false;
      return !canWithRoles(scopedRoles, 'read', resource);
    },
    [scopedRoles],
  );

  /** Verborgen omdat het abonnement de functie niet bevat. */
  const isItemFeatureHidden = useCallback(
    (item: NavItem): boolean => {
      if (!item.featureKey) return false;
      // Platform admins in admin view see everything
      if (isPlatformAdmin && isAdminView) return false;
      // If feature is explicitly granted by admin, show it
      if (isFeatureGranted(item.featureKey)) return false;

      const features = subscription?.pricing_plan?.features;
      if (!features) return true; // No subscription = hide premium features
      return features[item.featureKey as keyof typeof features] !== true;
    },
    [isPlatformAdmin, isAdminView, isFeatureGranted, subscription],
  );

  /** Blokkeert het abonnement dit item? Voor het slotje in de sidebar. */
  const isItemSubscriptionBlocked = useCallback(
    (item: NavItem): boolean => {
      if (!item.featureKey) return false;
      const features = subscription?.pricing_plan?.features;
      if (!features) return true;
      return features[item.featureKey as keyof typeof features] !== true;
    },
    [subscription],
  );

  /** Verborgen op grond van de rol van de gebruiker. */
  const isItemRoleHidden = useCallback(
    (item: NavItem): boolean => {
      // Warehouse users can only see specific items
      if (isWarehouse) {
        const isAllowed = WAREHOUSE_ALLOWED_ITEMS.includes(item.id);
        const isExcluded = item.excludeRoles?.includes('warehouse');
        return !isAllowed || isExcluded === true;
      }
      // allowedRoles: als gevuld, mag alleen die rol het zien
      if (item.allowedRoles && item.allowedRoles.length > 0) {
        if (!userRole || !item.allowedRoles.includes(userRole)) return true;
      }
      // excludeRoles: staat de rol erin, dan verbergen
      if (item.excludeRoles && item.excludeRoles.length > 0) {
        if (userRole && item.excludeRoles.includes(userRole)) return true;
      }
      return false;
    },
    [isWarehouse, userRole],
  );

  /** Verborgen doordat de tenant de pagina heeft uitgezet. */
  const isItemPageOverridden = useCallback(
    (item: NavItem): boolean => {
      if (isPlatformAdmin && isAdminView) return false;
      return isPageHidden(item.id);
    },
    [isPlatformAdmin, isAdminView, isPageHidden],
  );

  /**
   * Mag deze gebruiker hier überhaupt komen?
   *
   * Rol, abonnement, permissie-matrix en tenant-overrides — alles wat een
   * harde grens is. Bewust zónder de persoonlijke sidebar-voorkeuren: die
   * bestaan om een lange zijbalk op te ruimen, niet om toegang te regelen.
   * Voor een vaste balk van vier snelkoppelingen zou het bovendien raar
   * uitpakken als een item daar verdween omdat iemand ooit zijn zijbalk heeft
   * opgeschoond.
   */
  const isItemBlocked = useCallback(
    (item: NavItem): boolean =>
      isResourceHidden(item.requireRead) ||
      isItemRoleHidden(item) ||
      isItemFeatureHidden(item) ||
      isItemPageOverridden(item),
    [isResourceHidden, isItemRoleHidden, isItemFeatureHidden, isItemPageOverridden],
  );

  /** `isItemBlocked` plus de persoonlijke voorkeuren. Voor de zijbalk. */
  const shouldHideItem = useCallback(
    (item: NavItem): boolean => isItemHidden(item.id) || isItemBlocked(item),
    [isItemHidden, isItemBlocked],
  );

  return {
    shouldHideItem,
    isItemBlocked,
    isItemSubscriptionBlocked,
  };
}
