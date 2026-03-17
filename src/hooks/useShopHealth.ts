import { useMemo } from 'react';
import { useOrders, useOrderStats } from './useOrders';
import { useProducts } from './useProducts';
import { useCustomerMessages } from './useCustomerMessages';
import { useInvoices } from './useInvoices';
import { useSEO } from './useSEO';
import { useLegalPages } from './useLegalPages';
import { useAnalytics } from './useAnalytics';
import { useTenant } from './useTenant';
import { useOnboarding } from './useOnboarding';
import { differenceInHours, subDays, isToday, format } from 'date-fns';
import {
  calculateOrdersHealth,
  calculateInventoryHealth,
  calculateCustomerServiceHealth,
  calculateFinanceHealth,
  calculateSEOHealth,
  calculateComplianceHealth,
  generateActionItems,
  generateAchievements,
  calculateOverallScore,
  getOverallStatus,
  type HealthCategory,
  type ActionItem,
  type Achievement,
  type TrendData,
  type HealthData,
} from '@/lib/healthScoreCalculator';
import { getOverallMessage, getDailyPulse, type HealthStatus } from '@/config/healthMessages';

export interface ShopHealthData {
  overallScore: number;
  overallStatus: HealthStatus;
  emotionalMessage: string;
  dailyPulse: string;
  categories: HealthCategory[];
  actionItems: ActionItem[];
  achievements: Achievement[];
  trends: TrendData;
  todayStats: {
    revenue: number;
    orders: number;
    newCustomers: number;
  };
  isLoading: boolean;
  lastUpdated: Date;
}

