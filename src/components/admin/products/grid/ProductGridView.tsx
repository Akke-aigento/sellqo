import { useState, useCallback, useEffect } from 'react';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { useVatRates } from '@/hooks/useVatRates';
import { useProducts } from '@/hooks/useProducts';
import { useProductGrid } from '@/hooks/useProductGrid';
import { useTenant } from '@/hooks/useTenant';
import type { Product } from '@/types/product';
import type { ProductSocialChannels } from '@/types/socialChannels';
import { ColumnConfig } from './ColumnConfig';
import { GridTextCell } from './GridTextCell';
import { GridNumberCell } from './GridNumberCell';
import { GridSelectCell } from './GridSelectCell';
import { GridMultiSelectCell } from './GridMultiSelectCell';
import { GridToggleCell } from './GridToggleCell';
import { GridTagsCell } from './GridTagsCell';
import { GridChannelsCell } from './GridChannelsCell';
import { CellBulkEditor } from './CellBulkEditor';
import { ChangesPanel } from './ChangesPanel';
import { GRID_COLUMNS } from './gridTypes';
import { cn } from '@/lib/utils';

interface ProductGridViewProps {
  products: Product[];
}

export function ProductGridView({ products }: ProductGridViewProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const { categories } = useCategories();
  const { vatRates } = useVatRates();
  const { updateProduct } = useProducts();
  
  const [isSaving, setIsSaving] = useState(false);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [bulkEditorField, setBulkEditorField] = useState<string | null>(null);

  const grid = useProductGrid(products);

  // Build select options
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const vatRateOptions = vatRates.map(v => ({ value: v.id, label: `${v.name_nl || v.category} (${v.rate}%)` }));

  // Handle cell click
  const handleCellClick = useCallback((
    e: React.MouseEvent,
    productId: string,
    field: string
  ) => {
    if (e.shiftKey) {
      grid.selectRange(productId, field);
    } else if (e.ctrlKey || e.metaKey) {
      grid.selectCell(productId, field, true);
    } else {
      grid.selectCell(productId, field);
    }
  }, [grid]);

  // Handle bulk edit button click
  const handleBulkEditClick = () => {
    if (grid.selectedFields.length === 1) {
      const field = grid.selectedFields[0];
      const colDef = GRID_COLUMNS.find(c => c.field === field);
      if (colDef?.bulkEditable) {
        setBulkEditorField(field);
        setBulkEditorOpen(true);
      }
    }
  };

  // Apply bulk adjustment
  const handleBulkApply = (
    type: 'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact',
    value: number
  ) => {
    if (bulkEditorField) {
      grid.applyBulkAdjustment(bulkEditorField, type, value);
    }
  };

  // Apply bulk channel changes
  const handleBulkApplyChannels = (channels: Record<string, boolean>) => {
    if (bulkEditorField) {
      grid.applyBulkChannels(bulkEditorField, channels);
    }
  };

  // Save all changes
  const handleSaveAll = async () => {
    const changes = grid.getChangesForSave();
    if (changes.length === 0) return;

    setIsSaving(true);
    try {
      // Save each product's changes
      for (const change of changes) {
        await updateProduct.mutateAsync({
          id: change.id,
          data: change.data as any,
        });
      }
      
      grid.clearAllPendingChanges();
      toast({
        title: 'Wijzigingen opgeslagen',
        description: `${changes.length} product(en) bijgewerkt`,
      });
    } catch (error) {
      toast({
        title: 'Fout bij opslaan',
        description: error instanceof Error ? error.message : 'Er ging iets mis',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (grid.pendingChangesList.length > 0) {
          handleSaveAll();
        }
      }
      // Escape to clear selection
      if (e.key === 'Escape' && !grid.editingCell) {
        grid.clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [grid.pendingChangesList.length, grid.editingCell]);

  // Render a cell based on type
  const renderCell = (product: Product, colDef: typeof GRID_COLUMNS[number]) => {
    const field = colDef.field;
    const isEditing = grid.editingCell?.productId === product.id && grid.editingCell?.field === field;
    const isSelected = grid.isCellSelected(product.id, field);
    const hasChange = grid.hasPendingChange(product.id, field);
    const value = grid.getCellValue(product, field);

    const commonProps = {
      isEditing,
      isSelected,
      hasChange,
      onStartEdit: () => grid.startEditing(product.id, field),
      onStopEdit: () => grid.stopEditing(),
      onNavigate: grid.navigateCell,
    };

    switch (colDef.type) {
      case 'text':
        return (
          <GridTextCell
            {...commonProps}
            value={value as string ?? ''}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
          />
        );

      case 'number':
        return (
          <GridNumberCell
            {...commonProps}
            value={value as number | null}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
          />
        );

      case 'currency':
        return (
          <GridNumberCell
            {...commonProps}
            value={value as number | null}
            isCurrency
            currency={currentTenant?.currency || 'EUR'}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
          />
        );

      case 'select':
        const options = field === 'category_id' ? categoryOptions : 
                       field === 'vat_rate_id' ? vatRateOptions : [];
        return (
          <GridSelectCell
            {...commonProps}
            value={value as string | null}
            options={options}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
          />
        );

      case 'toggle':
        return (
          <GridToggleCell
            isSelected={isSelected}
            hasChange={hasChange}
            value={value as boolean}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
            onSelect={() => handleCellClick({ shiftKey: false, ctrlKey: false, metaKey: false } as any, product.id, field)}
          />
        );

      case 'tags':
        return (
          <GridTagsCell
            {...commonProps}
            value={value as string[] ?? []}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
          />
        );

      case 'channels':
        return (
          <GridChannelsCell
            {...commonProps}
            value={value as ProductSocialChannels | null}
            onChange={(v) => grid.setCellValue(product.id, field, v)}
          />
        );

      default:
        return <span className="text-sm text-muted-foreground">-</span>;
    }
  };

  // Get bulk edit field info
  const bulkEditFieldDef = bulkEditorField 
    ? GRID_COLUMNS.find(c => c.field === bulkEditorField) 
    : null;
  
  const canBulkEdit = grid.selectedFields.length === 1 && 
    GRID_COLUMNS.find(c => c.field === grid.selectedFields[0])?.bulkEditable;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {grid.selectedCellsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
              <span className="text-sm font-medium">
                {grid.selectedCellsCount} cel(len) geselecteerd
              </span>
              {canBulkEdit && (
                <Button size="sm" variant="secondary" onClick={handleBulkEditClick}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Bulk bewerken
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={grid.clearSelection}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <ColumnConfig
          columns={GRID_COLUMNS}
          visibleColumns={grid.visibleColumns}
          onToggleColumn={grid.toggleColumn}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <ScrollArea className="h-full">
          <div className="min-w-max">
            {/* Header */}
            <div className="flex border-b bg-muted/50 sticky top-0 z-10">
              <div className="w-10 flex-shrink-0 p-2 border-r" />
              {grid.visibleColumnDefs.map((col) => (
                <div
                  key={col.field}
                  className="border-r p-2 text-sm font-medium text-muted-foreground"
                  style={{ width: col.width, minWidth: col.minWidth }}
                >
                  {col.header}
                </div>
              ))}
            </div>

            {/* Rows */}
            {products.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Geen producten om weer te geven
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  className="flex border-b hover:bg-muted/30 transition-colors"
                >
                  {/* Row number / indicator */}
                  <div className="w-10 flex-shrink-0 p-2 border-r flex items-center justify-center text-xs text-muted-foreground">
                    {grid.pendingChanges.has(product.id) && (
                      <div className="w-2 h-2 rounded-full bg-amber-500" title="Heeft wijzigingen" />
                    )}
                  </div>
                  
                  {/* Cells */}
                  {grid.visibleColumnDefs.map((col) => (
                    <div
                      key={col.field}
                      className={cn(
                        'border-r p-1',
                        col.editable && 'cursor-pointer'
                      )}
                      style={{ width: col.width, minWidth: col.minWidth }}
                      onClick={(e) => col.editable && handleCellClick(e, product.id, col.field)}
                    >
                      {renderCell(product, col)}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Changes Panel */}
      <ChangesPanel
        changes={grid.pendingChangesList}
        onClearChange={grid.clearPendingChange}
        onClearAll={grid.clearAllPendingChanges}
        onSaveAll={handleSaveAll}
        isSaving={isSaving}
      />

      {/* Bulk Editor Dialog */}
      {bulkEditFieldDef && (
        <CellBulkEditor
          open={bulkEditorOpen}
          onOpenChange={setBulkEditorOpen}
          field={bulkEditorField!}
          fieldLabel={bulkEditFieldDef.header}
          cellCount={grid.getSelectedCellsByField(bulkEditorField!).length}
          fieldType={bulkEditFieldDef.type}
          onApply={handleBulkApply}
          onApplyChannels={handleBulkApplyChannels}
        />
      )}
    </div>
  );
}
