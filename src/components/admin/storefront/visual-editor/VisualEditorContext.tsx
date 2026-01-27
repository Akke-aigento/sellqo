import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import type { HomepageSection } from '@/types/storefront';

interface VisualEditorContextType {
  isEditMode: boolean;
  selectedSectionId: string | null;
  setSelectedSectionId: (id: string | null) => void;
  optimisticUpdate: (sectionId: string, updates: Partial<HomepageSection>) => void;
  pendingChanges: Map<string, Partial<HomepageSection>>;
}

const VisualEditorContext = createContext<VisualEditorContextType | null>(null);

export function VisualEditorProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [pendingChanges] = useState(new Map<string, Partial<HomepageSection>>());

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

  return (
    <VisualEditorContext.Provider
      value={{
        isEditMode: true,
        selectedSectionId,
        setSelectedSectionId,
        optimisticUpdate,
        pendingChanges,
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
