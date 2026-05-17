'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from './api';
import type { Cart } from './types';

interface CartState {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Client-side mirror of the server cart. The server is the source of truth —
 * this store just holds the latest snapshot and exposes mutators that call
 * the API and replace the snapshot atomically.
 *
 * persist() keeps the latest snapshot in localStorage so the cart count in
 * the header renders without a network round-trip on first paint.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cart: null,
      loading: false,
      error: null,

      async fetch() {
        set({ loading: true, error: null });
        try {
          const cart = await api.get<Cart>('/api/cart');
          set({ cart, loading: false });
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
        }
      },

      async addItem(productId, quantity = 1) {
        set({ loading: true, error: null });
        try {
          const cart = await api.post<Cart>('/api/cart/items', { productId, quantity });
          set({ cart, loading: false });
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          throw e;
        }
      },

      async updateItem(itemId, quantity) {
        set({ loading: true, error: null });
        try {
          const cart = await api.put<Cart>(`/api/cart/items/${itemId}`, { quantity });
          set({ cart, loading: false });
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          throw e;
        }
      },

      async removeItem(itemId) {
        set({ loading: true, error: null });
        try {
          const cart = await api.del<Cart>(`/api/cart/items/${itemId}`);
          set({ cart, loading: false });
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          throw e;
        }
      },

      async clear() {
        set({ loading: true, error: null });
        try {
          const cart = await api.post<Cart>('/api/cart/clear');
          set({ cart, loading: false });
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          throw e;
        }
      },
    }),
    {
      name: 'vv_cart_snapshot',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
    },
  ),
);

export function cartItemCount(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function cartSubtotal(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
}
