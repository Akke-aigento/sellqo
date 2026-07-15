import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { BookOpen, Rocket } from 'lucide-react';
import { PageMeta } from '@/components/seo/PageMeta';

export default function Blog() {
  return (
    <>
      <PageMeta
        title="Blog — Sellqo inzichten over e-commerce"
        description="Tips, trends en tutorials over webshops, marketplaces en e-commerce groei voor Belgische en Nederlandse ondernemers."
        path="/blog"
      />
      <PublicPageLayout title="Blog" subtitle="Inzichten, tips en nieuws over e-commerce">
        <section className="max-w-2xl mx-auto text-center">
          <div className="bg-card rounded-2xl border border-border p-10">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-7 h-7 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Onze eerste artikelen verschijnen binnenkort
            </h2>
            <p className="text-muted-foreground mb-8">
              Voor platform-updates en release-notes kan je ondertussen terecht op onze changelog.
            </p>
            <Button asChild>
              <Link to="/changelog">
                <Rocket className="w-4 h-4 mr-2" />
                Bekijk changelog
              </Link>
            </Button>
          </div>
        </section>
      </PublicPageLayout>
    </>
  );
}