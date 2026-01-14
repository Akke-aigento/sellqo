import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/admin/Dashboard";
import ProductsPage from "./pages/admin/Products";
import ProductForm from "./pages/admin/ProductForm";
import CategoriesPage from "./pages/admin/Categories";
import OrdersPage from "./pages/admin/Orders";
import OrderDetailPage from "./pages/admin/OrderDetail";
import CustomersPage from "./pages/admin/Customers";
import ShippingPage from "./pages/admin/Shipping";
import PlaceholderPage from "./pages/admin/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root to admin */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            
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
              <Route path="customers" element={<CustomersPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="shipping" element={<ShippingPage />} />
              <Route path="settings" element={<PlaceholderPage title="Instellingen" description="Winkelinstellingen worden gebouwd in Fase 4." />} />
              <Route path="analytics" element={<PlaceholderPage title="Analytics" description="Analytics dashboard wordt gebouwd in Fase 6." />} />
              <Route path="platform" element={
                <ProtectedRoute requirePlatformAdmin>
                  <PlaceholderPage title="Platform Beheer" description="Platform management wordt gebouwd in Fase 5." />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
