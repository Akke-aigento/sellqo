import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string;
}

interface CartContextType {
  items: CartItem[];
  tenantSlug: string | null;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
  setTenantSlug: (slug: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'cart_';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tenantSlug, setTenantSlugState] = useState<string | null>(null);

  // Load cart from localStorage when tenant changes
  useEffect(() => {
    if (!tenantSlug) return;
    
    const storageKey = `${STORAGE_KEY_PREFIX}${tenantSlug}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [tenantSlug]);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (!tenantSlug) return;
    
    const storageKey = `${STORAGE_KEY_PREFIX}${tenantSlug}`;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, tenantSlug]);

  const setTenantSlug = useCallback((slug: string) => {
    setTenantSlugState(slug);
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.productId === item.productId);
      
      if (existingIndex >= 0) {
        // Update quantity if product already exists
        return currentItems.map((i, index) => 
          index === existingIndex 
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      
      // Add new item with unique ID
      return [...currentItems, { ...item, id: `${item.productId}_${Date.now()}` }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    
    setItems(currentItems =>
      currentItems.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(currentItems => currentItems.filter(item => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getCartCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getSubtotal = useCallback(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  return (
    <CartContext.Provider value={{
      items,
      tenantSlug,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart,
      getCartCount,
      getSubtotal,
      setTenantSlug,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
