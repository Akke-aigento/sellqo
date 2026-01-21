import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { 
  ShoppingCart, 
  Monitor, 
  Globe, 
  Package,
  Sparkles,
  Mail,
  Heart,
  Gift,
  FileText,
  Calculator,
  Send,
  Receipt,
  BarChart3,
  Search,
  FileBarChart,
  Lightbulb
} from 'lucide-react';

const moduleCategories = [
  {
    name: 'Verkoop',
    color: 'from-blue-500/20 to-blue-600/20',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-500',
    modules: [
      { icon: Globe, name: 'Webshop' },
      { icon: Monitor, name: 'POS Kassa' },
      { icon: ShoppingCart, name: 'Marketplaces' },
      { icon: Package, name: 'Bestellingen' },
    ],
  },
  {
    name: 'Marketing',
    color: 'from-purple-500/20 to-purple-600/20',
    borderColor: 'border-purple-500/30',
    iconColor: 'text-purple-500',
    modules: [
      { icon: Sparkles, name: 'AI Content' },
      { icon: Mail, name: 'Campagnes' },
      { icon: Heart, name: 'Loyaliteit' },
      { icon: Gift, name: 'Promoties' },
    ],
  },
  {
    name: 'Financiën',
    color: 'from-green-500/20 to-green-600/20',
    borderColor: 'border-green-500/30',
    iconColor: 'text-green-500',
    modules: [
      { icon: FileText, name: 'Facturen' },
      { icon: Calculator, name: 'BTW/OSS' },
      { icon: Send, name: 'Peppol' },
      { icon: Receipt, name: 'Offertes' },
    ],
  },
  {
    name: 'Groei',
    color: 'from-accent/20 to-accent/30',
    borderColor: 'border-accent/30',
    iconColor: 'text-accent',
    modules: [
      { icon: BarChart3, name: 'Analytics' },
      { icon: Search, name: 'SEO Tools' },
      { icon: FileBarChart, name: 'Rapporten' },
      { icon: Lightbulb, name: 'AI Insights' },
    ],
  },
];

export function ModulesGrid() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Alles In Één Platform
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            16+ geïntegreerde modules die naadloos samenwerken. Geen losse tools, geen gedoe.
          </p>
        </div>

        <div
          className={cn(
            'grid md:grid-cols-2 lg:grid-cols-4 gap-6',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          {moduleCategories.map((category, catIndex) => (
            <div
              key={category.name}
              className={cn(
                'p-6 rounded-2xl border bg-gradient-to-br backdrop-blur-sm',
                category.color,
                category.borderColor
              )}
              style={{ animationDelay: `${0.1 * catIndex}s` }}
            >
              <h3 className={cn('font-bold text-lg mb-4', category.iconColor)}>
                {category.name}
              </h3>
              <div className="space-y-3">
                {category.modules.map((module) => (
                  <div
                    key={module.name}
                    className="flex items-center gap-3 text-foreground/80"
                  >
                    <module.icon className={cn('w-4 h-4', category.iconColor)} />
                    <span className="text-sm">{module.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
