import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that scrolls to the top of the page on route change.
 * Should be placed inside BrowserRouter.
 * 
 * This ensures users always start at the top of a page when navigating,
 * improving UX across admin, marketing, and storefront pages.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
