import { Shield, Truck, RefreshCw, CreditCard, Lock, Award } from 'lucide-react';

interface TrustBadgesProps {
  badges: string[];
  variant?: 'footer' | 'checkout';
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  'veilig_betalen': <Lock className="h-5 w-5" />,
  'gratis_verzending': <Truck className="h-5 w-5" />,
  'gratis_retour': <RefreshCw className="h-5 w-5" />,
  'ssl_beveiligd': <Shield className="h-5 w-5" />,
  'ideal': <CreditCard className="h-5 w-5" />,
  'keurmerk': <Award className="h-5 w-5" />,
};

const BADGE_LABELS: Record<string, string> = {
  'veilig_betalen': 'Veilig Betalen',
  'gratis_verzending': 'Gratis Verzending',
  'gratis_retour': 'Gratis Retour',
  'ssl_beveiligd': 'SSL Beveiligd',
  'ideal': 'iDEAL',
  'keurmerk': 'Keurmerk',
};

export function TrustBadges({ badges, variant = 'footer' }: TrustBadgesProps) {
  if (!badges || badges.length === 0) return null;

  if (variant === 'checkout') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 py-3 border-t mt-4">
        {badges.map(badge => (
          <div key={badge} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {BADGE_ICONS[badge] || <Shield className="h-4 w-4" />}
            <span>{BADGE_LABELS[badge] || badge}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-4">
      {badges.map(badge => (
        <div key={badge} className="flex flex-col items-center gap-1.5 text-muted-foreground">
          <div className="p-2 rounded-full bg-primary/10 text-primary">
            {BADGE_ICONS[badge] || <Shield className="h-5 w-5" />}
          </div>
          <span className="text-xs font-medium">{BADGE_LABELS[badge] || badge}</span>
        </div>
      ))}
    </div>
  );
}