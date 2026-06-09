import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RouteGuard } from "@/components/admin/RouteGuard";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { ScrollToTop } from "@/components/ScrollToTop";
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
import CustomersPage from "./pages/admin/Customers";
import CustomerDetailPage from "./pages/admin/CustomerDetail";
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
import AIActionCenter from "./pages/admin/AIActionCenter";
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
import GiftCardsPage from "./pages/admin/GiftCards";
import AdsPage from "./pages/admin/Ads";
import AdsBolcomPage from "./pages/admin/AdsBolcom";
import AdsBolcomCampaignDetailPage from "./pages/admin/AdsBolcomCampaignDetail";
import AdsBolcomKeywordsPage from "./pages/admin/AdsBolcomKeywords";
import AdsBolcomSearchTermsPage from "./pages/admin/AdsBolcomSearchTerms";
import AdsAiRulesPage from "./pages/admin/AdsAiRules";
import AdsProductMapPage from "./pages/admin/AdsProductMap";
import ReportsPage from "./pages/admin/Reports";
import MessagesPage from "./pages/admin/Messages";
import SuppliersPage from "./pages/admin/Suppliers";
import PurchaseOrdersPage from "./pages/admin/PurchaseOrders";
import SupplierDocumentsPage from "./pages/admin/SupplierDocuments";
import AcceptInvitation from "./pages/AcceptInvitation";
import ShopifyCallback from "./pages/ShopifyCallback";
import NotFound from "./pages/NotFound";
import NoAccess from "./pages/NoAccess";
import PlatformBillingPage from "./pages/platform/PlatformBilling";
import TenantDetailPage from "./pages/platform/TenantDetail";
import PlatformCouponsPage from "./pages/platform/PlatformCoupons";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformFeedback from "./pages/platform/PlatformFeedback";
import PlatformSupport from "./pages/platform/PlatformSupport";
import PlatformChangelog from "./pages/platform/PlatformChangelog";
import PlatformHealth from "./pages/platform/PlatformHealth";
import PlatformLegal from "./pages/platform/PlatformLegal";
import { PendingPlatformPaymentsPage } from "./pages/admin/PendingPlatformPaymentsPage";
import SellqoLegal from "./pages/SellqoLegal";
import About from "./pages/public/About";
import Contact from "./pages/public/Contact";
import Blog from "./pages/public/Blog";
import Partners from "./pages/public/Partners";
import Careers from "./pages/public/Careers";
import HelpCenter from "./pages/public/HelpCenter";
import Status from "./pages/public/Status";
import Integrations from "./pages/public/Integrations";
import ApiDocs from "./pages/public/ApiDocs";
import PublicChangelog from "./pages/public/PublicChangelog";
import NotificationsPage from "./pages/admin/Notifications";
import POSPage from "./pages/admin/POS";
import POSTerminalPage from "./pages/admin/POSTerminal";
import POSTerminalSettingsPage from "./pages/admin/POSTerminalSettings";
import SEODashboard from "./pages/admin/SEODashboard";
import TranslationHub from "./pages/admin/TranslationHub";
import StorefrontPage from "./pages/admin/Storefront";
import FulfillmentPage from "./pages/admin/Fulfillment";
import BadgesPage from "./pages/admin/Badges";
import SyncConflictsPage from "./pages/admin/SyncConflicts";
import PaymentsPage from "./pages/admin/Payments";
import HelpPage from "./pages/admin/Help";
import PlatformDocs from "./pages/admin/PlatformDocs";
import ChannelFieldMappingAdmin from "./pages/admin/ChannelFieldMappingAdmin";
import ReturnsPage from "./pages/admin/Returns";
import ReturnDetailPage from "./pages/admin/ReturnDetail";

