import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { renderMiniSection } from './preview/MiniSections';
import type { HomepageSection } from '@/types/storefront';

interface LiveThemePreviewProps {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor?: string;
  textColor?: string;
  headingFont: string;
  bodyFont: string;
  headerStyle: string;
  productCardStyle: string;
  productsPerRow: number;
  logoUrl?: string | null;
  shopName?: string;
  homepageSections?: HomepageSection[];
}

type Device = 'desktop' | 'tablet' | 'mobile';

export function LiveThemePreview({
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor = '#ffffff',
  textColor = '#1a1a1a',
  headingFont,
  bodyFont,
  headerStyle,
  productCardStyle,
  productsPerRow,
  logoUrl,
  shopName = 'Mijn Webshop',
  homepageSections,
}: LiveThemePreviewProps) {
  const [device, setDevice] = useState<Device>('desktop');

  const deviceWidths: Record<Device, string> = {
    desktop: 'w-full',
    tablet: 'w-[380px]',
    mobile: 'w-[240px]',
  };

  const hasSections = homepageSections && homepageSections.length > 0;

  // Fallback mock products for when no sections are configured
  const mockProducts = [
    { name: 'Premium T-Shirt', price: '€29,99', oldPrice: '€39,99' },
    { name: 'Canvas Sneakers', price: '€89,00', oldPrice: null },
    { name: 'Leren Rugzak', price: '€149,00', oldPrice: '€179,00' },
    { name: 'Zonnebril Classic', price: '€45,00', oldPrice: null },
  ];
  const visibleProducts = mockProducts.slice(0, Math.min(productsPerRow, 4));

  const sectionProps = { primaryColor, secondaryColor, accentColor, textColor, headingFont };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Live Preview</p>
        <div className="flex gap-1">
          {([
            { key: 'desktop', icon: Monitor },
            { key: 'tablet', icon: Tablet },
            { key: 'mobile', icon: Smartphone },
          ] as const).map(({ key, icon: Icon }) => (
            <Button
              key={key}
              variant={device === key ? 'default' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setDevice(key)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className={cn(
            'rounded-lg border-2 border-border overflow-hidden transition-all duration-300 shadow-lg',
            deviceWidths[device]
          )}
          style={{ backgroundColor, color: textColor, fontFamily: `"${bodyFont}", sans-serif` }}
        >
          {/* Announcement bar */}
          <div
            className="text-center py-1 text-[8px] font-medium tracking-wide"
            style={{ backgroundColor: primaryColor, color: '#fff' }}
          >
            🚀 Gratis verzending vanaf €50
          </div>

          {/* Header */}
          <div className="border-b px-3 py-2">
            {headerStyle === 'centered' ? (
              <div className="text-center space-y-1">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-5 mx-auto" />
                ) : (
                  <p className="text-[10px] font-bold" style={{ fontFamily: `"${headingFont}", serif` }}>
                    {shopName}
                  </p>
                )}
                <div className="flex justify-center gap-3 text-[7px] text-muted-foreground">
                  <span>Home</span><span>Shop</span><span>Over ons</span><span>Contact</span>
                </div>
              </div>
            ) : headerStyle === 'minimal' ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="space-y-0.5">
                    <div className="w-3 h-[1.5px] rounded" style={{ backgroundColor: textColor }} />
                    <div className="w-2.5 h-[1.5px] rounded" style={{ backgroundColor: textColor }} />
                    <div className="w-3 h-[1.5px] rounded" style={{ backgroundColor: textColor }} />
                  </div>
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-4" />
                  ) : (
                    <p className="text-[9px] font-bold" style={{ fontFamily: `"${headingFont}", serif` }}>{shopName}</p>
                  )}
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor + '30' }} />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-4" />
                ) : (
                  <p className="text-[9px] font-bold" style={{ fontFamily: `"${headingFont}", serif` }}>{shopName}</p>
                )}
                <div className="flex gap-3 text-[7px]">
                  <span>Home</span><span>Shop</span><span>Over ons</span>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor + '30' }} />
              </div>
            )}
          </div>

          {/* Content: Dynamic sections or fallback mock */}
          {hasSections ? (
            <div>
              {homepageSections.map(section => renderMiniSection(section, sectionProps))}
            </div>
          ) : (
            <>
              {/* Fallback: Hero */}
              <div
                className="px-3 py-4 text-center"
                style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${accentColor}10)` }}
              >
                <h2 className="text-[11px] font-bold mb-1" style={{ fontFamily: `"${headingFont}", serif`, color: textColor }}>
                  Nieuwe Collectie
                </h2>
                <p className="text-[7px] mb-2 opacity-70">Ontdek onze nieuwste producten</p>
                <div className="inline-block rounded-full px-3 py-0.5 text-[7px] font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  Shop Nu →
                </div>
              </div>

              {/* Fallback: Products Grid */}
              <div className="p-3">
                <h3 className="text-[9px] font-bold mb-2" style={{ fontFamily: `"${headingFont}", serif` }}>Uitgelicht</h3>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(device === 'mobile' ? 2 : productsPerRow, 4)}, 1fr)` }}>
                  {visibleProducts.map((product, i) => (
                    <div key={i} className={cn('group', productCardStyle === 'detailed' && 'space-y-1.5', productCardStyle === 'minimal' && 'space-y-0.5', productCardStyle === 'standard' && 'space-y-1')}>
                      <div className="aspect-square rounded-md relative overflow-hidden" style={{ backgroundColor: secondaryColor + '20' }}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                          <div className="w-1/2 h-1/2 rounded-full" style={{ backgroundColor: primaryColor }} />
                        </div>
                        {product.oldPrice && (
                          <div className="absolute top-1 left-1 px-1 rounded text-[5px] font-bold text-white" style={{ backgroundColor: accentColor }}>SALE</div>
                        )}
                      </div>
                      <p className="text-[7px] font-medium truncate">{product.name}</p>
                      {productCardStyle !== 'minimal' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[7px] font-bold" style={{ color: accentColor }}>{product.price}</span>
                          {product.oldPrice && <span className="text-[6px] line-through opacity-40">{product.oldPrice}</span>}
                        </div>
                      )}
                      {productCardStyle === 'detailed' && (
                        <p className="text-[5px] opacity-50 line-clamp-2">Premium kwaliteit met oog voor detail en duurzame materialen.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="border-t px-3 py-2 text-center">
            <p className="text-[6px] opacity-40">© 2026 {shopName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
