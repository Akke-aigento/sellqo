export function useSidebarPreferences() { return { hiddenItems: [], bottomNav: null, isLoading: false, preferences: null }; }
export function useTenantPageOverrides() { return { isPageHidden: () => false, togglePage: () => {}, isToggling: false, isFeatureGranted: () => false, toggleGrantedFeature: () => {}, isTogglingFeature: false }; }
export function usePlatformViewMode() { return { isAdminView: false }; }
export function SidebarCustomizeDialog() { return null; }
export function InboxBadge() { return null; }
export function AdsAiBadge() { return null; }
