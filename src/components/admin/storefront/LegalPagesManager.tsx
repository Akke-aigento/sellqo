import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Shield, 
  FileText, 
  RotateCcw, 
  Truck, 
  Mail, 
  Scale, 
  Cookie,
  Plus,
  Eye,
  Edit,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useLegalPages } from "@/hooks/useLegalPages";
import { useTenant } from "@/hooks/useTenant";
import { LEGAL_PAGE_TYPES, LegalPageType, SUPPORTED_LANGUAGES } from "@/types/legal-pages";
import { LegalPageEditor } from "./LegalPageEditor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const iconMap: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  RotateCcw: <RotateCcw className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  Mail: <Mail className="h-5 w-5" />,
  Scale: <Scale className="h-5 w-5" />,
  Cookie: <Cookie className="h-5 w-5" />,
};

export function LegalPagesManager() {
  const { 
    legalPages, 
    isLoading, 
    initializeLegalPages, 
    updateLegalPage,
    getMissingPages,
    getPageByType,
    isCreating,
  } = useLegalPages();
  
  const [editingPageType, setEditingPageType] = useState<LegalPageType | null>(null);
  
  const missingPages = getMissingPages();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const getTranslationStatus = (pageType: LegalPageType) => {
    const page = getPageByType(pageType);
    if (!page) return [];
    
    return SUPPORTED_LANGUAGES.map(lang => ({
      ...lang,
      hasContent: !!(page[`content_${lang.code}` as keyof typeof page]),
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Juridische Pagina's
              </CardTitle>
              <CardDescription>
                Beheer je wettelijk verplichte pagina's. Deze worden automatisch in de footer van je webshop getoond.
              </CardDescription>
            </div>
            {missingPages.length > 0 && (
              <Button 
                onClick={initializeLegalPages}
                disabled={isCreating}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ontbrekende pagina's aanmaken ({missingPages.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {legalPages.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Geen juridische pagina's</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Maak alle benodigde juridische pagina's aan om je webshop compliant te maken.
              </p>
              <Button onClick={initializeLegalPages} disabled={isCreating}>
                <Sparkles className="h-4 w-4 mr-2" />
                Alle pagina's aanmaken
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {LEGAL_PAGE_TYPES.map(pageInfo => {
                const page = getPageByType(pageInfo.type);
                const translations = getTranslationStatus(pageInfo.type);
                
                return (
                  <div 
                    key={pageInfo.type}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {iconMap[pageInfo.icon]}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{pageInfo.name_nl}</h4>
                          {page ? (
                            <>
                              {page.is_published ? (
                                <Badge variant="default" className="text-xs">Gepubliceerd</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Concept</Badge>
                              )}
                              {page.is_auto_generated && (
                                <Badge variant="outline" className="text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Auto-gegenereerd
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Niet aangemaakt</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pageInfo.description_nl}
                        </p>
                        {page && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">Vertalingen:</span>
                            {translations.map(lang => (
                              <span 
                                key={lang.code}
                                className={`text-sm ${lang.hasContent ? '' : 'opacity-40'}`}
                                title={lang.hasContent ? `${lang.name}: Ingevuld` : `${lang.name}: Leeg`}
                              >
                                {lang.flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {page && (
                        <>
                          <Switch
                            checked={page.is_published}
                            onCheckedChange={(checked) => 
                              updateLegalPage({ id: page.id, is_published: checked })
                            }
                            aria-label="Publiceren"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingPageType(pageInfo.type)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Footer Voorbeeld</CardTitle>
          <CardDescription>
            Zo ziet de footer van je webshop eruit met de juridische links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 text-center text-sm">
            <p className="text-muted-foreground mb-2">
              © 2026, <span className="font-medium">Jouw Bedrijf</span> · Powered by SellQo
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              {LEGAL_PAGE_TYPES.filter(p => {
                const page = getPageByType(p.type);
                return page?.is_published;
              }).map((page, idx, arr) => (
                <span key={page.type}>
                  <span className="text-primary hover:underline cursor-pointer">
                    {page.name_nl}
                  </span>
                  {idx < arr.length - 1 && <span className="text-muted-foreground mx-1">|</span>}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {editingPageType && (
        <LegalPageEditor
          pageType={editingPageType}
          open={!!editingPageType}
          onClose={() => setEditingPageType(null)}
        />
      )}
    </div>
  );
}
