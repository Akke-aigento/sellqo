import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { ArrowDown, RefreshCw, BarChart3, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const emojis = ['🔄', '📊', '⏰'];
const icons = [RefreshCw, BarChart3, Clock];

export function ProblemSection() {
  const {
    ref,
    isIntersecting
  } = useIntersectionObserver();
  const { t } = useTranslation();
  const items = t('landing.problem.items', { returnObjects: true }) as Array<{ title: string; desc: string }>;
  return <section className="pt-20 md:pt-28 pb-8 md:pb-12 bg-background">
      <div className="container mx-auto px-4">
        <div ref={ref} className={cn('text-center mb-16', isIntersecting ? 'animate-fade-in-up' : 'opacity-0')}>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.problem.heading')} <span className="inline-block">😫</span>
          </h2>
        </div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-16">
          {items.map((problem, index) => <div key={index} className={cn('p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo hover:shadow-sellqo-lg transition-all duration-300 hover:-translate-y-1', isIntersecting ? 'animate-fade-in-up' : 'opacity-0')} style={{
          animationDelay: `${index * 0.1}s`
        }}>
              <div className="text-4xl mb-4">{emojis[index]}</div>
              <h3 className="text-xl font-bold text-foreground mb-3">{problem.title}</h3>
              <p className="text-muted-foreground">{problem.desc}</p>
            </div>)}
        </div>

        {/* Transition arrow */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
            <ArrowDown className="w-6 h-6 text-primary" />
          </div>
          
        </div>
      </div>
    </section>;
}