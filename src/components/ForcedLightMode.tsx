import { useTheme } from 'next-themes';
import { useEffect, ReactNode } from 'react';

interface ForcedLightModeProps {
  children: ReactNode;
}

/**
 * Wrapper component that forces light mode for public/marketing pages.
 * Restores the user's preferred theme when unmounting (navigating to admin).
 */
export function ForcedLightMode({ children }: ForcedLightModeProps) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Store the current theme before forcing light mode
    const previousTheme = theme;
    
    // Force light mode
    setTheme('light');
    
    // Restore the previous theme when unmounting
    return () => {
      if (previousTheme && previousTheme !== 'light') {
        setTheme(previousTheme);
      }
    };
  }, []); // Only run on mount/unmount

  return <>{children}</>;
}
