import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface BulkAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  primary?: boolean;
}

interface BulkSelectionContextType {
  selectedCount: number;
  bulkActions: BulkAction[];
  setBulkActions: (actions: BulkAction[]) => void;
  setSelectedCount: (count: number) => void;
  clearBulk: () => void;
}

const BulkSelectionContext = createContext<BulkSelectionContextType | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [bulkActions, setBulkActions] = useState<BulkAction[]>([]);

  const clearBulk = useCallback(() => {
    setSelectedCount(0);
    setBulkActions([]);
  }, []);

  return (
    <BulkSelectionContext.Provider value={{ selectedCount, bulkActions, setBulkActions, setSelectedCount, clearBulk }}>
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function useBulkSelection() {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx) throw new Error('useBulkSelection must be used within BulkSelectionProvider');
  return ctx;
}
