import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Zap, Brain, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const icons = [LayoutDashboard, Zap, Brain, Globe];

export function SolutionOverviewSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const { t } = useTranslation();
  const items = t('landing.solution.items', { returnObjects: true }) as Array<{ title: string; desc: string }>;

  return (
    <section className="pt-8 md:pt-10 pb-16 md:pb-20 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.solution.heading')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.solution.subheading')}
          </p>
        </div>

        <div
          className={cn(
            'grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          {items.map((solution, index) => {
            const Icon = icons[index];
            return (
            <div
              key={index}
              className="p-5 md:p-6 bg-card rounded-2xl border border-border shadow-sellqo hover:shadow-sellqo-lg hover:-translate-y-1 transition-all duration-300 text-center"
            >
              <div className="w-14 h-14 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{solution.title}</h3>
              <p className="text-sm text-muted-foreground">{solution.desc}</p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
