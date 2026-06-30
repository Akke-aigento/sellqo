import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Store, Package, TrendingUp, FileText, Sparkles, Gift, Check, Search, MessageSquare, Paintbrush } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FeatureMeta {
  icon: LucideIcon;
  gridSpan: 1 | 2;
}
interface FeatureCopy {
  title: string;
  subtitle: string;
  desc: string;
  badge?: string;
  list?: string[];
}

const featureMeta: FeatureMeta[] = [
  { icon: Store, gridSpan: 2 },
  { icon: Package, gridSpan: 1 },
  { icon: Sparkles, gridSpan: 2 },
  { icon: Search, gridSpan: 1 },
  { icon: Gift, gridSpan: 2 },
  { icon: FileText, gridSpan: 1 },
  { icon: MessageSquare, gridSpan: 1 },
  { icon: Paintbrush, gridSpan: 1 },
  { icon: TrendingUp, gridSpan: 1 },
];

interface FeatureCardProps {
  copy: FeatureCopy;
  meta: FeatureMeta;
  index: number;
  isIntersecting: boolean;
}

function FeatureCard({ copy, meta, index, isIntersecting }: FeatureCardProps) {
  const Icon = meta.icon;
  
  return (
    <div
      className={cn(
        'group p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo',
        'hover:shadow-sellqo-lg hover:-translate-y-1 transition-all duration-300',
        'flex flex-col h-full',
        meta.gridSpan === 2 && 'lg:col-span-2',
        isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
      )}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">{copy.subtitle}</p>
          <h3 className="text-xl font-bold text-foreground">{copy.title}</h3>
        </div>
      </div>
      
      <p className="text-muted-foreground mb-4 flex-grow">{copy.desc}</p>
      
      {copy.list && (
        <ul className="space-y-2 mb-4">
          {copy.list.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
      
      {copy.badge && (
        <div className="mt-auto pt-2">
          <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
            {copy.badge}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function FeaturesSection() {
  const { ref, isIntersecting } = useIntersectionObserver();
  const { t } = useTranslation();
  const items = t('landing.features.items', { returnObjects: true }) as FeatureCopy[];

  return (
    <section id="features" className="pt-12 pb-20 md:pt-16 md:pb-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.features.heading')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.features.subheading')}
          </p>
        </div>

        {/* Bento Grid - Structured Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((copy, index) => (
            <FeatureCard
              key={index}
              copy={copy}
              meta={featureMeta[index]}
              index={index}
              isIntersecting={isIntersecting}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