import ShopHome from "./pages/storefront/ShopHome";
import ShopProducts from "./pages/storefront/ShopProducts";
import ShopProductDetail from "./pages/storefront/ShopProductDetail";
import ShopPage from "./pages/storefront/ShopPage";
import ShopCart from "./pages/storefront/ShopCart";
import ShopCheckout from "./pages/storefront/ShopCheckout";
import ShopOrderConfirmation from "./pages/storefront/ShopOrderConfirmation";
import ShopLegalPage from "./pages/storefront/ShopLegalPage";
import ShopWishlist from "./pages/storefront/ShopWishlist";
import ShopQRPayment from "./pages/storefront/ShopQRPayment";
import { SimulatedRoleProvider, RoleSimulator } from "@/components/dev/RoleSimulator";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SimulatedRoleProvider>
          <Toaster />
          <Sonner />
          <RoleSimulator />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Public pricing page */}
            <Route path="/pricing" element={<PricingPage />} />
            
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Invitation accept route */}
            <Route path="/invite/:token" element={<AcceptInvitation />} />
            
            {/* Shopify OAuth callback route */}
            <Route path="/api/shopify/callback" element={<ShopifyCallback />} />

            {/* Fase 2 Foundation — role-mismatch fallback */}
            <Route path="/no-access" element={<NoAccess />} />
            
            {/* Public Storefront routes - wrapped in CartProvider */}
            <Route path="/shop/:tenantSlug" element={<CartProvider><WishlistProvider><ShopHome /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/products" element={<CartProvider><WishlistProvider><ShopProducts /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/product/:productSlug" element={<CartProvider><WishlistProvider><ShopProductDetail /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/page/:pageSlug" element={<CartProvider><WishlistProvider><ShopPage /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/cart" element={<CartProvider><WishlistProvider><ShopCart /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/checkout" element={<CartProvider><WishlistProvider><ShopCheckout /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/checkout/qr-betaling" element={<CartProvider><WishlistProvider><ShopQRPayment /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/order/:orderId" element={<CartProvider><WishlistProvider><ShopOrderConfirmation /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/legal/:pageType" element={<CartProvider><WishlistProvider><ShopLegalPage /></WishlistProvider></CartProvider>} />
            <Route path="/shop/:tenantSlug/wishlist" element={<CartProvider><WishlistProvider><ShopWishlist /></WishlistProvider></CartProvider>} />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="badges" element={<BadgesPage />} />
              <Route path="fulfillment" element={<RouteGuard requireRead="orders"><FulfillmentPage /></RouteGuard>} />
              <Route path="products" element={<RouteGuard requireRead="products"><ProductsPage /></RouteGuard>} />
              <Route path="products/new" element={<RouteGuard requireWrite="products"><ProductForm /></RouteGuard>} />
              <Route path="products/:id/edit" element={<RouteGuard requireWrite="products"><ProductForm /></RouteGuard>} />
              <Route path="orders" element={<RouteGuard requireRead="orders"><OrdersPage /></RouteGuard>} />
              <Route path="orders/:id" element={<RouteGuard requireRead="orders"><OrderDetailPage /></RouteGuard>} />
              <Route path="returns" element={<RouteGuard requireRead="returns"><ReturnsPage /></RouteGuard>} />
              <Route path="returns/:id" element={<RouteGuard requireRead="returns"><ReturnDetailPage /></RouteGuard>} />
              <Route path="orders/quotes" element={<QuotesPage />} />
              <Route path="orders/quotes/new" element={<QuoteFormPage />} />
              <Route path="orders/quotes/:id" element={<QuoteDetailPage />} />
              <Route path="orders/quotes/:id/edit" element={<QuoteFormPage />} />
              <Route path="orders/invoices" element={<RouteGuard requireRead="invoices"><InvoicesPage /></RouteGuard>} />
              <Route
                path="orders/creditnotes"
                element={<Navigate to="/admin/orders/invoices?tab=creditnotes" replace />}
              />
              <Route path="orders/subscriptions" element={<SubscriptionsPage />} />
              <Route path="orders/discounts" element={<RouteGuard requireRead="discount_codes"><DiscountsPage /></RouteGuard>} />
              <Route path="promotions" element={<RouteGuard requireRead="discount_codes"><PromotionsPage /></RouteGuard>} />
              <Route path="promotions/bundles" element={<BundlesPage />} />
              <Route path="promotions/volume" element={<VolumeDiscountsPage />} />
              <Route path="promotions/auto" element={<AutoDiscountsPage />} />
              <Route path="promotions/gifts" element={<GiftPromotionsPage />} />
              <Route path="promotions/customer-groups" element={<CustomerGroupsPage />} />
              <Route path="promotions/bogo" element={<BogoPromotionsPage />} />
              <Route path="promotions/loyalty" element={<LoyaltyProgramsPage />} />
              <Route path="promotions/gift-cards" element={<GiftCardsPage />} />
              <Route path="promotions/stacking" element={<StackingRulesPage />} />
              <Route path="customers" element={<RouteGuard requireRead="customers"><CustomersPage /></RouteGuard>} />
              <Route path="customers/:customerId" element={<RouteGuard requireRead="customers"><CustomerDetailPage /></RouteGuard>} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="shipping" element={<ShippingPage />} />
              <Route path="payments" element={<RouteGuard requireRead="payments"><PaymentsPage /></RouteGuard>} />
              <Route path="billing" element={<RouteGuard requireRead="platform_billing"><BillingPage /></RouteGuard>} />
              <Route path="settings" element={<RouteGuard requireRead="settings_general"><SettingsPage /></RouteGuard>} />
              <Route path="connect" element={<RouteGuard requireRead="integrations"><MarketplacesPage /></RouteGuard>} />
              <Route path="connect/conflicts" element={<RouteGuard requireRead="integrations"><SyncConflictsPage /></RouteGuard>} />
              <Route path="connect/:connectionId" element={<RouteGuard requireRead="integrations"><MarketplaceDetailPage /></RouteGuard>} />
              <Route path="marketing" element={<RouteGuard requireRead="marketing"><MarketingPage /></RouteGuard>} />
              <Route path="marketing/ai" element={<RouteGuard requireRead="ai_assistant"><AIMarketingHub /></RouteGuard>} />
              <Route path="marketing/ai-center" element={<RouteGuard requireRead="ai_coach"><AIActionCenter /></RouteGuard>} />
              <Route path="marketing/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="marketing/seo" element={<RouteGuard requireRead="seo"><SEODashboard /></RouteGuard>} />
              <Route path="marketing/translations" element={<RouteGuard requireRead="cms"><TranslationHub /></RouteGuard>} />
              <Route path="notifications" element={<RouteGuard requireRead="settings_general"><NotificationsPage /></RouteGuard>} />
              <Route path="import" element={<RouteGuard requireRead="integrations"><ImportPage /></RouteGuard>} />
              <Route path="reports" element={<RouteGuard requireRead="reports"><ReportsPage /></RouteGuard>} />
              <Route path="analytics" element={<RouteGuard requireRead="reports"><AnalyticsPage /></RouteGuard>} />
              <Route path="suppliers" element={<RouteGuard requireRead="suppliers"><SuppliersPage /></RouteGuard>} />
              <Route path="purchase-orders" element={<RouteGuard requireRead="suppliers"><PurchaseOrdersPage /></RouteGuard>} />
              <Route path="supplier-documents" element={<RouteGuard requireRead="suppliers"><SupplierDocumentsPage /></RouteGuard>} />
              <Route path="pos" element={<RouteGuard requireRead="pos"><POSPage /></RouteGuard>} />
              <Route path="pos/:terminalId" element={<POSTerminalPage />} />
              <Route path="pos/terminals/:terminalId" element={<POSTerminalSettingsPage />} />
              <Route path="storefront" element={<RouteGuard requireRead="themes"><StorefrontPage /></RouteGuard>} />
              <Route path="ads" element={<RouteGuard requireRead="ads"><AdsPage /></RouteGuard>} />
              <Route path="ads/bolcom" element={<RouteGuard requireRead="ads"><AdsBolcomPage /></RouteGuard>} />
              <Route path="ads/bolcom/campaigns/:id" element={<AdsBolcomCampaignDetailPage />} />
              <Route path="ads/bolcom/keywords" element={<AdsBolcomKeywordsPage />} />
              <Route path="ads/bolcom/search-terms" element={<AdsBolcomSearchTermsPage />} />
              <Route path="ads/ai" element={<RouteGuard requireRead="ads"><AdsAiRulesPage /></RouteGuard>} />
              <Route path="ads/products" element={<RouteGuard requireRead="ads"><AdsProductMapPage /></RouteGuard>} />
              <Route path="help" element={<HelpPage />} />
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
              <Route path="platform/tenants/:tenantId" element={
                <ProtectedRoute requirePlatformAdmin>
                  <TenantDetailPage />
                </ProtectedRoute>
              } />
              <Route path="platform/coupons" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformCouponsPage />
                </ProtectedRoute>
              } />
              <Route path="platform/dashboard" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformDashboard />
                </ProtectedRoute>
              } />
              <Route path="platform/feedback" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformFeedback />
                </ProtectedRoute>
              } />
              <Route path="platform/support" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformSupport />
                </ProtectedRoute>
              } />
              <Route path="platform/changelog" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformChangelog />
                </ProtectedRoute>
              } />
              <Route path="platform/health" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformHealth />
                </ProtectedRoute>
              } />
              <Route path="platform/legal" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformLegal />
                </ProtectedRoute>
              } />
              <Route path="platform/docs" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlatformDocs />
                </ProtectedRoute>
              } />
              <Route path="platform/field-mappings" element={
                <ProtectedRoute requirePlatformAdmin>
                  <ChannelFieldMappingAdmin />
                </ProtectedRoute>
              } />
              <Route path="platform/payments" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PendingPlatformPaymentsPage />
                </ProtectedRoute>
              } />
            </Route>

            {/* Public SellQo Legal Pages */}
            <Route path="/terms" element={<SellqoLegal />} />
            <Route path="/privacy" element={<SellqoLegal />} />
            <Route path="/cookies" element={<SellqoLegal />} />
            <Route path="/sla" element={<SellqoLegal />} />
            <Route path="/acceptable-use" element={<SellqoLegal />} />
            <Route path="/dpa" element={<SellqoLegal />} />
            
            {/* Public Pages */}
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/status" element={<Status />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/changelog" element={<PublicChangelog />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
          </SimulatedRoleProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
