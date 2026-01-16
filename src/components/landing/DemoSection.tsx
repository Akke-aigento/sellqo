import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DemoSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section id="demo" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Zie SellQo In Actie
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Bekijk hoe SellQo jouw e-commerce workflow transformeert in een naadloze ervaring.
          </p>
        </div>

        <div
          className={cn(
            'max-w-4xl mx-auto',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          <div className="relative aspect-video bg-card rounded-2xl border border-border shadow-sellqo-lg overflow-hidden group">
            {/* Video placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full w-20 h-20 p-0 shadow-lg group-hover:scale-110 transition-transform"
              >
                <Play className="w-8 h-8 ml-1" />
              </Button>
            </div>
            
            {/* Mock dashboard screenshot */}
            <div className="absolute inset-4 bg-card/50 rounded-xl backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground mb-2">Demo Video</p>
                <p className="text-sm text-muted-foreground">Klik om te bekijken</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
