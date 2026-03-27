import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import type { StorefrontAddress } from '@/context/StorefrontAuthContext';

export function useStorefrontCustomerApi() {
  const { token, tenantId } = useStorefrontAuth();

  const invoke = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    if (!tenantId) throw new Error('Tenant not loaded');
    const headers: Record<string, string> = {};
    if (token) headers['x-storefront-token'] = token;

    const { data, error } = await supabase.functions.invoke('storefront-customer-api', {
      body: { action, tenant_id: tenantId, params },
      headers,
    });
    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Unknown error');
    return data?.data;
  }, [tenantId, token]);

  const getOrders = useCallback(() => invoke('get_orders'), [invoke]);
  const getOrder = useCallback((orderId: string) => invoke('get_order', { order_id: orderId }), [invoke]);
  const getAddresses = useCallback(() => invoke('get_addresses'), [invoke]);
  const addAddress = useCallback((address: Omit<StorefrontAddress, 'id'>) => invoke('add_address', { address }), [invoke]);
  const updateAddress = useCallback((addressId: string, address: Partial<StorefrontAddress>) => invoke('update_address', { address_id: addressId, address }), [invoke]);
  const deleteAddress = useCallback((addressId: string) => invoke('delete_address', { address_id: addressId }), [invoke]);
  const changePassword = useCallback((currentPassword: string, newPassword: string) => invoke('change_password', { current_password: currentPassword, new_password: newPassword }), [invoke]);
  const requestPasswordReset = useCallback((email: string) => invoke('request_password_reset', { email }), [invoke]);
  const resetPassword = useCallback((email: string, resetToken: string, newPassword: string) => invoke('reset_password', { email, reset_token: resetToken, new_password: newPassword }), [invoke]);

  // Wishlist
  const getWishlist = useCallback(() => invoke('wishlist_get'), [invoke]);
  const addToWishlist = useCallback((productId: string) => invoke('wishlist_add', { product_id: productId }), [invoke]);
  const removeFromWishlist = useCallback((productId: string) => invoke('wishlist_remove', { product_id: productId }), [invoke]);

  return {
    invoke, getOrders, getOrder, getAddresses, addAddress, updateAddress, deleteAddress,
    changePassword, requestPasswordReset, resetPassword,
    getWishlist, addToWishlist, removeFromWishlist,
  };
}