export function useShopHealth(): ShopHealthData {
  const { currentTenant } = useTenant();
  const onboarding = useOnboarding();
  
  // Fetch all required data
  const { orders, isLoading: ordersLoading } = useOrders();
  const { stats, isLoading: statsLoading } = useOrderStats();
  const { products, isLoading: productsLoading } = useProducts();
  const { messages, isLoading: messagesLoading } = useCustomerMessages();
  const { invoices, isLoading: invoicesLoading } = useInvoices();
  const { tenantScore, isLoading: seoLoading } = useSEO();
  const { legalPages, isLoading: legalLoading, getMissingPages } = useLegalPages();
  const { status: stripeStatus, isLoading: stripeLoading } = useStripeConnect(currentTenant?.id);
  const { dailyStats, summary, isLoading: analyticsLoading } = useAnalytics(7);
  
  const isLoading = ordersLoading || statsLoading || productsLoading || messagesLoading || 
                    invoicesLoading || seoLoading || legalLoading || 
                    stripeLoading || analyticsLoading;
  
  const healthData = useMemo<HealthData>(() => {
    const now = new Date();
    
    // Orders analysis
    const pendingOrdersList = orders?.filter(o => 
      o.status === 'pending' || o.status === 'processing'
    ) || [];
    const ordersOverdue48h = pendingOrdersList.filter(o => 
      differenceInHours(now, new Date(o.created_at!)) > 48
    ).length;
    const shippedToday = orders?.filter(o => 
      o.status === 'shipped' && o.shipped_at && isToday(new Date(o.shipped_at))
    ).length || 0;
    
    // Inventory analysis
    const activeProducts = products?.filter(p => p.is_active) || [];
    const lowStockCount = activeProducts.filter(p => 
      p.track_inventory && p.stock <= 5 && p.stock > 0
    ).length;
    const outOfStockCount = activeProducts.filter(p => 
      p.track_inventory && p.stock === 0
    ).length;
    const productsWithoutImages = activeProducts.filter(p => 
      !p.images || p.images.length === 0
    ).length;
    
    // Customer service analysis - only count active inbox messages that need attention
    const unreadMessages = messages?.filter(m => 
      m.direction === 'inbound' &&               // Inbound messages only
      !m.read_at &&                               // Not yet opened/read
      !m.replied_at &&                            // Not yet replied to
      (!m.message_status || m.message_status === 'active') &&  // Active status only
      !m.folder_id                                // Not moved to any folder
    ) || [];
    const oldestUnread = unreadMessages.length > 0
      ? Math.max(...unreadMessages.map(m => differenceInHours(now, new Date(m.created_at))))
      : 0;
    
    // Finance analysis - filter unpaid invoices that are sent (overdue concept)
    const unpaidSentInvoices = invoices?.filter(inv => inv.status === 'sent') || [];
    const overdueAmount = unpaidSentInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    
    // SEO analysis
    const productsWithoutMeta = activeProducts.filter(p => !p.meta_description).length;
    // Products images are strings, not objects with alt
    const productsWithoutAlt = 0; // Skip this check as images are string URLs
    
    // Compliance analysis
    const missingPages = getMissingPages?.() || [];
    const companyInfoComplete = Boolean(
      currentTenant?.name && 
      currentTenant?.btw_number && 
      currentTenant?.address
    );
    const logoUploaded = Boolean(currentTenant?.logo_url);
    
    // Analytics for achievements
    const todayRevenue = dailyStats?.find(d => 
      d.date === format(now, 'dd MMM')
    )?.revenue || 0;
    const weekRevenue = dailyStats?.reduce((sum, d) => sum + d.revenue, 0) || 0;
    const newCustomersThisWeek = summary?.totalCustomers || 0;
    const packagesShippedThisWeek = orders?.filter(o => {
      if (!o.shipped_at) return false;
      const shippedDate = new Date(o.shipped_at);
      return shippedDate >= subDays(now, 7);
    }).length || 0;
    
    return {
      pendingOrders: stats?.pendingOrders || 0,
      processingOrders: stats?.processingOrders || 0,
      ordersOverdue48h,
      shippedToday,
      lowStockCount,
      outOfStockCount,
      activeProducts: activeProducts.length,
      productsWithoutImages,
      unreadMessages: unreadMessages.length,
      oldestUnreadHours: oldestUnread,
      pendingQuotes: 0,
      stripeConnected: stripeStatus?.charges_enabled || false,
      overdueInvoicesAmount: overdueAmount,
      overdueInvoicesCount: unpaidSentInvoices.length,
      seoScore: tenantScore?.overall_score || null,
      productsWithoutMeta,
      productsWithoutAlt,
      onboardingCompleted: onboarding.currentStep >= onboarding.totalSteps,
      missingLegalPages: missingPages.length,
      companyInfoComplete,
      logoUploaded,
      todayRevenue,
      weekRevenue,
      newCustomersThisWeek,
      packagesShippedThisWeek,
      dailyStats: dailyStats || [],
    };
  }, [
    orders, stats, products, messages, 
    invoices, tenantScore, legalPages, stripeStatus, dailyStats,
    summary, onboarding.currentStep, onboarding.totalSteps, currentTenant, getMissingPages
  ]);
  
  // Calculate all health categories
  const categories = useMemo<HealthCategory[]>(() => [
    calculateOrdersHealth(healthData),
    calculateInventoryHealth(healthData),
    calculateCustomerServiceHealth(healthData),
    calculateFinanceHealth(healthData),
    calculateSEOHealth(healthData),
    calculateComplianceHealth(healthData),
  ], [healthData]);
  
  // Calculate overall score and status
  const overallScore = useMemo(() => calculateOverallScore(categories), [categories]);
  const overallStatus = useMemo(() => getOverallStatus(overallScore), [overallScore]);
  
  // Generate action items and achievements
  const actionItems = useMemo(() => generateActionItems(categories), [categories]);
  const achievements = useMemo(() => generateAchievements(healthData), [healthData]);
  
  // Calculate trends
  const trends = useMemo<TrendData>(() => {
    const labels = dailyStats?.map(d => d.date) || [];
    const values = dailyStats?.map(d => d.revenue) || [];
    const change = summary?.revenueChange || 0;
    return { labels, values, change };
  }, [dailyStats, summary]);
  
  // Today's stats
  const todayStats = useMemo(() => ({
    revenue: healthData.todayRevenue,
    orders: dailyStats?.find(d => d.date === format(new Date(), 'dd MMM'))?.orders || 0,
    newCustomers: 0, // Would need today-specific query
  }), [healthData.todayRevenue, dailyStats]);
  
  return {
    overallScore,
    overallStatus,
    emotionalMessage: getOverallMessage(overallScore),
    dailyPulse: getDailyPulse(),
    categories,
    actionItems,
    achievements,
    trends,
    todayStats,
    isLoading,
    lastUpdated: new Date(),
  };
}
