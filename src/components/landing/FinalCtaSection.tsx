import { Link } from 'react-router-dom';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Sparkles, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FinalCtaSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

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
            Klaar Om Je E-commerce Naar Het Volgende Level Te Tillen?
          </h2>
          
          <p className="text-lg md:text-xl text-white/80 mb-10">
            Sluit je aan bij 500+ ondernemers die hun business laten groeien met SellQo
          </p>

          <Button
            size="lg"
            asChild
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all"
          >
            <Link to="/auth?mode=register" className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Start Je Gratis Proefperiode
            </Link>
          </Button>

          <p className="text-white/60 mt-6 text-sm">
            Geen creditcard nodig • 14 dagen volledig gratis • Annuleer wanneer je wilt
          </p>

          {/* Trust badges */}
          <div className="flex justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Shield className="w-4 h-4" />
              <span>SSL Beveiligd</span>
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Lock className="w-4 h-4" />
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
