import { useState } from 'react';
import { Loader2, Wand2, Eraser, ImageIcon, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAIImages } from '@/hooks/useAIImages';
import { useAICredits } from '@/hooks/useAICredits';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Labels staan als i18n-key; `prompt` is een instructie aan het beeldmodel en
// blijft bewust Engels — dat is geen UI-tekst.
const BACKGROUND_PRESETS = [
  { id: 'transparent', labelKey: 'admin.products.imageEditorDialog.presets.transparent', prompt: 'Remove the background completely, make it transparent', icon: '🔲' },
  { id: 'studio_white', labelKey: 'admin.products.imageEditorDialog.presets.studio_white', prompt: 'Place this product on a clean white studio background with soft shadows', icon: '⬜' },
  { id: 'studio_gray', labelKey: 'admin.products.imageEditorDialog.presets.studio_gray', prompt: 'Place this product on a neutral light gray studio background with subtle shadows', icon: '🔳' },
  { id: 'gradient_soft', labelKey: 'admin.products.imageEditorDialog.presets.gradient_soft', prompt: 'Place this product on a soft pastel gradient background, professional product photography style', icon: '🌈' },
  { id: 'lifestyle_wood', labelKey: 'admin.products.imageEditorDialog.presets.lifestyle_wood', prompt: 'Place this product on a beautiful wooden table in a lifestyle setting with natural lighting', icon: '🪵' },
  { id: 'lifestyle_marble', labelKey: 'admin.products.imageEditorDialog.presets.lifestyle_marble', prompt: 'Place this product on an elegant white marble surface in a premium lifestyle setting', icon: '🏛️' },
  { id: 'nature_green', labelKey: 'admin.products.imageEditorDialog.presets.nature_green', prompt: 'Place this product in a lush green nature setting with soft bokeh background', icon: '🌿' },
  { id: 'seasonal_winter', labelKey: 'admin.products.imageEditorDialog.presets.seasonal_winter', prompt: 'Place this product in a cozy winter holiday setting with snow and warm lighting', icon: '❄️' },
  { id: 'custom_color', labelKey: 'admin.products.imageEditorDialog.presets.custom_color', prompt: '', icon: '🎨' },
];

interface ImageEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onApply: (newImageUrl: string) => void;
  productName?: string;
}

export function ImageEditorDialog({
  open,
  onOpenChange,
  imageUrl,
  onApply,
  productName,
}: ImageEditorDialogProps) {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customColor, setCustomColor] = useState('#ffffff');
  const { generateImage } = useAIImages();
  const { hasCredits, getCreditCost } = useAICredits();

  const creditCost = getCreditCost('image_enhancement');

  const handleProcess = async () => {
    if (!selectedPreset) return;
    const preset = BACKGROUND_PRESETS.find(p => p.id === selectedPreset);
    if (!preset) return;

    setIsProcessing(true);
    setResultUrl(null);

    try {
      const enhancementType = selectedPreset === 'transparent' ? 'background_remove' : 'enhance';
      const prompt = selectedPreset === 'custom_color'
        ? // AI-instructie, geen UI-tekst — blijft Engels.
      `Place this product on a solid ${customColor} colored background, professional product photography with soft shadows`
        : preset.prompt;

      const result = await generateImage.mutateAsync({
        prompt,
        sourceImageUrl: imageUrl,
        enhancementType,
        settingPreset: selectedPreset,
      });

      if (result?.imageUrl) {
        setResultUrl(result.imageUrl);
      }
    } catch {
      // Error toast handled by useAIImages hook
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (resultUrl) {
      onApply(resultUrl);
      onOpenChange(false);
      setResultUrl(null);
      setSelectedPreset(null);
      setCustomColor('#ffffff');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setResultUrl(null);
      setSelectedPreset(null);
      setCustomColor('#ffffff');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {t('admin.products.imageEditorDialog.foto_bewerken')}
          </DialogTitle>
          <DialogDescription>
            {productName ? t('admin.products.imageEditorDialog.bewerk_achtergrond_van', { product: productName }) : 'Verwijder of wijzig de achtergrond van deze foto'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Before / After preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('admin.products.imageEditorDialog.origineel')}</p>
              <div className="aspect-square rounded-lg border overflow-hidden bg-muted/30">
                <img src={imageUrl} alt={t('admin.products.imageEditorDialog.origineel_2')} className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('admin.products.imageEditorDialog.resultaat')}</p>
              <div className="aspect-square rounded-lg border overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlN2ViIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=')]">
                {isProcessing ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground">{t('admin.products.imageEditorDialog.ai_bewerkt_je_foto')}</p>
                    </div>
                  </div>
                ) : resultUrl ? (
                  <img src={resultUrl} alt={t('admin.products.imageEditorDialog.resultaat_2')} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/20">
                    <div className="text-center space-y-1">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">{t('admin.products.imageEditorDialog.kies_een_achtergrond_hieronder')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Background presets */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('admin.products.imageEditorDialog.kies_achtergrond')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset.id)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all hover:bg-muted/50",
                    selectedPreset === preset.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  )}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span className="font-medium truncate">{t(preset.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom color picker */}
          {selectedPreset === 'custom_color' && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0 p-0"
              />
              <Input
                value={customColor}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setCustomColor(v);
                }}
                className="w-28 font-mono uppercase"
                maxLength={7}
              />
              <div
                className="w-10 h-10 rounded border"
                style={{ backgroundColor: customColor }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Badge variant="secondary" className="text-xs">
              {creditCost} credit{creditCost !== 1 ? 's' : ''} per bewerking
            </Badge>
            <div className="flex gap-2">
              {!resultUrl ? (
                <Button
                  onClick={handleProcess}
                  disabled={!selectedPreset || isProcessing || !hasCredits(creditCost)}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eraser className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? t('admin.marketing.creditPurchaseDialog.bezig') : t('common.edit')}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setResultUrl(null); }}>
                    {t('admin.products.productDescriptionEditor.opnieuw')}
                  </Button>
                  <Button onClick={handleApply}>
                    <Check className="mr-2 h-4 w-4" />
                    {t('admin.ads.toepassen')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}