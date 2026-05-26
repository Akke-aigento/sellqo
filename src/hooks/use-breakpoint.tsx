import * as React from "react";

const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export function useBreakpoint(breakpoint: Breakpoint) {
  const [matches, setMatches] = React.useState<boolean>(false);

  React.useEffect(() => {
    const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return matches;
}

export type ViewMode = "mobile" | "compact" | "full";

// Helper: returns 'mobile' | 'compact' | 'full'
export function useViewMode(): ViewMode {
  const isMd = useBreakpoint("md");
  const isLg = useBreakpoint("lg");
  if (!isMd) return "mobile"; // <768px phone
  if (!isLg) return "compact"; // 768-1024px narrow desktop/tablet
  return "full"; // >=1024px
}