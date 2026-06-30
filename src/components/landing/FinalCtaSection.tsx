import { Link } from 'react-router-dom';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Sparkles, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function FinalCtaSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const { t } = useTranslation();

  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-primary to-[hsl(200,50%,30%)] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 border border-white rounded-full" />
        <div className="absolute bottom-20 right-20 w-48 h-48 border border-white rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 border border-white rounded-full" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div
          ref={ref}
          className={cn(
            'text-center max-w-3xl mx-auto',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            {t('landing.finalCta.heading')}
          </h2>
          
          <p className="text-lg md:text-xl text-white/80 mb-10">
            {t('landing.finalCta.subheading')}
          </p>

          <Button
            size="lg"
            asChild
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all"
          >
            <Link to="/auth?mode=register" className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('landing.finalCta.cta')}
            </Link>
          </Button>

          <p className="text-white/60 mt-6 text-sm">
            {t('landing.finalCta.trust')}
          </p>

          {/* Trust badges */}
          <div className="flex justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Shield className="w-4 h-4" />
              <span>{t('landing.finalCta.ssl')}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Lock className="w-4 h-4" />
              <span>{t('landing.finalCta.gdpr')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
