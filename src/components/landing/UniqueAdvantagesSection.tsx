import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Zap, Activity, Bot, MessageSquare, Wallet, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

const icons = [Zap, Activity, Bot, MessageSquare, Wallet, Inbox];
const emojis = ['⚡', '📊', '🤖', '💬', '💸', '📬'];

export function UniqueAdvantagesSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const { t } = useTranslation();
  const items = t('landing.unique.items', { returnObjects: true }) as Array<{ title: string; desc: string; highlight: string }>;

  return (
    <section id="why-sellqo" className="py-20 md:py-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <Badge variant="secondary" className="mb-4 bg-accent/10 text-accent border-accent/20">
            {t('landing.unique.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.unique.heading')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.unique.subheading')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {items.map((advantage, index) => {
            const Icon = icons[index];
            return (
            <div
              key={index}
              className={cn(
                'group p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo',
                'hover:shadow-sellqo-lg hover:-translate-y-1 transition-all duration-300',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-2xl">{emojis[index]}</span>
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-3">{advantage.title}</h3>
              <p className="text-muted-foreground mb-4">{advantage.desc}</p>
              
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                {advantage.highlight}
              </Badge>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
