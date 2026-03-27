import { forwardRef } from 'react';
import { useTheme } from 'next-themes';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import logoIcon from '@/assets/logo-icon.png';
import logoTagline from '@/assets/logo-tagline.png';

interface SellqoLogoProps {
  variant?: 'full' | 'icon' | 'tagline';
  className?: string;
  width?: number;
}

export const SellqoLogo = forwardRef<HTMLImageElement, SellqoLogoProps>(
  ({ variant = 'full', className = '', width }, ref) => {
    const { resolvedTheme } = useTheme();
    
    if (variant === 'icon') {
      return (
        <img 
          ref={ref}
          src={logoIcon} 
          alt="Sellqo" 
          className={className}
          style={width ? { width: `${width}px`, height: 'auto' } : undefined}
        />
      );
    }

    if (variant === 'tagline') {
      return (
        <img 
          ref={ref}
          src={logoTagline} 
          alt="Sellqo - Jouw webshop. Simpel online." 
          className={className}
          style={width ? { width: `${width}px`, height: 'auto' } : undefined}
        />
      );
    }
    
    const logoSrc = resolvedTheme === 'dark' ? logoDark : logoLight;
    
    return (
      <img 
        ref={ref}
        src={logoSrc} 
        alt="Sellqo - Jouw webshop. Simpel online." 
        className={className}
        style={width ? { width: `${width}px`, height: 'auto' } : undefined}
      />
    );
  }
);

SellqoLogo.displayName = 'SellqoLogo';
