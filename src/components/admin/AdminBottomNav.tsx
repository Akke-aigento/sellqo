import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Menu, X, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { useBulkSelection } from '@/contexts/BulkSelectionContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  const primaryActions = bulkActions.filter(a => a.primary !== false);
  const secondaryActions = bulkActions.filter(a => a.primary === false);

  // Bulk action mode
  if (selectedCount > 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground border-t lg:hidden animate-in slide-in-from-bottom-2 duration-200" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <nav className="flex items-center justify-around h-16">
          <button
            onClick={clearBulk}
            className="flex flex-col items-center gap-0.5 text-xs min-w-0 px-2 py-1 text-primary-foreground/80"
          >
            <X className="h-5 w-5" />
            <span>{selectedCount}</span>
          </button>
          {primaryActions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="flex flex-col items-center gap-0.5 text-xs min-w-0 px-2 py-1 text-primary-foreground"
            >
              {action.icon || <Package className="h-5 w-5" />}
              <span className="truncate max-w-[4.5rem]">{action.label}</span>
            </button>
          ))}
          {secondaryActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center gap-0.5 text-xs min-w-0 px-2 py-1 text-primary-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                  <span>Meer</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="mb-2">
                {secondaryActions.map((action, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={action.onClick}
                    className={cn(
                      'gap-2',
                      action.variant === 'destructive' && 'text-destructive focus:text-destructive'
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
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
