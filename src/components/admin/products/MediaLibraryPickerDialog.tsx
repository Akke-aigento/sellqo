import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Check, ImageIcon, Loader2, Search, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaAssets } from '@/hooks/useMediaAssets';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';

interface MediaLibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URLs already used — shown as disabled/selected */
  existingUrls?: string[];
  onSelect: (urls: string[]) => void;
  /** Folder new uploads land in */
  uploadFolder?: string;
}

export function MediaLibraryPickerDialog({
  open,
  onOpenChange,
  existingUrls = [],
  onSelect,
  uploadFolder = 'products',
}: MediaLibraryPickerDialogProps) {
  const { currentTenant } = useTenant();
  const { assets, isLoading, createAsset } = useMediaAssets('all');
  const { uploadImage, uploading } = useImageUpload();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const images = useMemo(() => {
    const list = assets.filter(a => (a.file_type || '').startsWith('image/') || !a.file_type);
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(a =>
      a.file_name.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      a.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [assets, search]);

  const toggle = (url: string) => {
    setSelected(prev => (prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]));
  };

  const onDrop = useCallback(async (files: File[]) => {
    if (!currentTenant?.id) return;
    for (const file of files) {
      const url = await uploadImage(file, 'marketing-assets');
      if (!url) continue;
      await createAsset.mutateAsync({
        tenant_id: currentTenant.id,
        file_name: file.name,
        file_url: url,
        file_type: file.type || 'image/jpeg',
        file_size: file.size,
        source: 'upload',
        folder: uploadFolder,
        tags: [],
        is_ai_generated: false,
        is_favorite: false,
      });
      setSelected(prev => [...prev, url]);
    }
  }, [currentTenant?.id, uploadImage, createAsset, uploadFolder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    disabled: uploading,
  });

  const handleConfirm = () => {
    onSelect(selected.filter(u => !existingUrls.includes(u)));
    setSelected([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelected([]); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Kies uit bibliotheek</DialogTitle>
          <DialogDescription>
            Selecteer bestaande afbeeldingen of upload nieuwe naar je mediabibliotheek.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoeken..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
            uploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              Sleep foto's hierheen of klik om te uploaden
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[45vh] -mx-2 px-2">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nog geen afbeeldingen in je bibliotheek</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-1">
              {images.map(asset => {
                const alreadyUsed = existingUrls.includes(asset.file_url);
                const isSelected = selected.includes(asset.file_url);
                return (
                  <button
                    type="button"
                    key={asset.id}
                    onClick={() => !alreadyUsed && toggle(asset.file_url)}
                    className={cn(
                      'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                      isSelected ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-muted-foreground/30',
                      alreadyUsed && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <img src={asset.file_url} alt={asset.title || asset.file_name} className="w-full h-full object-cover" />
                    {(isSelected || alreadyUsed) && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.length === 0}>
            {selected.length > 0 ? `${selected.length} toevoegen` : 'Toevoegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
