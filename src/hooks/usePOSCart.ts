import { useState, useCallback, useMemo } from 'react';
import type { POSCartItem, POSTransaction } from '@/types/pos';
import type { Product } from '@/types/product';
import type { Customer } from '@/types/order';
import { POSDiscount } from '@/components/admin/pos/POSDiscountPanel';

export interface POSCartTotals {
  subtotal: number;
  discount: number;
  cartDiscountAmount: number;
  taxTotal: number;
  total: number;
  taxBreakdown: { rate: number; taxable: number; tax: number }[];
}

interface UsePOSCartOptions {
  defaultTaxRate?: number;
  vatHandling?: 'inclusive' | 'exclusive';
}

export function usePOSCart(options: UsePOSCartOptions = {}) {
  const { defaultTaxRate = 21, vatHandling = 'exclusive' } = options;
  const isInclusive = vatHandling === 'inclusive';

  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cartDiscount, setCartDiscount] = useState<POSDiscount | null>(null);
  const [lastTransaction, setLastTransaction] = useState<POSTransaction | null>(null);
  const [lastPaymentWasCash, setLastPaymentWasCash] = useState(false);

  // Calculate totals with per-item tax rates
  const cartTotals = useMemo<POSCartTotals>(() => {
    const itemSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemDiscount = cart.reduce((sum, item) => sum + item.discount, 0);

    let cartDiscountAmount = 0;
    if (cartDiscount) {
      if (cartDiscount.type === 'percentage') {
        cartDiscountAmount = (itemSubtotal * cartDiscount.value) / 100;
      } else {
        cartDiscountAmount = cartDiscount.value;
      }
    }

    const totalDiscount = itemDiscount + cartDiscountAmount;

    // Group by tax rate for per-rate calculation
    const taxGroups = new Map<number, { taxable: number }>();
    for (const item of cart) {
      const rate = item.tax_rate;
      const itemTotal = item.price * item.quantity - item.discount;
      // Distribute cart-level discount proportionally
      const proportion = itemSubtotal > 0 ? (item.price * item.quantity) / itemSubtotal : 0;
      const itemCartDiscount = cartDiscountAmount * proportion;
      const taxableAmount = Math.max(0, itemTotal - itemCartDiscount);

      const existing = taxGroups.get(rate) || { taxable: 0 };
      existing.taxable += taxableAmount;
      taxGroups.set(rate, existing);
    }

    let taxTotal = 0;
    const taxBreakdown: { rate: number; taxable: number; tax: number }[] = [];
    for (const [rate, group] of taxGroups) {
      // Inclusive: extract VAT from price; Exclusive: add VAT on top
      const tax = isInclusive
        ? group.taxable - group.taxable / (1 + rate / 100)
        : group.taxable * (rate / 100);
      taxTotal += tax;
      taxBreakdown.push({ rate, taxable: group.taxable, tax });
    }
    taxBreakdown.sort((a, b) => b.rate - a.rate);

    // Inclusive: total = subtotal - discount (VAT already in price)
    // Exclusive: total = subtotal - discount + tax
    const total = isInclusive
      ? itemSubtotal - totalDiscount
      : itemSubtotal - totalDiscount + taxTotal;

    return { subtotal: itemSubtotal, discount: totalDiscount, cartDiscountAmount, taxTotal, total, taxBreakdown };
  }, [cart, cartDiscount, isInclusive]);

  const addToCart = useCallback((product: Product, vatRate?: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);

      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }

      const taxRate = vatRate ?? defaultTaxRate;

      const newItem: POSCartItem = {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        sku: product.sku || null,
        price: product.price,
        quantity: 1,
        tax_rate: taxRate,
        discount: 0,
        total: product.price,
        image_url: (product as unknown as { image_url?: string }).image_url || null,
      };

      return [...prev, newItem];
    });
  }, [defaultTaxRate]);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === itemId) {
            const newQty = Math.max(0, item.quantity + delta);
            if (newQty === 0) return null;
            return { ...item, quantity: newQty, total: newQty * item.price };
          }
          return item;
        })
        .filter(Boolean) as POSCartItem[]
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setCartDiscount(null);
  }, []);

  const setCartItems = useCallback((items: POSCartItem[]) => {
    setCart(items);
  }, []);

  return {
    cart,
    setCart: setCartItems,
    cartTotals,
    selectedCustomer,
    setSelectedCustomer,
    cartDiscount,
    setCartDiscount,
    lastTransaction,
    setLastTransaction,
    lastPaymentWasCash,
    setLastPaymentWasCash,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
