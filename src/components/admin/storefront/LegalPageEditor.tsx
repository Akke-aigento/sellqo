import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, AlertTriangle, Sparkles } from "lucide-react";
import { useLegalPages } from "@/hooks/useLegalPages";
import { 
  LegalPageType, 
  LEGAL_PAGE_TYPES, 
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "@/types/legal-pages";

interface LegalPageEditorProps {
  pageType: LegalPageType;
  open: boolean;
  onClose: () => void;
}

export function LegalPageEditor({ pageType, open, onClose }: LegalPageEditorProps) {
  const { getPageByType, updateLegalPage, isUpdating } = useLegalPages();
  const page = getPageByType(pageType);
  const pageInfo = LEGAL_PAGE_TYPES.find(p => p.type === pageType);
  
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>('nl');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data from page
  useEffect(() => {
    if (page) {
      const data: Record<string, string> = {};
      SUPPORTED_LANGUAGES.forEach(lang => {
        data[`title_${lang.code}`] = (page[`title_${lang.code}` as keyof typeof page] as string) || '';
        data[`content_${lang.code}`] = (page[`content_${lang.code}` as keyof typeof page] as string) || '';
        data[`meta_title_${lang.code}`] = (page[`meta_title_${lang.code}` as keyof typeof page] as string) || '';
        data[`meta_description_${lang.code}`] = (page[`meta_description_${lang.code}` as keyof typeof page] as string) || '';
      });
      setFormData(data);
      setHasChanges(false);
    }
  }, [page]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!page) return;
    
    await updateLegalPage({
      id: page.id,
      ...formData,
      is_auto_generated: false, // Mark as manually edited
    });
    
    setHasChanges(false);
    onClose();
  };

  if (!page || !pageInfo) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{pageInfo.name_nl} Bewerken</DialogTitle>
          <DialogDescription>
            Bewerk de inhoud voor elke taal. Lege velden vallen terug op Nederlands.
          </DialogDescription>
        </DialogHeader>

        {page.is_auto_generated && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              Deze pagina is automatisch gegenereerd. Handmatige wijzigingen worden bij "Regenereren" overschreven.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeLanguage} onValueChange={(v) => setActiveLanguage(v as SupportedLanguage)}>
          <TabsList className="grid w-full grid-cols-4">
            {SUPPORTED_LANGUAGES.map(lang => (
              <TabsTrigger key={lang.code} value={lang.code} className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span className="hidden sm:inline">{lang.name}</span>
                <span className="sm:hidden">{lang.code.toUpperCase()}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {SUPPORTED_LANGUAGES.map(lang => (
            <TabsContent key={lang.code} value={lang.code} className="mt-4">
              <ScrollArea className="h-[50vh] pr-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title_${lang.code}`}>Titel</Label>
                    <Input
                      id={`title_${lang.code}`}
                      value={formData[`title_${lang.code}`] || ''}
                      onChange={(e) => handleChange(`title_${lang.code}`, e.target.value)}
                      placeholder={lang.code === 'nl' ? pageInfo.name_nl : `${pageInfo.name_nl} (${lang.name})`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`content_${lang.code}`}>Inhoud</Label>
                    <Textarea
                      id={`content_${lang.code}`}
                      value={formData[`content_${lang.code}`] || ''}
                      onChange={(e) => handleChange(`content_${lang.code}`, e.target.value)}
                      placeholder={`Voer de ${pageInfo.name_nl.toLowerCase()} tekst in...`}
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: Gebruik markdown voor opmaak. Koppen met #, vet met **tekst**, lijsten met -.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`meta_title_${lang.code}`}>SEO Titel</Label>
                      <Input
                        id={`meta_title_${lang.code}`}
                        value={formData[`meta_title_${lang.code}`] || ''}
                        onChange={(e) => handleChange(`meta_title_${lang.code}`, e.target.value)}
                        placeholder={`${pageInfo.name_nl} | Jouw Webshop`}
                        maxLength={60}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData[`meta_title_${lang.code}`]?.length || 0}/60 karakters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`meta_description_${lang.code}`}>SEO Beschrijving</Label>
                      <Input
                        id={`meta_description_${lang.code}`}
                        value={formData[`meta_description_${lang.code}`] || ''}
                        onChange={(e) => handleChange(`meta_description_${lang.code}`, e.target.value)}
                        placeholder="Korte beschrijving voor zoekmachines..."
                        maxLength={160}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData[`meta_description_${lang.code}`]?.length || 0}/160 karakters
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {hasChanges && (
              <span className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Onopgeslagen wijzigingen
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={isUpdating || !hasChanges}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opslaan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Opslaan
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
