import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { useBulkSelection } from '@/contexts/BulkSelectionContext';
import { Button } from '@/components/ui/button';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Package, label: 'Producten', path: '/admin/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/admin/orders' },
];

export function AdminBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();
  const { selectedCount, bulkActions, clearBulk } = useBulkSelection();

  const isPOS = location.pathname.startsWith('/admin/pos/') || location.pathname.startsWith('/kassa/');
  if (isPOS) return null;

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  // Bulk action mode
  if (selectedCount > 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground border-t lg:hidden animate-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center h-14 px-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={clearBulk}
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium mr-auto">
            {selectedCount} geselecteerd
          </span>
          <div className="flex items-center gap-1">
            {bulkActions.map((action, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 text-xs text-primary-foreground hover:bg-primary-foreground/20',
                  action.variant === 'destructive' && 'hover:bg-destructive/80'
                )}
                onClick={action.onClick}
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t lg:hidden">
      <nav className="flex items-center justify-around h-14">
        {navItems.map(({ icon: Icon, label, path }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex flex-col items-center gap-0.5 text-xs min-w-0 px-2 py-1 transition-colors',
              isActive(path)
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground min-w-0 px-2 py-1"
        >
          <Menu className="h-5 w-5" />
          <span>Meer</span>
        </button>
      </nav>
    </div>
  );
}
