import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import type { HomepageSection } from '@/types/storefront';

const MAX_HISTORY_SIZE = 50;

interface HistoryEntry {
  sectionId: string;
  previousState: Partial<HomepageSection>;
  newState: Partial<HomepageSection>;
  timestamp: number;
}

interface VisualEditorContextType {
  isEditMode: boolean;
  selectedSectionId: string | null;
  setSelectedSectionId: (id: string | null) => void;
  optimisticUpdate: (sectionId: string, updates: Partial<HomepageSection>) => void;
  pendingChanges: Map<string, Partial<HomepageSection>>;
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  undoCount: number;
  redoCount: number;
}

const VisualEditorContext = createContext<VisualEditorContextType | null>(null);

export function VisualEditorProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [pendingChanges] = useState(new Map<string, Partial<HomepageSection>>());
  
  // History stacks for undo/redo
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  
  // Track if we're currently applying an undo/redo to prevent pushing to history
  const isApplyingHistory = useRef(false);

  const optimisticUpdate = useCallback((sectionId: string, updates: Partial<HomepageSection>) => {
    // Update local cache immediately for instant feedback
    queryClient.setQueryData<HomepageSection[]>(
      ['homepage-sections', currentTenant?.id],
      (old) => {
        if (!old) return old;
        return old.map(section => 
          section.id === sectionId 
            ? { ...section, ...updates }
            : section
        );
      }
    );
  }, [queryClient, currentTenant?.id]);

  const pushHistory = useCallback((entry: Omit<HistoryEntry, 'timestamp'>) => {
    // Don't push to history if we're applying an undo/redo
    if (isApplyingHistory.current) return;
    
    setUndoStack(prev => {
      const newStack = [...prev, { ...entry, timestamp: Date.now() }];
      // Keep only the last MAX_HISTORY_SIZE entries
      if (newStack.length > MAX_HISTORY_SIZE) {
        return newStack.slice(-MAX_HISTORY_SIZE);
      }
      return newStack;
    });
    // Clear redo stack when new action is performed
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const lastEntry = undoStack[undoStack.length - 1];
    
    isApplyingHistory.current = true;
    
    // Apply the previous state
    optimisticUpdate(lastEntry.sectionId, lastEntry.previousState);
    
    // Move entry to redo stack
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastEntry]);
    
    // Also trigger a mutation to persist the change
    // This will be handled by the component using the context
    
    isApplyingHistory.current = false;
  }, [undoStack, optimisticUpdate]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const lastEntry = redoStack[redoStack.length - 1];
    
    isApplyingHistory.current = true;
    
    // Apply the new state
    optimisticUpdate(lastEntry.sectionId, lastEntry.newState);
    
    // Move entry back to undo stack
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, lastEntry]);
    
    isApplyingHistory.current = false;
  }, [redoStack, optimisticUpdate]);

  return (
    <VisualEditorContext.Provider
      value={{
        isEditMode: true,
        selectedSectionId,
        setSelectedSectionId,
        optimisticUpdate,
        pendingChanges,
        // Undo/Redo
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undo,
        redo,
        pushHistory,
        undoCount: undoStack.length,
        redoCount: redoStack.length,
      }}
    >
      {children}
    </VisualEditorContext.Provider>
  );
}

export function useVisualEditor() {
  const context = useContext(VisualEditorContext);
  if (!context) {
    throw new Error('useVisualEditor must be used within VisualEditorProvider');
  }
  return context;
}
