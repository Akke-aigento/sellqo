import { useParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePublicStorefront, usePublicPage } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';

export default function ShopPage() {
  const { tenantSlug, pageSlug } = useParams<{ tenantSlug: string; pageSlug: string }>();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { data: page, isLoading, error } = usePublicPage(tenant?.id, pageSlug || '');

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="animate-pulse bg-muted h-10 rounded w-1/2 mb-6" />
            <div className="animate-pulse bg-muted h-4 rounded mb-2" />
            <div className="animate-pulse bg-muted h-4 rounded mb-2" />
            <div className="animate-pulse bg-muted h-4 rounded w-3/4" />
          </div>
        </div>
      </ShopLayout>
    );
  }

  if (error || !page) {
    return (
      <ShopLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Pagina niet gevonden</h1>
          <Button asChild>
            <Link to={`/shop/${tenantSlug}`}>Terug naar home</Link>
          </Button>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <Helmet>
        <title>{page.meta_title || page.title} | {tenant?.name || 'Shop'}</title>
        {page.meta_description && <meta name="description" content={page.meta_description} />}
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {themeSettings?.show_breadcrumbs !== false && (
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link to={`/shop/${tenantSlug}`} className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{page.title}</span>
          </nav>
        )}

        <article className="max-w-3xl mx-auto">
          <h1 
            className="text-4xl font-bold mb-8"
            style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}
          >
            {page.title}
          </h1>

          {page.content && (
            <div 
              className="prose prose-lg max-w-none dark:prose-invert
                         prose-headings:font-bold prose-headings:text-foreground
                         prose-p:text-muted-foreground prose-a:text-primary
                         prose-ul:list-disc prose-ol:list-decimal
                         prose-img:rounded-lg prose-img:max-w-full"
              style={{ fontFamily: themeSettings?.body_font ? `"${themeSettings.body_font}", sans-serif` : undefined }}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          )}
        </article>
      </div>
    </ShopLayout>
  );
}
