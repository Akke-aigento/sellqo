import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import React from 'react';

type ViewMode = 'admin' | 'tenant';

interface PlatformViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdminView: boolean;
}

const PlatformViewModeContext = createContext<PlatformViewModeContextType>({
  viewMode: 'admin',
  setViewMode: () => {},
  isAdminView: true,
});

export function PlatformViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      return (sessionStorage.getItem('platform_view_mode') as ViewMode) || 'admin';
    } catch {
      return 'admin';
    }
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      sessionStorage.setItem('platform_view_mode', mode);
    } catch {}
  }, []);

  return React.createElement(
    PlatformViewModeContext.Provider,
    { value: { viewMode, setViewMode, isAdminView: viewMode === 'admin' } },
    children
  );
}

export function usePlatformViewMode() {
  return useContext(PlatformViewModeContext);
}
