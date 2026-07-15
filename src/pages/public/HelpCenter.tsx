import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { BookOpen, ShoppingBag, CreditCard, Package, Users, Settings, MessageSquare, Sparkles } from 'lucide-react';

const categories = [
  { icon: BookOpen, title: 'Aan de slag', description: 'Eerste stappen en setup handleidingen', color: 'bg-green-500/10 text-green-600' },
  { icon: ShoppingBag, title: 'Producten', description: 'Beheer je catalogus en voorraad', color: 'bg-blue-500/10 text-blue-600' },
  { icon: Package, title: 'Bestellingen', description: 'Orders verwerken en verzenden', color: 'bg-purple-500/10 text-purple-600' },
  { icon: CreditCard, title: 'Betalingen', description: 'Stripe, iDEAL en facturatie', color: 'bg-amber-500/10 text-amber-600' },
  { icon: Users, title: 'Klanten', description: 'CRM en klantengroepen', color: 'bg-pink-500/10 text-pink-600' },
  { icon: Settings, title: 'Instellingen', description: 'Account en configuratie', color: 'bg-cyan-500/10 text-cyan-600' },
];

export default function HelpCenter() {
  return (
    <PublicPageLayout title="Help Center" subtitle="Vind antwoorden op je vragen">
      {/* Notice */}
      <section className="max-w-2xl mx-auto mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
          <Sparkles className="w-8 h-8 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Ons helpcenter wordt uitgebouwd</h2>
          <p className="text-sm text-muted-foreground">
            We werken aan uitgebreide handleidingen. Ondertussen helpen we je graag rechtstreeks verder.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Onderwerpen</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => (
            <div
              key={index}
              className="bg-card rounded-xl border border-border p-6"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center shrink-0`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{category.title}</h3>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Hulp nodig?</h2>
          <p className="text-muted-foreground mb-6">
            Ons support team staat voor je klaar en helpt je persoonlijk verder.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/contact">Neem contact op</Link>
          </Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}