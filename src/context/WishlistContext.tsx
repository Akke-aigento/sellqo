import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import { useStorefrontCustomerApi } from '@/hooks/useStorefrontCustomerApi';

export interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  slug: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  getWishlistCount: () => number;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'wishlist_';

export function WishlistProvider({ children, tenantSlug: propSlug }: { children: ReactNode; tenantSlug?: string }) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = propSlug || params.tenantSlug;
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [serverMode, setServerMode] = useState(false);
  const syncingRef = useRef(false);

  // Storefront auth — safe because WishlistProvider sits inside StorefrontAuthProvider
  let sfAuth: { isAuthenticated: boolean } = { isAuthenticated: false };
  let customerApi: ReturnType<typeof useStorefrontCustomerApi> | null = null;
  try {
    sfAuth = useStorefrontAuth();
    customerApi = useStorefrontCustomerApi();
  } catch {
    // Not inside StorefrontAuthProvider — localStorage only
  }

  const apiRef = useRef(customerApi);
  apiRef.current = customerApi;

  // Load from localStorage on mount
  useEffect(() => {
    if (!tenantSlug) return;
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`);
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch { setItems([]); }
    } else {
      setItems([]);
    }
  }, [tenantSlug]);

  // Save to localStorage when not in server mode
  useEffect(() => {
    if (!tenantSlug || serverMode) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`, JSON.stringify(items));
  }, [items, tenantSlug, serverMode]);

  // Sync with server when auth state changes
  useEffect(() => {
    if (!sfAuth.isAuthenticated || !apiRef.current || syncingRef.current) {
      if (!sfAuth.isAuthenticated) {
        setServerMode(false);
      }
      return;
    }

    const api = apiRef.current;
    syncingRef.current = true;

    (async () => {
      try {
        // Push local items to server
        const localItems = [...items];
        for (const item of localItems) {
          try {
            await api.addToWishlist(item.productId);
          } catch { /* already exists */ }
        }

        // Fetch server state as source of truth
        const serverItems = await api.getWishlist();
        if (Array.isArray(serverItems)) {
          const mapped: WishlistItem[] = serverItems.map((si: any) => ({
            productId: si.product_id || si.productId,
            name: si.product?.name || si.name || '',
            price: si.product?.price || si.price || 0,
            image: si.product?.images?.[0] || si.image || '',
            slug: si.product?.slug || si.slug || '',
          }));
          setItems(mapped);
          if (tenantSlug) {
            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`);
          }
        }
        setServerMode(true);
      } catch (err) {
        console.error('Wishlist server sync failed:', err);
        setServerMode(false);
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [sfAuth.isAuthenticated]);

  const addToWishlist = useCallback((item: WishlistItem) => {
    setItems(prev => {
      if (prev.some(i => i.productId === item.productId)) return prev;
      return [...prev, item];
    });
    if (apiRef.current && serverMode) {
      apiRef.current.addToWishlist(item.productId).catch(() => {});
    }
  }, [serverMode]);

  const removeFromWishlist = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
    if (apiRef.current && serverMode) {
      apiRef.current.removeFromWishlist(productId).catch(() => {});
    }
  }, [serverMode]);

  const isInWishlist = useCallback((productId: string) => {
    return items.some(i => i.productId === productId);
  }, [items]);

  const toggleWishlist = useCallback((item: WishlistItem) => {
    const exists = items.some(i => i.productId === item.productId);
    if (exists) {
      removeFromWishlist(item.productId);
    } else {
      addToWishlist(item);
    }
  }, [items, addToWishlist, removeFromWishlist]);

  const getWishlistCount = useCallback(() => items.length, [items]);

  const clearWishlist = useCallback(() => {
    setItems([]);
    if (tenantSlug) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`);
    }
  }, [tenantSlug]);

  return (
    <WishlistContext.Provider value={{ items, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist, getWishlistCount, clearWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
}
