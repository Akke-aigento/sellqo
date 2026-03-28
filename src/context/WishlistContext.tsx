import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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

export function WishlistProvider({ children, tenantSlug: propSlug }: { children: ReactNode; tenantSlug?: string }) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = propSlug || params.tenantSlug;
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    if (!tenantSlug) return;
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`);
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch { setItems([]); }
    } else {
      setItems([]);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantSlug}`, JSON.stringify(items));
  }, [items, tenantSlug]);

  const addToWishlist = useCallback((item: WishlistItem) => {
    setItems(prev => prev.some(i => i.productId === item.productId) ? prev : [...prev, item]);
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const isInWishlist = useCallback((productId: string) => {
    return items.some(i => i.productId === productId);
  }, [items]);

  const toggleWishlist = useCallback((item: WishlistItem) => {
    setItems(prev => prev.some(i => i.productId === item.productId)
      ? prev.filter(i => i.productId !== item.productId)
      : [...prev, item]
    );
  }, []);

  const getWishlistCount = useCallback(() => items.length, [items]);

  const clearWishlist = useCallback(() => setItems([]), []);

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
