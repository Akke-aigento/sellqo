import { useState, useCallback, useMemo } from 'react';
import type { Product } from '@/types/product';
import type { CellPosition, PendingChange, ColumnDefinition } from '@/components/admin/products/grid/gridTypes';
import { GRID_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from '@/components/admin/products/grid/gridTypes';

const STORAGE_KEY = 'product-grid-columns';

function loadVisibleColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_VISIBLE_COLUMNS;
}

function saveVisibleColumns(columns: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Ignore errors
  }
}

export function useProductGrid(products: Product[]) {
  // Cell selection state
  const [selectedCells, setSelectedCells] = useState<Map<string, Set<string>>>(new Map());
  const [lastSelectedCell, setLastSelectedCell] = useState<CellPosition | null>(null);
  
  // Pending changes state
  const [pendingChanges, setPendingChanges] = useState<Map<string, Map<string, unknown>>>(new Map());
  
  // Editing state
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(loadVisibleColumns);

  // Get visible column definitions
  const visibleColumnDefs = useMemo(() => {
    return GRID_COLUMNS.filter(col => visibleColumns.includes(col.field));
  }, [visibleColumns]);

  // Toggle column visibility
  const toggleColumn = useCallback((field: string) => {
    setVisibleColumns(prev => {
      const newCols = prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field];
      saveVisibleColumns(newCols);
      return newCols;
    });
  }, []);

  // Select a single cell
  const selectCell = useCallback((productId: string, field: string, addToSelection: boolean = false) => {
    setSelectedCells(prev => {
      const next = addToSelection ? new Map(prev) : new Map();
      
      if (!next.has(productId)) {
        next.set(productId, new Set());
      }
      
      const fields = next.get(productId)!;
      if (addToSelection && fields.has(field)) {
        fields.delete(field);
        if (fields.size === 0) {
          next.delete(productId);
        }
      } else {
        fields.add(field);
      }
      
      return next;
    });
    setLastSelectedCell({ productId, field });
  }, []);

  // Select range of cells (Shift+Click)
  const selectRange = useCallback((productId: string, field: string) => {
    if (!lastSelectedCell) {
      selectCell(productId, field);
      return;
    }

    const startIndex = products.findIndex(p => p.id === lastSelectedCell.productId);
    const endIndex = products.findIndex(p => p.id === productId);
    
    if (startIndex === -1 || endIndex === -1) {
      selectCell(productId, field);
      return;
    }

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    setSelectedCells(prev => {
      const next = new Map(prev);
      
      for (let i = minIndex; i <= maxIndex; i++) {
        const pid = products[i].id;
        if (!next.has(pid)) {
          next.set(pid, new Set());
        }
        next.get(pid)!.add(field);
      }
      
      return next;
    });
  }, [lastSelectedCell, products, selectCell]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedCells(new Map());
    setLastSelectedCell(null);
  }, []);

  // Check if cell is selected
  const isCellSelected = useCallback((productId: string, field: string) => {
    return selectedCells.get(productId)?.has(field) ?? false;
  }, [selectedCells]);

  // Get total selected cells count
  const selectedCellsCount = useMemo(() => {
    let count = 0;
    selectedCells.forEach(fields => {
      count += fields.size;
    });
    return count;
  }, [selectedCells]);

  // Get selected cells of a specific field type (for bulk editing)
  const getSelectedCellsByField = useCallback((field: string): string[] => {
    const productIds: string[] = [];
    selectedCells.forEach((fields, productId) => {
      if (fields.has(field)) {
        productIds.push(productId);
      }
    });
    return productIds;
  }, [selectedCells]);

  // Get unique fields in selection (to determine bulk edit options)
  const selectedFields = useMemo(() => {
    const fields = new Set<string>();
    selectedCells.forEach(fieldSet => {
      fieldSet.forEach(f => fields.add(f));
    });
    return Array.from(fields);
  }, [selectedCells]);

  // Set cell value (adds to pending changes)
  const setCellValue = useCallback((productId: string, field: string, value: unknown) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      
      if (!next.has(productId)) {
        next.set(productId, new Map());
      }
      
      next.get(productId)!.set(field, value);
      return next;
    });
  }, []);

  // Get pending value for a cell (or original if no pending)
  const getCellValue = useCallback((product: Product, field: string): unknown => {
    const pending = pendingChanges.get(product.id)?.get(field);
    if (pending !== undefined) {
      return pending;
    }
    return (product as unknown as Record<string, unknown>)[field];
  }, [pendingChanges]);

  // Check if cell has pending change
  const hasPendingChange = useCallback((productId: string, field: string) => {
    return pendingChanges.get(productId)?.has(field) ?? false;
  }, [pendingChanges]);

  // Get all pending changes as list
  const pendingChangesList = useMemo((): PendingChange[] => {
    const changes: PendingChange[] = [];
    
    pendingChanges.forEach((fieldChanges, productId) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      fieldChanges.forEach((newValue, field) => {
        const colDef = GRID_COLUMNS.find(c => c.field === field);
        const oldValue = (product as unknown as Record<string, unknown>)[field];
        
        // Only add if value actually changed
        if (oldValue !== newValue) {
          changes.push({
            productId,
            productName: product.name,
            field,
            fieldLabel: colDef?.header ?? field,
            oldValue,
            newValue,
          });
        }
      });
    });
    
    return changes;
  }, [pendingChanges, products]);

  // Clear a specific pending change
  const clearPendingChange = useCallback((productId: string, field: string) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const productChanges = next.get(productId);
      
      if (productChanges) {
        productChanges.delete(field);
        if (productChanges.size === 0) {
          next.delete(productId);
        }
      }
      
      return next;
    });
  }, []);

  // Clear all pending changes
  const clearAllPendingChanges = useCallback(() => {
    setPendingChanges(new Map());
  }, []);

  // Apply bulk value to selected cells of a specific field
  const applyBulkValue = useCallback((field: string, value: unknown) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      
      selectedCells.forEach((fields, productId) => {
        if (fields.has(field)) {
          if (!next.has(productId)) {
            next.set(productId, new Map());
          }
          next.get(productId)!.set(field, value);
        }
      });
      
      return next;
    });
  }, [selectedCells]);

  // Apply bulk channel changes (merge with existing)
  const applyBulkChannels = useCallback((field: string, channelChanges: Record<string, boolean>) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      
      selectedCells.forEach((fields, productId) => {
        if (fields.has(field)) {
          const product = products.find(p => p.id === productId);
          if (!product) return;
          
          const currentChannels = (getCellValue(product, field) as Record<string, boolean>) || {};
          const newChannels = { ...currentChannels };
          
          // Apply changes - only set values that are explicitly in channelChanges
          Object.entries(channelChanges).forEach(([channelType, enabled]) => {
            newChannels[channelType] = enabled;
          });
          
          if (!next.has(productId)) {
            next.set(productId, new Map());
          }
          next.get(productId)!.set(field, newChannels);
        }
      });
      
      return next;
    });
  }, [selectedCells, products, getCellValue]);

  // Apply bulk adjustment (for numeric fields)
  const applyBulkAdjustment = useCallback((
    field: string, 
    type: 'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact',
    value: number
  ) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      
      selectedCells.forEach((fields, productId) => {
        if (fields.has(field)) {
          const product = products.find(p => p.id === productId);
          if (!product) return;
          
          const currentValue = (getCellValue(product, field) as number) || 0;
          let newValue: number;
          
          switch (type) {
            case 'add':
              newValue = currentValue + value;
              break;
            case 'subtract':
              newValue = Math.max(0, currentValue - value);
              break;
            case 'percentage_up':
              newValue = Math.round(currentValue * (1 + value / 100) * 100) / 100;
              break;
            case 'percentage_down':
              newValue = Math.round(currentValue * (1 - value / 100) * 100) / 100;
              break;
            case 'exact':
              newValue = value;
              break;
            default:
              newValue = currentValue;
          }
          
          if (!next.has(productId)) {
            next.set(productId, new Map());
          }
          next.get(productId)!.set(field, newValue);
        }
      });
      
      return next;
    });
  }, [selectedCells, products, getCellValue]);

  // Get changes grouped by product for saving
  const getChangesForSave = useCallback((): { id: string; data: Record<string, unknown> }[] => {
    const result: { id: string; data: Record<string, unknown> }[] = [];
    
    pendingChanges.forEach((fieldChanges, productId) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      const data: Record<string, unknown> = {};
      let hasRealChanges = false;
      
      fieldChanges.forEach((newValue, field) => {
        const oldValue = (product as unknown as Record<string, unknown>)[field];
        if (oldValue !== newValue) {
          data[field] = newValue;
          hasRealChanges = true;
        }
      });
      
      if (hasRealChanges) {
        result.push({ id: productId, data });
      }
    });
    
    return result;
  }, [pendingChanges, products]);

  // Start editing a cell
  const startEditing = useCallback((productId: string, field: string) => {
    setEditingCell({ productId, field });
  }, []);

  // Stop editing
  const stopEditing = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Navigate to next/previous cell
  const navigateCell = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!editingCell) return;
    
    const currentProductIndex = products.findIndex(p => p.id === editingCell.productId);
    const currentColIndex = visibleColumnDefs.findIndex(c => c.field === editingCell.field);
    
    if (currentProductIndex === -1 || currentColIndex === -1) return;
    
    let newProductIndex = currentProductIndex;
    let newColIndex = currentColIndex;
    
    switch (direction) {
      case 'up':
        newProductIndex = Math.max(0, currentProductIndex - 1);
        break;
      case 'down':
        newProductIndex = Math.min(products.length - 1, currentProductIndex + 1);
        break;
      case 'left':
        newColIndex = Math.max(0, currentColIndex - 1);
        break;
      case 'right':
        newColIndex = Math.min(visibleColumnDefs.length - 1, currentColIndex + 1);
        break;
    }
    
    const newProduct = products[newProductIndex];
    const newCol = visibleColumnDefs[newColIndex];
    
    if (newProduct && newCol && newCol.editable) {
      setEditingCell({ productId: newProduct.id, field: newCol.field });
    }
  }, [editingCell, products, visibleColumnDefs]);

  return {
    // Selection
    selectedCells,
    selectedCellsCount,
    selectedFields,
    selectCell,
    selectRange,
    clearSelection,
    isCellSelected,
    getSelectedCellsByField,
    
    // Pending changes
    pendingChanges,
    pendingChangesList,
    setCellValue,
    getCellValue,
    hasPendingChange,
    clearPendingChange,
    clearAllPendingChanges,
    getChangesForSave,
    
    // Bulk operations
    applyBulkValue,
    applyBulkAdjustment,
    applyBulkChannels,
    
    // Editing
    editingCell,
    startEditing,
    stopEditing,
    navigateCell,
    
    // Columns
    visibleColumns,
    visibleColumnDefs,
    toggleColumn,
    allColumns: GRID_COLUMNS,
  };
}
