import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Grid3X3, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  basePath: string;
  cartCount: number;
  onSearchClick: () => void;
}

export function MobileBottomNav({ basePath, cartCount, onSearchClick }: MobileBottomNavProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <nav className="flex items-center justify-around h-14">
        <Link
          to={basePath}
          className={cn(
            "flex flex-col items-center gap-0.5 text-xs",
            isActive(basePath) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>

        <button
          onClick={onSearchClick}
          className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground"
        >
          <Search className="h-5 w-5" />
          <span>Zoeken</span>
        </button>

        <Link
          to={`${basePath}/products`}
          className={cn(
            "flex flex-col items-center gap-0.5 text-xs",
            isActive(`${basePath}/products`) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Grid3X3 className="h-5 w-5" />
          <span>Categorieën</span>
        </Link>

        <Link
          to={`${basePath}/cart`}
          className={cn(
            "relative flex flex-col items-center gap-0.5 text-xs",
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
          <span>Wagen</span>
        </Link>
      </nav>
    </div>
  );
}
