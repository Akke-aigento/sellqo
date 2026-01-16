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

export function SellqoLogo({ variant = 'full', className = '', width }: SellqoLogoProps) {
  const { resolvedTheme } = useTheme();
  
  if (variant === 'icon') {
    return (
      <img 
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
      src={logoSrc} 
      alt="Sellqo - Jouw webshop. Simpel online." 
      className={className}
      style={width ? { width: `${width}px`, height: 'auto' } : undefined}
    />
  );
}
