import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { ArrowDown, RefreshCw, BarChart3, Clock } from 'lucide-react';
const problems = [{
  icon: RefreshCw,
  emoji: '🔄',
  title: 'Constant schakelen tussen 5+ platforms',
  description: 'Shopify voor je webshop, Excel voor voorraad, QuickBooks voor facturen, Mailchimp voor marketing...'
}, {
  icon: BarChart3,
  emoji: '📊',
  title: 'Geen idee wat je echte winst is',
  description: 'Verkoopkosten, retouren, verzending... Je weet het allemaal wel ongeveer, maar niet exact.'
}, {
  icon: Clock,
  emoji: '⏰',
  title: 'Uren kwijt aan administratie',
  description: 'Handmatig bestellingen invoeren, voorraad bijwerken, facturen maken... tijd die je niet hebt.'
}];
export function ProblemSection() {
  const {
    ref,
    isIntersecting
  } = useIntersectionObserver();
  return <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div ref={ref} className={cn('text-center mb-16', isIntersecting ? 'animate-fade-in-up' : 'opacity-0')}>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Herken Je Dit? <span className="inline-block">😫</span>
          </h2>
        </div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-16">
          {problems.map((problem, index) => <div key={index} className={cn('p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo hover:shadow-sellqo-lg transition-all duration-300 hover:-translate-y-1', isIntersecting ? 'animate-fade-in-up' : 'opacity-0')} style={{
          animationDelay: `${index * 0.1}s`
        }}>
              <div className="text-4xl mb-4">{problem.emoji}</div>
              <h3 className="text-xl font-bold text-foreground mb-3">{problem.title}</h3>
              <p className="text-muted-foreground">{problem.description}</p>
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