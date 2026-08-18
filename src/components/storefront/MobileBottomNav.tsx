import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Grid3X3, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface MobileBottomNavProps {
  basePath: string;
  cartCount: number;
  onSearchClick: () => void;
}

export function MobileBottomNav({ basePath, cartCount, onSearchClick }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isActive = (path: string) => {t('storefront.mobileBottomNav.location_pathname_path_return')}
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <nav className="flex items-center justify-around h-14">
        <Link
          to={basePath}
          className={cn(
            "flex flex-col items-center gap-0.5 text-[11px] min-w-[44px] min-h-[44px] justify-center",
            isActive(basePath) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="h-5 w-5" />
          <span>{t('storefront.megaMenu.home')}</span>
        </Link>

        <button
          onClick={onSearchClick}
          className="flex flex-col items-center gap-0.5 text-[11px] text-muted-foreground min-w-[44px] min-h-[44px] justify-center"
        >
          <Search className="h-5 w-5" />
          <span>{t('storefront.mobileBottomNav.zoeken')}</span>
        </button>

        <Link
          to={`${basePath}/products`}
          className={cn(
            "flex flex-col items-center gap-0.5 text-[11px] min-w-[44px] min-h-[44px] justify-center",
            isActive(`${basePath}/products`) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Grid3X3 className="h-5 w-5" />
          <span>{t('navigation.categories')}</span>
        </Link>

        <Link
          to={`${basePath}/cart`}
          className={cn(
            "relative flex flex-col items-center gap-0.5 text-[11px] min-w-[44px] min-h-[44px] justify-center",
            isActive(`${basePath}/cart`) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </div>
          <span>{t('storefront.mobileBottomNav.wagen')}</span>
        </Link>
      </nav>
    </div>
  );
}
