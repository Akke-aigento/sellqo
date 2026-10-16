import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Upload, X, Loader2, Search, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchMediaLibrary, filterByName, type MediaItem, type StorageLike } from '@/lib/storefrontMediaLibrary';

interface VisualMediaPickerProps {
  value?: string;
  onSelect: (url: string) => void;
  aspectRatio?: 'video' | 'square' | 'portrait';
  className?: string;
  placeholder?: string;
}

// EDITOR-MEDIA-1: zoveel tegels per "Meer laden".
const LIBRARY_STEP = 24;

export function VisualMediaPicker({
  value,
  onSelect,
  aspectRatio = 'video',
  className,
  placeholder,
}: VisualMediaPickerProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tab, setTab] = useState<'upload' | 'library'>('upload');

  // Mediabibliotheek: pas laden als het tabblad open gaat, opnieuw na een upload.
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [libraryFailed, setLibraryFailed] = useState<string[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(LIBRARY_STEP);

  const tenantId = currentTenant?.id;

  useEffect(() => {
    if (!isOpen || tab !== 'library' || library !== null || !tenantId) return;
    let cancelled = false;
    setLibraryLoading(true);
    // Alle state in één keer zetten: zodra `library` wijzigt, ruimt deze effect op
    // (cancelled = true), dus een latere .finally() zou de spinner laten hangen.
    fetchMediaLibrary(supabase as unknown as StorageLike, tenantId)
      .then((res) => {
        if (cancelled) return;
        setLibrary(res.items);
        setLibraryFailed(res.failed);
        setLibraryLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Media library error:', error);
        setLibrary([]);
        setLibraryFailed(['*']);
        setLibraryLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, tab, library, tenantId]);

  // Andere winkel gekozen: bibliotheek opnieuw ophalen.
  useEffect(() => { setLibrary(null); setShown(LIBRARY_STEP); }, [tenantId]);

  const filtered = useMemo(() => filterByName(library || [], search), [library, search]);
  const visible = filtered.slice(0, shown);

  const choose = (url: string) => {
    onSelect(url);
    setIsOpen(false);
  };

  const handleUpload = useCallback(async (file: File) => {
    if (!currentTenant?.id) {
      toast.error(t('admin.storefront.mediaPicker.no_tenant'));
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant.id}/storefront/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tenant-assets')
        .getPublicUrl(fileName);

      onSelect(publicUrl);
      setLibrary(null);
      setIsOpen(false);
      toast.success(t('admin.storefront.mediaPicker.uploaded'));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('admin.storefront.mediaPicker.upload_failed'));
    } finally {
      setIsUploading(false);
    }
  }, [currentTenant?.id, onSelect, t]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleUpload(acceptedFiles[0]);
    }
  }, [handleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 1,
    disabled: isUploading,
  });

  const aspectClasses = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
  };

  return (
    <>
      {/* Image preview / click target */}
      <div
        onClick={() => setIsOpen(true)}
        className={cn(
          'relative cursor-pointer group overflow-hidden rounded-lg',
          aspectClasses[aspectRatio],
          !value && 'border-2 border-dashed border-muted-foreground/30 bg-muted/50',
          'hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all',
          className
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="h-8 w-8 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImagePlus className="h-8 w-8 mb-2" />
            <span className="text-sm">{placeholder ?? t('admin.storefront.mediaPicker.placeholder')}</span>
          </div>
        )}
      </div>

      {/* Media picker dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.storefront.mediaPicker.title')}</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'library')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">{t('admin.storefront.mediaPicker.tab_upload')}</TabsTrigger>
              <TabsTrigger value="library">{t('admin.storefront.mediaPicker.tab_library')}</TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              {/* Drop zone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary',
                  isUploading && 'pointer-events-none opacity-50'
                )}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>{t('admin.storefront.mediaPicker.uploading')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                    <p className="font-medium">{t('admin.storefront.mediaPicker.drop_here')}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('admin.storefront.mediaPicker.or_browse')}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="library" className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShown(LIBRARY_STEP); }}
                  placeholder={t('admin.storefront.mediaPicker.search_placeholder')}
                  aria-label={t('admin.storefront.mediaPicker.search_placeholder')}
                  className="h-9 pl-8"
                />
              </div>

              {libraryLoading || library === null ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {libraryFailed.length > 0 ? (
                    <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                      {library.length ? t('admin.storefront.mediaPicker.library_partial') : t('admin.storefront.mediaPicker.library_error')}
                    </p>
                  ) : null}
                  {library.length === 0 && libraryFailed.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.storefront.mediaPicker.library_empty')}</p>
                  ) : filtered.length === 0 && library.length > 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.storefront.mediaPicker.no_results')}</p>
                  ) : (
                    <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                      {visible.map((item) => {
                        const active = item.url === value;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            title={item.name}
                            aria-label={t('admin.storefront.mediaPicker.choose_named', { name: item.name })}
                            onClick={() => choose(item.url)}
                            className={cn(
                              'relative aspect-square overflow-hidden rounded-md border bg-muted transition-all hover:ring-2 hover:ring-primary',
                              active && 'ring-2 ring-primary'
                            )}
                          >
                            <img src={item.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            {active ? (
                              <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {filtered.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t('admin.storefront.mediaPicker.count', { shown: visible.length, total: filtered.length })}</span>
                      {filtered.length > visible.length ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + LIBRARY_STEP)}>
                          {t('admin.storefront.mediaPicker.load_more')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Current image preview */}
          {value && (
            <div className="mt-2">
              <p className="text-sm font-medium mb-2">{t('admin.storefront.mediaPicker.current')}</p>
              <div className="relative inline-block">
                <img
                  src={value}
                  alt=""
                  className="h-24 w-auto rounded border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  aria-label={t('admin.storefront.mediaPicker.remove')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect('');
                    setIsOpen(false);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
