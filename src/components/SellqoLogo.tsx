import { useTheme } from 'next-themes';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import logoIcon from '@/assets/logo-icon.png';
import logoTagline from '@/assets/logo-tagline.png';
import logoWordmark from '@/assets/logo-wordmark.png';
import { useTranslation } from 'react-i18next';

interface SellqoLogoProps {
  variant?: 'full' | 'icon' | 'tagline';
  className?: string;
  width?: number;
  /** Altijd de versie voor een donkere achtergrond (bv. de donkere hero). */
  onDark?: boolean;
}

export function SellqoLogo({ variant = 'full', className = '', width, onDark = false }: SellqoLogoProps) {
  const { resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const tagline = t('auth.tagline');
  
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
    // LOGO-I18N-1: de tagline zit in de NL-afbeelding gebakken. Voor de andere talen
    // tekenen we dezelfde opbouw (woordmerk links, twee regels rechts) als SVG,
    // zodat hij net zo meeschaalt als de afbeelding.
    if (!i18n.language?.startsWith('nl')) {
      const [line1, ...rest] = tagline.split(/(?<=\.)\s+/);
      const line2 = rest.join(' ');
      // Breedte schatten (±56 eenheden per teken bij deze korps); de viewBox groeit mee.
      const longest = Math.max(line1.length, line2.length);
      const vbWidth = Math.max(1920, 1089 + longest * 56 + 75);
      return (
        <svg
          viewBox={`0 0 ${vbWidth} 960`}
          role="img"
          aria-label={`Sellqo - ${tagline}`}
          className={className}
          style={width ? { width: `${width * (vbWidth / 1920)}px`, height: 'auto' } : undefined}
        >
          <image href={logoWordmark} x={75} y={268} width={881} height={354} />
          <g fill="#0a1f58" fontWeight={700} fontSize={106} fontFamily="Poppins, Inter, Arial, sans-serif">
            <text x={1089} y={448}>{line1}</text>
            {line2 && <text x={1089} y={566}>{line2}</text>}
          </g>
        </svg>
      );
    }
    return (
      <img 
        src={logoTagline} 
        alt={`Sellqo - ${tagline}`} 
        className={className}
        style={width ? { width: `${width}px`, height: 'auto' } : undefined}
      />
    );
  }
  
  const logoSrc = onDark || resolvedTheme === 'dark' ? logoDark : logoLight;
  
  return (
    <img 
      src={logoSrc} 
      alt={`Sellqo - ${tagline}`} 
      className={className}
      style={width ? { width: `${width}px`, height: 'auto' } : undefined}
    />
  );
}
