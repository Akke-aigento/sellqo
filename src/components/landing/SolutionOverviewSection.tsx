import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Zap, Brain, Globe } from 'lucide-react';

const solutions = [
  {
    icon: LayoutDashboard,
    title: 'Alles In Één Dashboard',
    description: 'Eén plek voor al je verkoopkanalen, voorraad en klanten.',
  },
  {
    icon: Zap,
    title: 'Live In 5 Minuten',
    description: 'Geen technische kennis nodig. Setup wizard doet het werk.',
  },
  {
    icon: Brain,
    title: 'AI Die Meedenkt',
    description: 'Proactief advies, niet alleen rapporten achteraf.',
  },
  {
    icon: Globe,
    title: 'Gebouwd Voor Jou',
    description: 'Peppol, BTW, lokale betaalmethoden - alles ingebakken.',
  },
];

export function SolutionOverviewSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            SellQo Maakt Het Anders
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Eén platform dat alles combineert wat je nodig hebt om te groeien.
          </p>
        </div>

        <div
          className={cn(
            'grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          {solutions.map((solution, index) => (
            <div
              key={index}
              className="p-5 md:p-6 bg-card rounded-2xl border border-border shadow-sellqo hover:shadow-sellqo-lg hover:-translate-y-1 transition-all duration-300 text-center"
            >
              <div className="w-14 h-14 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
                <solution.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{solution.title}</h3>
              <p className="text-sm text-muted-foreground">{solution.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
