import { useState } from 'react';
import { 
  ImageIcon, Sparkles, Loader2, Download, Trash2, 
  Copy, Check, Wand2, RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIImages } from '@/hooks/useAIImages';
import { useAICredits } from '@/hooks/useAICredits';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

type ImageStyle = 'product_photo' | 'lifestyle' | 'flat_lay' | 'minimalist' | 'vibrant' | 'custom';
type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';

const styles: { id: ImageStyle; name: string; description: string }[] = [
  { id: 'product_photo', name: 'Product Foto', description: 'Professionele productfoto' },
  { id: 'lifestyle', name: 'Lifestyle', description: 'Product in context' },
  { id: 'flat_lay', name: 'Flat Lay', description: 'Bovenaanzicht styling' },
  { id: 'minimalist', name: 'Minimalistisch', description: 'Clean en strak' },
  { id: 'vibrant', name: 'Levendig', description: 'Kleurrijk en opvallend' },
  { id: 'custom', name: 'Eigen stijl', description: 'Beschrijf zelf' },
];

const sizes: { id: ImageSize; name: string; ratio: string }[] = [
  { id: '1024x1024', name: 'Vierkant', ratio: '1:1' },
  { id: '1792x1024', name: 'Liggend', ratio: '16:9' },
  { id: '1024x1792', name: 'Staand', ratio: '9:16' },
];

export function AIImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('product_photo');
  const [size, setSize] = useState<ImageSize>('1024x1024');
  const [copied, setCopied] = useState<string | null>(null);

  const { images, isLoading, generateImage, deleteImage } = useAIImages();
  const { hasCredits, getCreditCost } = useAICredits();

  const creditCost = getCreditCost('image_generation');
  const canGenerate = hasCredits(creditCost) && prompt.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) {
      if (!prompt.trim()) {
        toast.error('Voer een beschrijving in');
        return;
      }
      toast.error('Onvoldoende AI credits');
      return;
    }

    const [width, height] = size.split('x').map(Number);
    
    await generateImage.mutateAsync({
      prompt: prompt.trim(),
      style: style !== 'custom' ? style : undefined,
      width,
      height,
    });
  };

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    toast.success('URL gekopieerd!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            AI Afbeelding Generator
          </CardTitle>
          <CardDescription>
            Genereer unieke afbeeldingen voor je marketing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prompt */}
          <div className="space-y-2">
            <Label>Beschrijving</Label>
            <Textarea
              placeholder="Beschrijf de afbeelding die je wilt genereren..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Wees specifiek over kleuren, stijl en compositie
            </p>
          </div>

          {/* Style */}
          <div className="space-y-2">
            <Label>Stijl</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as ImageStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {styles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex flex-col">
                      <span>{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label>Formaat</Label>
            <div className="flex gap-2">
              {sizes.map((s) => (
                <Button
                  key={s.id}
                  variant={size === s.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSize(s.id)}
                  className="flex-1"
                >
                  <span className="font-medium">{s.name}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {s.ratio}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateImage.isPending || !canGenerate}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {generateImage.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Genereren...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Genereer Afbeelding ({creditCost} credits)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Gegenereerde Afbeeldingen
            </CardTitle>
            <Badge variant="secondary">{images.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nog geen afbeeldingen gegenereerd</p>
              <p className="text-sm">Gebruik de generator hierboven</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-2 gap-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted"
                  >
                    <img
                      src={image.image_url}
                      alt={image.prompt}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopy(image.image_url, image.id)}
                        >
                          {copied === image.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDownload(image.image_url, image.id)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteImage.mutate(image.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="text-white text-xs">
                        <p className="line-clamp-2">{image.prompt}</p>
                        <p className="opacity-70 mt-1">
                          {format(new Date(image.created_at), 'PPp', { locale: nl })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
