import React, { createContext, useContext, useState } from "react";

export interface CartItem {
  harvestId: string;
  title: string;
  pricePerUnit: number;
  unit: string;
  quantity: number;
  sellerId: string;
  sellerName: string;
  imageUrl?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQuantity: (harvestId: string, quantity: number) => void;
  removeFromCart: (harvestId: string) => void;
  clearCart: () => void;
  totalAmount: number;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addToCart(newItem: CartItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.harvestId === newItem.harvestId);
      if (existing) {
        return prev.map((i) =>
          i.harvestId === newItem.harvestId
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i,
        );
      }
      return [...prev, newItem];
    });
  }

  function updateQuantity(harvestId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(harvestId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.harvestId === harvestId ? { ...i, quantity } : i)),
    );
  }

  function removeFromCart(harvestId: string) {
    setItems((prev) => prev.filter((i) => i.harvestId !== harvestId));
  }

  function clearCart() {
    setItems([]);
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.pricePerUnit * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
