import { useState } from 'react';
import { MoveRight, Check, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/product';

interface CategoryMoveDropdownProps {
  category: Category;
  allCategories: Category[];
  onMove: (categoryId: string, newParentId: string | null) => void;
}

// Helper to check if targetId is a descendant of parentId
function isDescendantOf(categories: Category[], targetId: string, parentId: string): boolean {
  const findInChildren = (cats: Category[], target: string): boolean => {
    for (const cat of cats) {
      if (cat.id === target) return true;
      if (cat.children && findInChildren(cat.children, target)) return true;
    }
    return false;
  };

  const parent = categories.find(c => c.id === parentId);
  if (!parent || !parent.children) return false;
  return findInChildren(parent.children, targetId);
}

// Flatten tree for dropdown display
function flattenTree(categories: Category[], level = 0): { category: Category; level: number }[] {
  return categories.flatMap(cat => [
    { category: cat, level },
    ...(cat.children ? flattenTree(cat.children, level + 1) : []),
  ]);
}

export function CategoryMoveDropdown({ category, allCategories, onMove }: CategoryMoveDropdownProps) {
  const [open, setOpen] = useState(false);

  const flatCategories = flattenTree(allCategories);

  const handleMove = (newParentId: string | null) => {
    if (newParentId === category.parent_id) return;
    onMove(category.id, newParentId);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Verplaatsen naar..."
        >
          <MoveRight className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto bg-popover z-50">
        <DropdownMenuLabel>Verplaatsen naar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Root option */}
        <DropdownMenuItem
          onClick={() => handleMove(null)}
          className={cn(
            "flex items-center gap-2",
            category.parent_id === null && "bg-muted"
          )}
        >
          <Home className="h-4 w-4" />
          <span className="flex-1">Hoofdniveau (geen parent)</span>
          {category.parent_id === null && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {flatCategories.map(({ category: cat, level }) => {
          const isSelf = cat.id === category.id;
          const isDescendant = isDescendantOf(allCategories, cat.id, category.id);
          const isCurrent = cat.id === category.parent_id;
          const isDisabled = isSelf || isDescendant;

          return (
            <DropdownMenuItem
              key={cat.id}
              onClick={() => !isDisabled && handleMove(cat.id)}
              className={cn(
                "flex items-center gap-2",
                isDisabled && "opacity-50 cursor-not-allowed",
                isCurrent && "bg-muted"
              )}
              disabled={isDisabled}
            >
              <span style={{ marginLeft: level * 12 }} className="flex items-center gap-2 flex-1">
                <span className="truncate">{cat.name}</span>
              </span>
              {isCurrent && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
