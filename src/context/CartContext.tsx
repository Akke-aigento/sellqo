import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface GiftCardMeta {
  recipientName: string;
  recipientEmail: string;
  personalMessage?: string;
  sendDate?: string;
  designId?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  variantTitle?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string;
  giftCard?: GiftCardMeta;
}

export interface AppliedDiscountCode {
  code: string;
  discount_type: string;
  discount_value: number;
  applies_to: string;
  description?: string;
  calculated_amount: number;
}

interface CartContextType {
  items: CartItem[];
  tenantSlug: string | null;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
  setTenantSlug: (slug: string) => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  appliedDiscount: AppliedDiscountCode | null;
  applyDiscountCode: (discount: AppliedDiscountCode) => void;
  removeDiscountCode: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'cart_';
const DISCOUNT_KEY_PREFIX = 'cart_discount_';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tenantSlug, setTenantSlugState] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscountCode | null>(null);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

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

    // Load discount
    const discountKey = `${DISCOUNT_KEY_PREFIX}${tenantSlug}`;
    const storedDiscount = localStorage.getItem(discountKey);
    if (storedDiscount) {
      try {
        setAppliedDiscount(JSON.parse(storedDiscount));
      } catch {
        setAppliedDiscount(null);
      }
    } else {
      setAppliedDiscount(null);
    }
  }, [tenantSlug]);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (!tenantSlug) return;
    const storageKey = `${STORAGE_KEY_PREFIX}${tenantSlug}`;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, tenantSlug]);

  // Save discount to localStorage
  useEffect(() => {
    if (!tenantSlug) return;
    const discountKey = `${DISCOUNT_KEY_PREFIX}${tenantSlug}`;
    if (appliedDiscount) {
      localStorage.setItem(discountKey, JSON.stringify(appliedDiscount));
    } else {
      localStorage.removeItem(discountKey);
    }
  }, [appliedDiscount, tenantSlug]);

  const setTenantSlug = useCallback((slug: string) => {
    setTenantSlugState(slug);
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(i => 
        i.productId === item.productId && (i.variantId || null) === (item.variantId || null)
      );
      
      if (existingIndex >= 0) {
        return currentItems.map((i, index) => 
          index === existingIndex 
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      
      const uniqueKey = item.variantId ? `${item.productId}_${item.variantId}` : `${item.productId}`;
      return [...currentItems, { ...item, id: `${uniqueKey}_${Date.now()}` }];
    });
    setIsDrawerOpen(true);
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(itemId);
      return;
    }
    
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setAppliedDiscount(null);
  }, []);

  const getCartCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getSubtotal = useCallback(() => {
    return items.reduce((sum, item) => {
      const price = item.price || (item.giftCard as any)?.amount || 0;
      return sum + (price * item.quantity);
    }, 0);
  }, [items]);

  const applyDiscountCode = useCallback((discount: AppliedDiscountCode) => {
    setAppliedDiscount(discount);
  }, []);

  const removeDiscountCode = useCallback(() => {
    setAppliedDiscount(null);
  }, []);

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
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      appliedDiscount,
      applyDiscountCode,
      removeDiscountCode,
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
