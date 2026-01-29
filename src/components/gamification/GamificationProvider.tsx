import { createContext, useContext, useState, ReactNode } from 'react';
import { useMilestones } from '@/hooks/useMilestones';
import { useTenant } from '@/hooks/useTenant';  // FIX 3: Import useTenant
import { MilestonePopup } from './MilestonePopup';
import { FeedbackPopup } from './FeedbackPopup';

interface GamificationContextType {
  // Future: add methods to manually trigger popups, etc.
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: ReactNode }) {
  // FIX 3: Check if tenant is ready before enabling milestone queries
  // Refs: Console log analyse - 406 errors door queries op niet-bestaande tenant
  const { currentTenant, loading: tenantsLoading } = useTenant();
  
  // Only enable milestone checks when:
  // 1. Tenants have finished loading
  // 2. A current tenant is selected
  const shouldCheckMilestones = !tenantsLoading && !!currentTenant?.id;
  
  // FIX 3: Pass enabled flag to prevent queries during onboarding
  const { pendingMilestone, tenantStats, acknowledgeMilestone, isAcknowledging } = useMilestones({
    enabled: shouldCheckMilestones,
  });
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMilestoneId, setFeedbackMilestoneId] = useState<string | undefined>();

  const handleMilestoneClose = async (requestFeedback: boolean) => {
    if (pendingMilestone) {
      await acknowledgeMilestone(pendingMilestone.id);
      
      if (requestFeedback) {
        setFeedbackMilestoneId(pendingMilestone.id);
        // Small delay to let the first popup close smoothly
        setTimeout(() => setShowFeedback(true), 300);
      }
    }
  };

  const handleFeedbackClose = () => {
    setShowFeedback(false);
    setFeedbackMilestoneId(undefined);
  };

  // Get current value for progress display
  const getCurrentValue = () => {
    if (!pendingMilestone || !tenantStats) return 0;
    switch (pendingMilestone.type) {
      case 'orders':
        return tenantStats.lifetime_order_count || 0;
      case 'revenue':
        return tenantStats.lifetime_revenue || 0;
      case 'customers':
        return tenantStats.lifetime_customer_count || 0;
      default:
        return 0;
    }
  };

  return (
    <GamificationContext.Provider value={{}}>
      {children}

      {/* Milestone celebration popup */}
      {pendingMilestone && !isAcknowledging && (
        <MilestonePopup
          milestone={pendingMilestone}
          currentValue={getCurrentValue()}
          onClose={handleMilestoneClose}
        />
      )}

      {/* Feedback popup (after milestone acknowledgment) */}
      {showFeedback && (
        <FeedbackPopup
          milestoneId={feedbackMilestoneId}
          onClose={handleFeedbackClose}
        />
      )}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}
