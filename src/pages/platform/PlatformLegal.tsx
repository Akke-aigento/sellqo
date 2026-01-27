import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  FileText, 
  Eye, 
  EyeOff, 
  Save,
  ExternalLink,
  Clock,
  Upload,
  Loader2
} from "lucide-react";
import { useSellqoLegal, LEGAL_PAGE_TYPES } from "@/hooks/useSellqoLegal";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function PlatformLegal() {
  const { 
    legalPages, 
    isLoading, 
    updatePage, 
    publishPage, 
    unpublishPage,
    isUpdating,
    isPublishing 
  } = useSellqoLegal();
  
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  const selectedPage = legalPages.find(p => p.id === selectedPageId);

  const handleSelectPage = (pageId: string) => {
    const page = legalPages.find(p => p.id === pageId);
    if (page) {
      setSelectedPageId(pageId);
      setEditedContent(page.content);
      setEditedTitle(page.title);
      setIsPreview(false);
    }
  };

  const handleSave = async () => {
    if (selectedPageId) {
      await updatePage({
        id: selectedPageId,
        title: editedTitle,
        content: editedContent,
      });
    }
  };

  const handlePublish = async () => {
    if (selectedPageId) {
      await publishPage(selectedPageId);
    }
  };

  const handleUnpublish = async () => {
    if (selectedPageId) {
      await unpublishPage(selectedPageId);
    }
  };

  const [isPublishingAll, setIsPublishingAll] = useState(false);
  
  const handlePublishAll = async () => {
    const unpublishedPages = legalPages.filter(p => !p.is_published);
    if (unpublishedPages.length === 0) {
      toast.info('Alle pagina\'s zijn al gepubliceerd');
      return;
    }
    
    setIsPublishingAll(true);
    try {
      for (const page of unpublishedPages) {
        await publishPage(page.id);
      }
      toast.success(`${unpublishedPages.length} pagina's gepubliceerd`);
    } catch (error) {
      toast.error('Fout bij publiceren van pagina\'s');
    } finally {
      setIsPublishingAll(false);
    }
  };

  const unpublishedCount = legalPages.filter(p => !p.is_published).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Juridische Pagina's</h1>
          <p className="text-muted-foreground">Beheer SellQo's algemene voorwaarden en policies</p>
        </div>
        {unpublishedCount > 0 && (
          <Button onClick={handlePublishAll} disabled={isPublishingAll}>
            {isPublishingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Alles Publiceren ({unpublishedCount})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Page List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Pagina's</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {LEGAL_PAGE_TYPES.map((pageType) => {
                const page = legalPages.find(p => p.page_type === pageType.type);
                const isSelected = selectedPageId === page?.id;
                
                return (
                  <div
                    key={pageType.type}
                    onClick={() => page && handleSelectPage(page.id)}
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-muted border-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{pageType.label}</span>
                      </div>
                      {page?.is_published ? (
                        <Badge variant="default" className="text-xs">Live</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Draft</Badge>
                      )}
                    </div>
                    {page && (
                      <p className="text-xs text-muted-foreground mt-1">
                        v{page.version} • {page.last_published_at 
                          ? format(new Date(page.last_published_at), 'd MMM yyyy', { locale: nl })
                          : 'Nog niet gepubliceerd'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="lg:col-span-3">
          {selectedPage ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle>{selectedPage.title}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Versie {selectedPage.version}</span>
                      {selectedPage.effective_date && (
                        <>
                          <span>•</span>
                          <span>Ingangsdatum: {format(new Date(selectedPage.effective_date), 'd MMM yyyy', { locale: nl })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsPreview(!isPreview)}>
                      {isPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                      {isPreview ? 'Bewerken' : 'Preview'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild
                    >
                      <a href={`/${selectedPage.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Bekijk Live
                      </a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isPreview ? (
                  <>
                    <div className="space-y-2">
                      <Label>Titel</Label>
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Inhoud (Markdown)</Label>
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={20}
                        className="font-mono text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <ScrollArea className="h-[500px] border rounded-lg p-4">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {/* Simple markdown rendering - in production use a proper markdown renderer */}
                      <div dangerouslySetInnerHTML={{ 
                        __html: editedContent
                          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                          .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                          .replace(/\*(.*)\*/gim, '<em>$1</em>')
                          .replace(/\n/gim, '<br>')
                      }} />
                    </div>
                  </ScrollArea>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {selectedPage.is_published ? (
                      <Button 
                        variant="outline" 
                        onClick={handleUnpublish}
                        disabled={isPublishing}
                      >
                        Depubliceren
                      </Button>
                    ) : (
                      <Button 
                        onClick={handlePublish}
                        disabled={isPublishing}
                      >
                        Publiceren
                      </Button>
                    )}
                  </div>
                  <Button 
                    onClick={handleSave}
                    disabled={isUpdating}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Opslaan
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[600px]">
              <p className="text-muted-foreground">Selecteer een pagina om te bewerken</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
