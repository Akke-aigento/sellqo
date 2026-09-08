import logoIcon from '@/assets/logo-icon.png';

interface LogoLoaderProps {
  /** Breedte en hoogte van het pictogram in pixels. */
  size?: number;
  /** Vult het scherm (standaard). Zet uit voor gebruik binnen een kaart of paneel. */
  fullscreen?: boolean;
  className?: string;
}

/**
 * Laad-indicator met het SellQo-pictogram.
 *
 * Vervangt de generieke spinner op de schermen die een tenant als eerste ziet.
 * Kost niets extra: `logo-icon.png` zit al in de bundel via SellqoLogo, dus dit
 * hergebruikt dezelfde asset-URL.
 *
 * Het pictogram wordt bewust decoratief opgehangen (`alt=""` + `aria-hidden`).
 * Een schermlezer die bij elke paginaload "Sellqo afbeelding" voorleest is ruis,
 * geen informatie — daarom ook niet SellqoLogo, die `alt="Sellqo"` vastzet.
 *
 * Beide animaties staan achter `motion-safe:`, dus wie
 * `prefers-reduced-motion: reduce` heeft ingesteld krijgt een stilstaand logo.
 * Ze zitten op verschillende elementen omdat ze allebei `animation` zetten.
 */
export function LogoLoader({ size = 96, fullscreen = true, className = '' }: LogoLoaderProps) {
  const classes = [
    'flex items-center justify-center',
    fullscreen ? 'min-h-dvh bg-background' : '',
    'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="status" className={classes}>
      <img
        src={logoIcon}
        alt=""
        aria-hidden="true"
        // De bron is vierkant (200×200). Expliciete maten voorkomen dat het
        // scherm verspringt zodra de PNG binnen is.
        width={size}
        height={size}
        className="motion-safe:animate-logo-pulse"
      />
    </div>
  );
}
