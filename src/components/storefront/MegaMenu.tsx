import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
}

interface MegaMenuProps {
  categories: Category[];
  basePath: string;
}

export function MegaMenu({ categories, basePath }: MegaMenuProps) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Build tree: top-level categories and their children
  const topLevel = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  return (
    <nav className="hidden md:flex items-center gap-1">
      <Link to={basePath} className="text-sm font-medium hover:text-primary transition-colors px-3 py-2">
        Home
      </Link>
      <Link to={`${basePath}/products`} className="text-sm font-medium hover:text-primary transition-colors px-3 py-2">
        Alle Producten
      </Link>

      {topLevel.map(cat => {
        const children = getChildren(cat.id);
        const hasChildren = children.length > 0;

        return (
          <div
            key={cat.id}
            className="relative"
            onMouseEnter={() => hasChildren && setOpenCategory(cat.id)}
            onMouseLeave={() => setOpenCategory(null)}
          >
            <Link
              to={`${basePath}/products?category=${cat.slug}`}
              className="text-sm font-medium hover:text-primary transition-colors px-3 py-2 flex items-center gap-1"
            >
              {cat.name}
              {hasChildren && <ChevronDown className="h-3 w-3" />}
            </Link>

            {/* Dropdown panel */}
            {hasChildren && openCategory === cat.id && (
              <div className="absolute top-full left-0 z-50 bg-background border rounded-lg shadow-lg p-6 min-w-[320px]">
                <div className="grid grid-cols-2 gap-4">
                  {/* Subcategories */}
                  <div className="space-y-2">
                    <Link
                      to={`${basePath}/products?category=${cat.slug}`}
                      className="text-sm font-semibold hover:text-primary block mb-3"
                    >
                      Alle {cat.name}
                    </Link>
                    {children.map(child => (
                      <Link
                        key={child.id}
                        to={`${basePath}/products?category=${child.slug}`}
                        className="text-sm text-muted-foreground hover:text-foreground block py-1"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>

                  {/* Category image if available */}
                  {cat.image_url && (
                    <div className="rounded-lg overflow-hidden">
                      <img src={cat.image_url} alt={cat.name} className="w-full h-32 object-cover rounded-lg" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
