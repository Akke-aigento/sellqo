import { Link } from 'react-router-dom';
import { ArrowRight, Play, Check, TrendingUp, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { HeroDashboardMockup } from './HeroDashboardMockup';

const trustBadges = [
  { icon: Check, text: 'Geen creditcard nodig' },
  { icon: Check, text: '14 dagen gratis proberen' },
  { icon: Check, text: 'In 5 minuten live' },
  { icon: Check, text: 'Nederlandse support' },
];

const floatingCards = [
  { icon: TrendingUp, text: '€12.453 omzet', color: 'bg-green-500' },
  { icon: Sparkles, text: 'AI genereert content', color: 'bg-purple-500' },
  { icon: Gift, text: '8 promotietypen', color: 'bg-accent' },
];

export function HeroSection() {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });

  const handleDemoScroll = () => {
    document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
      {/* Background gradient - enhanced navy to lighter blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 -z-10" />
      
      {/* Abstract shapes - stronger */}
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />

      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'grid lg:grid-cols-2 gap-12 lg:gap-16 items-center',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          {/* Left column - Text content */}
          <div className="text-center lg:text-left">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
              <span className="gradient-text">Jouw Online Imperium,</span>
              <br />
              <span className="text-foreground">Volledig Onder Controle</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Het complete e-commerce platform dat verkopen, voorraad, financiën en groei samenbrengt. 
              Speciaal gebouwd voor ondernemers in België en Nederland.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <Button
                size="lg"
                asChild
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-4 px-8 h-auto min-h-[44px] shadow-lg hover:shadow-xl hover:brightness-110 transition-all rounded-lg"
              >
                <Link to="/auth?mode=register" className="flex items-center gap-2">
                  Start 14 Dagen Gratis
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleDemoScroll}
                className="text-lg py-4 px-8 h-auto min-h-[44px] border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all rounded-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Bekijk Live Demo
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2">
              {trustBadges.map((badge, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <badge.icon className="w-4 h-4 text-green-500" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column - Dashboard mockup */}
          <div className="relative">
            {/* Main dashboard mockup */}
            <div className="relative animate-float">
              <HeroDashboardMockup />
            </div>

            {/* Floating cards */}
            {floatingCards.map((card, index) => (
              <div
                key={index}
                className={cn(
                  'absolute bg-card rounded-xl shadow-lg border border-border p-3 flex items-center gap-3',
                  'animate-float-delayed',
                  index === 0 && '-top-4 -left-4 md:-left-8',
                  index === 1 && 'top-1/2 -right-4 md:-right-8',
                  index === 2 && '-bottom-4 left-8'
                )}
                style={{ animationDelay: `${index * 0.5}s` }}
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.color)}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-sm whitespace-nowrap">{card.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
