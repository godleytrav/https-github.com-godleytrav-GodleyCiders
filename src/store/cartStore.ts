import { create } from 'zustand';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  type: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggleCart: () => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => {
  // Helper to dynamically adjust base cider pricing based on total base cider quantity
  const adjustBaseCiderPrices = (items: CartItem[]): CartItem[] => {
    const baseCiders = items.filter(i => i.id.startsWith('base_'));
    const totalBaseQty = baseCiders.reduce((sum, i) => sum + i.quantity, 0);
    const unitPrice = totalBaseQty >= 6 ? 5.00 : 6.50;

    return items.map(item => {
      if (item.id.startsWith('base_')) {
        return { ...item, price: unitPrice };
      }
      return item;
    });
  };

  return {
    items: [],
    isOpen: false,
    addItem: (item) => set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      let updatedItems;
      if (existing) {
        updatedItems = state.items.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      } else {
        updatedItems = [...state.items, item];
      }
      return { 
        items: adjustBaseCiderPrices(updatedItems), 
        isOpen: true 
      };
    }),
    removeItem: (id) => set((state) => {
      const remainingItems = state.items.filter((i) => i.id !== id);
      return {
        items: adjustBaseCiderPrices(remainingItems)
      };
    }),
    updateQuantity: (id, quantity) => set((state) => {
      const updatedItems = state.items.map((i) => i.id === id ? { ...i, quantity } : i);
      return {
        items: adjustBaseCiderPrices(updatedItems)
      };
    }),
    toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
    clearCart: () => set({ items: [] }),
  };
});
