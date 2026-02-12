import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUsageLimits } from '@/hooks/useUsageLimits';

interface AIUpsellHintProps {
  className?: string;
}

/**
 * Subtiele upsell hint voor tenants zonder AI-pakket.
 * Wordt getoond na het handmatig invullen van beschrijvende tekstvelden.
 */
export function AIUpsellHint({ className }: AIUpsellHintProps) {
  const { checkFeature } = useUsageLimits();

  // Only show if tenant does NOT have AI
  if (checkFeature('ai_copywriting')) return null;

  return (
    <div className={className}>
      <Link
        to="/admin/settings/billing"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
      >
        <Sparkles className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
        <span>Wist je dat AI je teksten automatisch kan schrijven?</span>
        <span className="underline">Ontdek het AI-pakket</span>
      </Link>
    </div>
  );
}
