import { useParams } from "react-router-dom";
import { usePublicLegalPage } from "@/hooks/useSellqoLegal";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Loader2, FileText, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ForcedLightMode } from "@/components/ForcedLightMode";

export default function SellqoLegal() {
  const { slug } = useParams<{ slug: string }>();
  const { page, isLoading, error } = usePublicLegalPage(slug || '');

  if (isLoading) {
    return (
      <ForcedLightMode>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ForcedLightMode>
    );
  }

  if (error || !page) {
    return (
      <ForcedLightMode>
        <div className="min-h-screen flex flex-col items-center justify-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold">Pagina niet gevonden</h1>
          <p className="text-muted-foreground mt-2">Deze pagina bestaat niet of is niet gepubliceerd.</p>
          <Button asChild className="mt-6">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Terug naar Home</Link>
          </Button>
        </div>
      </ForcedLightMode>
    );
  }

  return (
    <ForcedLightMode>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container max-w-4xl mx-auto py-4 px-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">SellQo</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Voorwaarden</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/sla" className="hover:text-foreground">SLA</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto py-12 px-4">
        <article>
          <header className="mb-8 pb-8 border-b">
            <h1 className="text-4xl font-bold mb-4">{page.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Versie {page.version}</span>
              {page.effective_date && (
                <>
                  <span>•</span>
                  <span>Ingangsdatum: {format(new Date(page.effective_date), 'd MMMM yyyy', { locale: nl })}</span>
                </>
              )}
              {page.last_published_at && (
                <>
                  <span>•</span>
                  <span>Laatst bijgewerkt: {format(new Date(page.last_published_at), 'd MMMM yyyy', { locale: nl })}</span>
                </>
              )}
            </div>
          </header>

          <div className="prose prose-lg max-w-none dark:prose-invert">
            {/* Render markdown content */}
            <div dangerouslySetInnerHTML={{ 
              __html: page.content
                .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
                .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mt-6 mb-3">$1</h2>')
                .replace(/^### (.*$)/gim, '<h3 class="text-xl font-medium mt-4 mb-2">$1</h3>')
                .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
                .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
                .replace(/\n\n/gim, '</p><p class="mb-4">')
                .replace(/\n/gim, '<br>')
                .replace(/---/gim, '<hr class="my-8">')
            }} />
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">SellQo</span>
              <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Alle rechten voorbehouden</span>
            </div>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link to="/terms" className="hover:text-foreground">Voorwaarden</Link>
              <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link to="/cookies" className="hover:text-foreground">Cookies</Link>
              <Link to="/sla" className="hover:text-foreground">SLA</Link>
              <Link to="/dpa" className="hover:text-foreground">DPA</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
    </ForcedLightMode>
  );
}
