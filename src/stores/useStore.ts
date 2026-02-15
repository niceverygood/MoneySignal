import { create } from "zustand";
import type { Profile, Signal, Notification } from "@/types";

interface AppState {
  // User
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;

  // Signals
  signals: Signal[];
  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  updateSignal: (id: string, updates: Partial<Signal>) => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;

  // UI
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;

  // Real-time prices
  prices: Record<string, number>;
  updatePrice: (symbol: string, price: number) => void;
}

export const useStore = create<AppState>((set) => ({
  // User
  profile: null,
  setProfile: (profile) => set({ profile }),

  // Signals
  signals: [],
  setSignals: (signals) => set({ signals }),
  addSignal: (signal) =>
    set((state) => ({ signals: [signal, ...state.signals] })),
  updateSignal: (id, updates) =>
    set((state) => ({
      signals: state.signals.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  // Notifications
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  // UI
  selectedCategory: "all",
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  // Real-time prices
  prices: {},
  updatePrice: (symbol, price) =>
    set((state) => ({ prices: { ...state.prices, [symbol]: price } })),
}));
