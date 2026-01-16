import { useTheme } from 'next-themes';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import logoIcon from '@/assets/logo-icon.png';

interface SellqoLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
}

export function SellqoLogo({ variant = 'full', className = '' }: SellqoLogoProps) {
  const { resolvedTheme } = useTheme();
  
  if (variant === 'icon') {
    return (
      <img 
        src={logoIcon} 
        alt="Sellqo" 
        className={`h-8 w-8 ${className}`}
      />
    );
  }
  
  const logoSrc = resolvedTheme === 'dark' ? logoDark : logoLight;
  
  return (
    <img 
      src={logoSrc} 
      alt="Sellqo - Jouw webshop. Simpel online." 
      className={`h-8 w-auto ${className}`}
    />
  );
}
