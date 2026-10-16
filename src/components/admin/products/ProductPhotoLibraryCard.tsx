import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Copy, ExternalLink, ImageIcon, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMediaAssets } from '@/hooks/useMediaAssets';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTenant } from '@/hooks/useTenant';
import { useProducts } from '@/hooks/useProducts';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { buildUsageMap, type ProductImageRef } from '@/lib/mediaLibrary';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

/**
 * Losse productfoto's: foto's in de bibliotheek (map "products") die op geen enkel product
 * staan, bv. een losse upload of het origineel na het standaardiseren. Je hangt ze aan een
 * product via "Kies uit bibliotheek" in het productformulier.
 *
 * MEDIA-2 (16-10-2026): toonde sinds MEDIA-1 ook de foto's die al op een product staan, en
 * dus dubbel met het fotobeheer eronder. Nu weer alleen de losse foto's, ingeklapt na
 * PREVIEW stuks, met een link naar de volledige bibliotheek als de winkel die heeft.
 */
const PREVIEW = 10;

export function ProductPhotoLibraryCard() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { assets, isLoading, deleteAsset } = useMediaAssets('products');
  const { uploadImage, uploading } = useImageUpload();
  const [search, setSearch] = useState('');
  // MEDIA-1: sinds de ene bibliotheek staan hier ook de foto's die al op een product staan.
  const { products } = useProducts();
  const usage = useMemo(() => buildUsageMap(products as unknown as ProductImageRef[]), [products]);
  const { checkFeature } = useUsageLimits();
  const [showAll, setShowAll] = useState(false);

  const loose = useMemo(() => assets.filter(a => !usage.has(a.file_url)), [assets, usage]);

  const images = useMemo(() => {
    if (!search) return loose;
    const q = search.toLowerCase();
    return loose.filter(a =>
      a.file_name.toLowerCase().includes(q) || a.title?.toLowerCase().includes(q)
    );
  }, [loose, search]);
  const visible = showAll || search ? images : images.slice(0, PREVIEW);

  const onDrop = useCallback(async (files: File[]) => {
    if (!currentTenant?.id) return;
    let uploaded = 0;
    for (const file of files) {
      // MEDIA-1: useImageUpload zet de foto zelf in de bibliotheek.
      const url = await uploadImage(file, 'marketing-assets', undefined, { folder: 'products' });
      if (!url) continue;
      uploaded++;
    }
    if (uploaded > 0) toast.success(t('admin.products.productPhotoLibraryCard.fotos_toegevoegd', { count: uploaded }));
  }, [currentTenant?.id, uploadImage, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    disabled: uploading,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t('admin.products.productPhotoLibraryCard.losse_fotos')}
              {loose.length > 0 && <span className="text-sm font-normal text-muted-foreground">({loose.length})</span>}
            </CardTitle>
            <CardDescription>
              {t('admin.products.productPhotoLibraryCard.losse_fotos_uitleg')}
            </CardDescription>
          </div>
          {checkFeature('ai_marketing') && (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to="/admin/marketing/ai?tab=assets">
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('admin.products.productPhotoLibraryCard.volledige_bibliotheek')}
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
            uploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{t('admin.products.productPhotoLibraryCard.sleep_foto_s_hierheen_of_klik')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('admin.products.productPhotoLibraryCard.jpg_png_webp_gif_of_heic')}</p>
            </>
          )}
        </div>

        {loose.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('admin.products.productPhotoLibraryCard.zoek_in_bibliotheek')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('admin.products.productPhotoLibraryCard.nog_geen_losse_foto_s_in')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visible.map(asset => (
              <div key={asset.id} className="group relative aspect-square rounded-lg overflow-hidden border">
                <img
                  src={asset.file_url}
                  alt={asset.title || asset.file_name}
                  className="w-full h-full object-contain bg-muted"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    title={t('admin.products.productPhotoLibraryCard.url_kopieren')}
                    onClick={() => { navigator.clipboard.writeText(asset.file_url); toast.success('URL gekopieerd'); }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    title={t('common.delete')}
                    onClick={() => deleteAsset.mutate(asset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-xs text-white truncate">{asset.title || asset.file_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!search && images.length > PREVIEW && (
          <div className="flex justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(v => !v)}>
              {showAll
                ? t('admin.products.productPhotoLibraryCard.toon_minder')
                : t('admin.products.productPhotoLibraryCard.toon_alle', { count: images.length })}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
