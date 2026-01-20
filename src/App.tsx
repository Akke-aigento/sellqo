import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import LandingPage from "./pages/Landing";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/admin/Dashboard";
import ProductsPage from "./pages/admin/Products";
import ProductForm from "./pages/admin/ProductForm";
import CategoriesPage from "./pages/admin/Categories";
import OrdersPage from "./pages/admin/Orders";
import OrderDetailPage from "./pages/admin/OrderDetail";
import QuotesPage from "./pages/admin/Quotes";
import QuoteFormPage from "./pages/admin/QuoteForm";
import QuoteDetailPage from "./pages/admin/QuoteDetail";
import InvoicesPage from "./pages/admin/Invoices";
import CreditNotesPage from "./pages/admin/CreditNotes";
import CustomersPage from "./pages/admin/Customers";
import ShippingPage from "./pages/admin/Shipping";
import TenantsPage from "./pages/admin/Tenants";
import SubscriptionsPage from "./pages/admin/Subscriptions";
import BillingPage from "./pages/admin/Billing";
import PricingPage from "./pages/Pricing";
import AnalyticsPage from "./pages/admin/Analytics";
import SettingsPage from "./pages/admin/Settings";
import ImportPage from "./pages/admin/Import";
import MarketplacesPage from "./pages/admin/Marketplaces";
import MarketplaceDetailPage from "./pages/admin/MarketplaceDetail";
import MarketingPage from "./pages/admin/Marketing";
import CampaignDetailPage from "./pages/admin/CampaignDetail";
import AIMarketingHub from "./pages/admin/AIMarketingHub";
import DiscountsPage from "./pages/admin/Discounts";
import PromotionsPage from "./pages/admin/Promotions";
import BundlesPage from "./pages/admin/Bundles";
import VolumeDiscountsPage from "./pages/admin/VolumeDiscounts";
import AutoDiscountsPage from "./pages/admin/AutoDiscounts";
import GiftPromotionsPage from "./pages/admin/GiftPromotions";
import CustomerGroupsPage from "./pages/admin/CustomerGroups";
import BogoPromotionsPage from "./pages/admin/BogoPromotions";
import LoyaltyProgramsPage from "./pages/admin/LoyaltyPrograms";
import StackingRulesPage from "./pages/admin/StackingRules";
import NotFound from "./pages/NotFound";
import PlatformBillingPage from "./pages/platform/PlatformBilling";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Public pricing page */}
            <Route path="/pricing" element={<PricingPage />} />
            
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductForm />} />
<Route path="products/:id/edit" element={<ProductForm />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="orders/quotes" element={<QuotesPage />} />
              <Route path="orders/quotes/new" element={<QuoteFormPage />} />
              <Route path="orders/quotes/:id" element={<QuoteDetailPage />} />
              <Route path="orders/quotes/:id/edit" element={<QuoteFormPage />} />
              <Route path="orders/invoices" element={<InvoicesPage />} />
              <Route path="orders/creditnotes" element={<CreditNotesPage />} />
              <Route path="orders/subscriptions" element={<SubscriptionsPage />} />
              <Route path="orders/discounts" element={<DiscountsPage />} />
              <Route path="promotions" element={<PromotionsPage />} />
              <Route path="promotions/bundles" element={<BundlesPage />} />
              <Route path="promotions/volume" element={<VolumeDiscountsPage />} />
              <Route path="promotions/auto" element={<AutoDiscountsPage />} />
              <Route path="promotions/gifts" element={<GiftPromotionsPage />} />
              <Route path="promotions/customer-groups" element={<CustomerGroupsPage />} />
              <Route path="promotions/bogo" element={<BogoPromotionsPage />} />
              <Route path="promotions/loyalty" element={<LoyaltyProgramsPage />} />
              <Route path="promotions/stacking" element={<StackingRulesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="shipping" element={<ShippingPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="connect" element={<MarketplacesPage />} />
              <Route path="connect/:connectionId" element={<MarketplaceDetailPage />} />
              <Route path="marketing" element={<MarketingPage />} />
              <Route path="marketing/ai" element={<AIMarketingHub />} />
              <Route path="marketing/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="platform" element={
                <ProtectedRoute requirePlatformAdmin>
                  <TenantsPage />
                </ProtectedRoute>
              } />
              <Route path="platform/billing" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformBillingPage />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
