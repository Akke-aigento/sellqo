import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import type { ColumnDefinition } from './gridTypes';

interface ColumnConfigProps {
  columns: ColumnDefinition[];
  visibleColumns: string[];
  onToggleColumn: (field: string) => void;
}

export function ColumnConfig({
  columns,
  visibleColumns,
  onToggleColumn,
}: ColumnConfigProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Kolommen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 z-50 bg-popover" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Zichtbare kolommen</h4>
          <div className="space-y-2">
            {columns.map((col) => (
              <div key={col.field} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${col.field}`}
                  checked={visibleColumns.includes(col.field)}
                  onCheckedChange={() => onToggleColumn(col.field)}
                />
                <Label
                  htmlFor={`col-${col.field}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {col.header}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
