import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useParams } from 'react-router-dom';

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

// Lazy import to avoid circular deps — the provider may render before StorefrontAuthContext exists
let _useStorefrontAuth: (() => { isAuthenticated: boolean; customer: any; token: string | null; tenantId: string | undefined }) | null = null;
let _useStorefrontCustomerApi: (() => { getWishlist: () => Promise<any>; addToWishlist: (id: string) => Promise<any>; removeFromWishlist: (id: string) => Promise<any> }) | null = null;

async function ensureImports() {
  if (!_useStorefrontAuth) {
    const mod = await import('@/context/StorefrontAuthContext');
    _useStorefrontAuth = mod.useStorefrontAuth;
  }
  if (!_useStorefrontCustomerApi) {
    const mod = await import('@/hooks/useStorefrontCustomerApi');
    _useStorefrontCustomerApi = mod.useStorefrontCustomerApi;
  }
}

export function WishlistProvider({ children, tenantSlug: propSlug }: { children: ReactNode; tenantSlug?: string }) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = propSlug || params.tenantSlug;
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [serverMode, setServerMode] = useState(false);
  const syncingRef = useRef(false);

  // Try to use storefront auth — wrapped in try/catch because the context might not exist
  const [authState, setAuthState] = useState<{ isAuthenticated: boolean; customer: any } | null>(null);
  const [api, setApi] = useState<{ getWishlist: () => Promise<any>; addToWishlist: (id: string) => Promise<any>; removeFromWishlist: (id: string) => Promise<any> } | null>(null);

  // We can't use hooks conditionally, so we use a component-level detection
  // The WishlistProvider sits inside StorefrontAuthProvider in the route tree,
  // so we access auth via a direct import
  const authRef = useRef<any>(null);
  const apiRef = useRef<any>(null);

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

  // Save to localStorage (always, as fallback)
  useEffect(() => {
    if (!tenantSlug || serverMode) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`, JSON.stringify(items));
  }, [items, tenantSlug, serverMode]);

  const addToWishlist = useCallback((item: WishlistItem) => {
    setItems(prev => {
      if (prev.some(i => i.productId === item.productId)) return prev;
      return [...prev, item];
    });
    // Server sync
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
      <WishlistServerSync
        tenantSlug={tenantSlug}
        items={items}
        setItems={setItems}
        setServerMode={setServerMode}
        apiRef={apiRef}
        syncingRef={syncingRef}
      />
      {children}
    </WishlistContext.Provider>
  );
}

// Inner component that uses hooks from StorefrontAuth context
function WishlistServerSync({
  tenantSlug,
  items,
  setItems,
  setServerMode,
  apiRef,
  syncingRef,
}: {
  tenantSlug: string | undefined;
  items: WishlistItem[];
  setItems: React.Dispatch<React.SetStateAction<WishlistItem[]>>;
  setServerMode: React.Dispatch<React.SetStateAction<boolean>>;
  apiRef: React.MutableRefObject<any>;
  syncingRef: React.MutableRefObject<boolean>;
}) {
  // These hooks are safe here because this component only renders inside StorefrontAuthProvider
  let isAuthenticated = false;
  let customerApi: any = null;

  try {
    // Dynamic require won't work; use the hooks directly since we're inside the provider tree
    const { useStorefrontAuth } = require('@/context/StorefrontAuthContext');
    const { useStorefrontCustomerApi } = require('@/hooks/useStorefrontCustomerApi');
    const auth = useStorefrontAuth();
    customerApi = useStorefrontCustomerApi();
    isAuthenticated = auth.isAuthenticated;
    apiRef.current = customerApi;
  } catch {
    // Not inside StorefrontAuthProvider — localStorage mode only
    return null;
  }

  useEffect(() => {
    if (!isAuthenticated || !customerApi || syncingRef.current) {
      if (!isAuthenticated) {
        setServerMode(false);
        apiRef.current = null;
      }
      return;
    }

    // Sync: merge localStorage items to server, then load server state
    syncingRef.current = true;
    (async () => {
      try {
        // First, push local items to server
        const localItems = [...items];
        for (const item of localItems) {
          try {
            await customerApi.addToWishlist(item.productId);
          } catch {
            // Already exists or error — ignore
          }
        }

        // Then fetch server state as source of truth
        const serverItems = await customerApi.getWishlist();
        if (Array.isArray(serverItems)) {
          // Server returns product IDs with product data
          const mapped: WishlistItem[] = serverItems.map((si: any) => ({
            productId: si.product_id || si.productId,
            name: si.product?.name || si.name || '',
            price: si.product?.price || si.price || 0,
            image: si.product?.images?.[0] || si.image || '',
            slug: si.product?.slug || si.slug || '',
          }));
          setItems(mapped);
          // Clear localStorage since server is now the source
          if (tenantSlug) {
            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`);
          }
        }

        setServerMode(true);
      } catch (err) {
        console.error('Wishlist server sync failed, falling back to localStorage:', err);
        setServerMode(false);
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [isAuthenticated]);

  return null;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
}
