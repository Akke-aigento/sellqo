import { Shield, Truck, RefreshCw, CreditCard, Lock, Award, Clock, Heart, Headphones, CheckCircle } from 'lucide-react';
import type { HomepageSection, UspBarContent } from '@/types/storefront';

interface UspBarSectionProps {
  section: HomepageSection;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  shield: <Shield className="h-5 w-5" />,
  truck: <Truck className="h-5 w-5" />,
  refresh: <RefreshCw className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  lock: <Lock className="h-5 w-5" />,
  award: <Award className="h-5 w-5" />,
  clock: <Clock className="h-5 w-5" />,
  heart: <Heart className="h-5 w-5" />,
  headphones: <Headphones className="h-5 w-5" />,
  check: <CheckCircle className="h-5 w-5" />,
};

export function UspBarSection({ section }: UspBarSectionProps) {
  const content = section.content as UspBarContent;
  const settings = section.settings;
  const items = content.items || [];

  if (items.length === 0) return null;

  return (
    <section
      className="py-6 border-y"
      style={{
        backgroundColor: settings.background_color || undefined,
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-start md:justify-center gap-6 md:gap-12 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-2 md:px-0 -mx-2 md:mx-0 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] md:[mask-image:none]">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 shrink-0 snap-start">
              <div className="text-primary">
                {ICON_MAP[item.icon] || <CheckCircle className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-medium whitespace-nowrap">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground whitespace-nowrap">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
