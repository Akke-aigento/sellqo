import { useState } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTenant } from '@/hooks/useTenant';

interface PreviewPanelProps {
  className?: string;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceType, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function PreviewPanel({ className }: PreviewPanelProps) {
  const { currentTenant } = useTenant();
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);

  const previewUrl = currentTenant 
    ? `/shop/${currentTenant.slug}?preview=true` 
    : '/shop/preview';

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    const externalUrl = currentTenant 
      ? `/shop/${currentTenant.slug}` 
      : '/shop/preview';
    window.open(externalUrl, '_blank');
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <ToggleGroup 
          type="single" 
          value={device} 
          onValueChange={(value) => value && setDevice(value as DeviceType)}
          size="sm"
        >
          <ToggleGroupItem value="desktop" aria-label="Desktop view">
            <Monitor className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" aria-label="Tablet view">
            <Tablet className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Mobile view">
            <Smartphone className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenExternal}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div 
        className="bg-muted/30 rounded-lg border p-4 flex justify-center overflow-auto"
        style={{ minHeight: '500px' }}
      >
        <div 
          className="bg-background rounded-lg shadow-lg overflow-hidden transition-all duration-300"
          style={{ 
            width: deviceWidths[device],
            maxWidth: '100%',
            height: device === 'mobile' ? '667px' : device === 'tablet' ? '600px' : '100%',
          }}
        >
          <iframe
            key={refreshKey}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Storefront Preview"
            style={{ minHeight: device === 'desktop' ? '600px' : undefined }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-2">
        Preview wordt automatisch bijgewerkt na opslaan
      </p>
    </div>
  );
}
