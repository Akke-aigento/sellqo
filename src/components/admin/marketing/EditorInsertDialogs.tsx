import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ImageIcon, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMediaAssets } from '@/hooks/useMediaAssets';
import { cn } from '@/lib/utils';

/**
 * MAIL-1b — dialogen voor de e-maileditor (CampaignRichEditor), ter vervanging
 * van window.prompt. Enkel http(s)- en mailto-links; afbeeldingen enkel https,
 * want mailclients tonen geen http-afbeeldingen of data-URL's.
 */
function normalizeLinkUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (/^\{\{[a-z_]+\}\}$/i.test(v)) return v; // variabele zoals {{company_website}}
  if (/^[^\s/]+\.[^\s]+/.test(v)) return `https://${v}`;
  return null;
}

export function LinkDialog({
  open, onOpenChange, initialUrl, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialUrl?: string;
  /** null = link verwijderen */
  onSubmit: (url: string | null) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  useEffect(() => { if (open) setUrl(initialUrl || ''); }, [open, initialUrl]);
  const normalized = normalizeLinkUrl(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{t('admin.marketing.editorInsert.link_title')}</DialogTitle>
          <DialogDescription>{t('admin.marketing.editorInsert.link_explain')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // De editor staat zelf in het campagne-/templateformulier; React laat
            // submit door de portal heen bubbelen, dus hier stoppen.
            e.stopPropagation();
            if (normalized) { onSubmit(normalized); onOpenChange(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="editor-link-url">{t('admin.marketing.editorInsert.link_url')}</Label>
            <Input
              id="editor-link-url"
              autoFocus
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url.trim() !== '' && !normalized && (
              <p className="text-xs text-destructive">{t('admin.marketing.editorInsert.link_invalid')}</p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {initialUrl && (
              <Button type="button" variant="outline" className="sm:mr-auto" onClick={() => { onSubmit(null); onOpenChange(false); }}>
                {t('admin.marketing.editorInsert.link_remove')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!normalized}>{t('admin.marketing.editorInsert.apply')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImageInsertDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (image: { src: string; alt: string }) => void;
}) {
  const { t } = useTranslation();
  const { assets, isLoading, incrementUsage } = useMediaAssets('all');
  const [tab, setTab] = useState<'library' | 'url'>('library');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');

  useEffect(() => {
    if (open) { setSearch(''); setSelectedId(null); setUrl(''); setAlt(''); }
  }, [open]);

  const images = useMemo(() => {
    const list = assets.filter((a) => (a.file_type || '').startsWith('image/') || !a.file_type);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.file_name.toLowerCase().includes(q)
      || a.title?.toLowerCase().includes(q)
      || a.alt_text?.toLowerCase().includes(q)
      || a.tags?.some((tag) => tag.toLowerCase().includes(q)));
  }, [assets, search]);

  const selected = images.find((a) => a.id === selectedId) || null;
  const urlOk = /^https:\/\/\S+$/i.test(url.trim());

  const confirm = () => {
    if (tab === 'library' && selected) {
      incrementUsage.mutate(selected.id);
      onSubmit({ src: selected.file_url, alt: alt.trim() || selected.alt_text || selected.title || '' });
    } else if (tab === 'url' && urlOk) {
      onSubmit({ src: url.trim(), alt: alt.trim() });
    } else {
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('admin.marketing.editorInsert.image_title')}</DialogTitle>
          <DialogDescription>{t('admin.marketing.editorInsert.image_explain')}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'library' | 'url')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="self-start">
            <TabsTrigger value="library">{t('admin.marketing.editorInsert.tab_library')}</TabsTrigger>
            <TabsTrigger value="url">{t('admin.marketing.editorInsert.tab_url')}</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="flex-1 min-h-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ScrollArea className="h-[40vh] -mx-2 px-2">
              {isLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : images.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{search ? t('admin.marketing.editorInsert.no_results') : t('admin.marketing.editorInsert.library_empty')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-1">
                  {images.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      title={a.title || a.file_name}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        selectedId === a.id ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-muted-foreground/30',
                      )}
                    >
                      <img src={a.file_url} alt={a.alt_text || a.title || a.file_name} className="w-full h-full object-cover" loading="lazy" />
                      {selectedId === a.id && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="url" className="space-y-1.5">
            <Label htmlFor="editor-image-url">{t('admin.marketing.editorInsert.image_url')}</Label>
            <Input id="editor-image-url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            {url.trim() !== '' && !urlOk && (
              <p className="text-xs text-destructive">{t('admin.marketing.editorInsert.image_url_invalid')}</p>
            )}
          </TabsContent>
        </Tabs>
        <div className="space-y-1.5">
          <Label htmlFor="editor-image-alt">{t('admin.marketing.editorInsert.image_alt')}</Label>
          <Input id="editor-image-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={selected?.alt_text || selected?.title || ''} />
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="button" onClick={confirm} disabled={tab === 'library' ? !selected : !urlOk}>
            {t('admin.marketing.editorInsert.insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
