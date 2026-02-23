import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export default function ShopLegalPage() {
  const { tenantSlug, pageType } = useParams<{ tenantSlug: string; pageType: string }>();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');

  const { data: legalPage, isLoading } = useQuery({
    queryKey: ['public-legal-page', tenant?.id, pageType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_pages')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('page_type', pageType!)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!pageType,
  });

  const basePath = `/shop/${tenantSlug}`;

  return (
    <ShopLayout>
      <Helmet>
        <title>{legalPage?.title_nl || 'Juridisch'} | {tenant?.name || 'Shop'}</title>
        {legalPage?.meta_description_nl && (
          <meta name="description" content={legalPage.meta_description_nl} />
        )}
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {(themeSettings as any)?.show_breadcrumbs !== false && (
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={basePath}>Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{legalPage?.title_nl || 'Juridisch'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/6" />
          </div>
        ) : legalPage ? (
          <article className="max-w-3xl">
            <h1
              className="text-3xl font-bold mb-8"
              style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}
            >
              {legalPage.title_nl}
            </h1>
            <div
              className="prose prose-sm max-w-none dark:prose-invert
                         prose-headings:font-bold prose-headings:text-foreground
                         prose-p:text-muted-foreground prose-a:text-primary prose-a:underline
                         prose-strong:text-foreground prose-li:text-muted-foreground
                         prose-ul:list-disc prose-ol:list-decimal"
              dangerouslySetInnerHTML={{ __html: legalPage.content_nl || '' }}
            />
          </article>
        ) : (
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-2">Pagina niet gevonden</h1>
            <p className="text-muted-foreground">Deze juridische pagina bestaat niet.</p>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
