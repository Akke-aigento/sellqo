import { useEffect, useCallback } from 'react';
import { useVisualEditor } from '../VisualEditorContext';

/**
 * Hook that provides keyboard shortcuts for undo/redo functionality
 * Ctrl+Z = Undo
 * Ctrl+Shift+Z or Ctrl+Y = Redo
 */
export function useUndoRedo() {
  const { canUndo, canRedo, undo, redo, undoCount, redoCount } = useVisualEditor();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if we're in a text input or contenteditable
    const target = e.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
    
    // Allow browser's native undo/redo in input elements
    if (isInputElement) {
      return;
    }

    // Ctrl+Z or Cmd+Z for Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo) {
        undo();
      }
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      if (canRedo) {
        redo();
      }
    }

    // Ctrl+Y or Cmd+Y for Redo (alternative)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      if (canRedo) {
        redo();
      }
    }
  }, [canUndo, canRedo, undo, redo]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    undoCount,
    redoCount,
  };
}
