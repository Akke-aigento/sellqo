import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { removeBackground, loadImage } from '@/lib/removeBackground';
import { toast } from 'sonner';

// Import all logo assets
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import logoIcon from '@/assets/logo-icon.png';
import logoMono from '@/assets/logo-mono.png';
import logoTagline from '@/assets/logo-tagline.png';

interface LogoItem {
  id: string;
  name: string;
  src: string;
  filename: string;
}

const logos: LogoItem[] = [
  { id: 'light', name: 'Logo Light', src: logoLight, filename: 'logo-light.png' },
  { id: 'dark', name: 'Logo Dark', src: logoDark, filename: 'logo-dark.png' },
  { id: 'icon', name: 'Logo Icon', src: logoIcon, filename: 'logo-icon.png' },
  { id: 'mono', name: 'Logo Mono', src: logoMono, filename: 'logo-mono.png' },
  { id: 'tagline', name: 'Logo Tagline', src: logoTagline, filename: 'logo-tagline.png' },
];

type ProcessingStatus = 'idle' | 'processing' | 'done' | 'error';

interface ProcessedLogo {
  id: string;
  blob: Blob;
  url: string;
}

export function LogoProcessor() {
  const [status, setStatus] = useState<Record<string, ProcessingStatus>>({});
  const [processedLogos, setProcessedLogos] = useState<ProcessedLogo[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const processLogo = async (logo: LogoItem) => {
    setStatus(prev => ({ ...prev, [logo.id]: 'processing' }));
    
    try {
      const img = await loadImage(logo.src);
      const blob = await removeBackground(img);
      const url = URL.createObjectURL(blob);
      
      setProcessedLogos(prev => {
        // Remove old version if exists
        const filtered = prev.filter(p => p.id !== logo.id);
        return [...filtered, { id: logo.id, blob, url }];
      });
      
      setStatus(prev => ({ ...prev, [logo.id]: 'done' }));
      toast.success(`${logo.name} verwerkt!`);
    } catch (error) {
      console.error(`Error processing ${logo.name}:`, error);
      setStatus(prev => ({ ...prev, [logo.id]: 'error' }));
      toast.error(`Fout bij verwerken van ${logo.name}`);
    }
  };

  const processAllLogos = async () => {
    setIsProcessingAll(true);
    
    for (const logo of logos) {
      if (status[logo.id] !== 'done') {
        await processLogo(logo);
      }
    }
    
    setIsProcessingAll(false);
    toast.success('Alle logo\'s zijn verwerkt!');
  };

  const downloadLogo = (logoId: string, filename: string) => {
    const processed = processedLogos.find(p => p.id === logoId);
    if (!processed) return;
    
    const link = document.createElement('a');
    link.href = processed.url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    processedLogos.forEach(processed => {
      const logo = logos.find(l => l.id === processed.id);
      if (logo) {
        downloadLogo(processed.id, logo.filename);
      }
    });
  };

  const getStatusIcon = (logoId: string) => {
    const s = status[logoId];
    if (s === 'processing') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (s === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (s === 'error') return <AlertCircle className="h-4 w-4 text-destructive" />;
    return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo Achtergrond Verwijderen</CardTitle>
        <CardDescription>
          Gebruik AI om de achtergronden van de Sellqo logo's te verwijderen. 
          Dit proces gebruikt WebGPU voor snelle verwerking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Process All Button */}
        <div className="flex gap-2">
          <Button 
            onClick={processAllLogos} 
            disabled={isProcessingAll}
            className="flex-1"
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verwerken...
              </>
            ) : (
              'Alle Logo\'s Verwerken'
            )}
          </Button>
          
          {processedLogos.length > 0 && (
            <Button variant="outline" onClick={downloadAll}>
              <Download className="mr-2 h-4 w-4" />
              Download Alle
            </Button>
          )}
        </div>

        {/* Logo Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {logos.map(logo => {
            const processed = processedLogos.find(p => p.id === logo.id);
            const currentStatus = status[logo.id] || 'idle';
            
            return (
              <Card key={logo.id} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{logo.name}</span>
                    {getStatusIcon(logo.id)}
                  </div>
                  
                  {/* Preview */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Original */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Origineel</span>
                      <div className="bg-[#E5E7EB] rounded-lg p-2 h-20 flex items-center justify-center">
                        <img 
                          src={logo.src} 
                          alt={`${logo.name} origineel`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>
                    
                    {/* Processed */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Transparant</span>
                      <div 
                        className="rounded-lg p-2 h-20 flex items-center justify-center"
                        style={{
                          backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                          backgroundSize: '10px 10px',
                          backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                          backgroundColor: '#fff'
                        }}
                      >
                        {processed ? (
                          <img 
                            src={processed.url} 
                            alt={`${logo.name} transparant`}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => processLogo(logo)}
                      disabled={currentStatus === 'processing' || isProcessingAll}
                    >
                      {currentStatus === 'processing' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Verwerk'
                      )}
                    </Button>
                    
                    {processed && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => downloadLogo(logo.id, logo.filename)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
          <p><strong>Instructies:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Klik op "Alle Logo's Verwerken" of verwerk individuele logo's</li>
            <li>Wacht tot de AI de achtergronden verwijdert (dit kan even duren bij eerste gebruik)</li>
            <li>Download de transparante versies</li>
            <li>Upload de nieuwe logo's naar het project ter vervanging</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
