import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { BookingState, ServiceType, CatalogItem, TimeWindow, CustomerDetails } from "@/types/booking";
import { BOOKING_CONFIG } from "@/config/booking";
import { defaultCatalog } from "@/data/defaultCatalog";
import { supabase } from "@/integrations/supabase/client";

interface BookingContextValue {
  state: BookingState;
  catalog: CatalogItem[];
  categories: string[];
  catalogLoading: boolean;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setServiceType: (type: ServiceType) => void;
  addToCart: (item: CatalogItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  addCustomItem: (description: string) => void;
  removeCustomItem: (index: number) => void;
  setSelectedDate: (date: Date | null) => void;
  setSelectedTimeWindow: (tw: TimeWindow | null) => void;
  updateCustomer: (partial: Partial<CustomerDetails>) => void;
  setPaymentId: (id: string) => void;
  setCompleted: (v: boolean) => void;
  subtotal: number;
  total: number;
  payableAmount: number;
  canProceed: boolean;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
};

const emptyCustomer: CustomerDetails = {
  name: "", phone: "", email: "", address: "", zip: "", gateCode: "", notes: "", photos: [],
};

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BookingState>({
    step: 0,
    serviceType: null,
    cart: [],
    customItems: [],
    selectedDate: null,
    selectedTimeWindow: null,
    customer: emptyCustomer,
    paymentId: null,
    completed: false,
  });

  const [catalog, setCatalog] = useState<CatalogItem[]>(defaultCatalog);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    setCatalogLoading(true);
    
    const fetchCatalog = async () => {
      try {
        // If a custom catalog endpoint is configured, use that
        if (BOOKING_CONFIG.catalogEndpoint) {
          const r = await fetch(BOOKING_CONFIG.catalogEndpoint);
          const data = await r.json();
          setCatalog(data);
        } else {
          // Use the edge function by default
          const { data, error } = await supabase.functions.invoke("get-catalog");
          if (error) throw error;
          if (Array.isArray(data)) {
            setCatalog(data);
          } else {
            setCatalog(defaultCatalog);
          }
        }
      } catch {
        setCatalog(defaultCatalog);
      } finally {
        setCatalogLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const categories = useMemo(() => [...new Set(catalog.map((i) => i.category))], [catalog]);

  const setStep = useCallback((step: number) => setState((s) => ({ ...s, step })), []);
  const nextStep = useCallback(() => setState((s) => ({ ...s, step: Math.min(s.step + 1, 4) })), []);
  const prevStep = useCallback(() => setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) })), []);
  const setServiceType = useCallback((serviceType: ServiceType) => setState((s) => ({ ...s, serviceType })), []);

  const addToCart = useCallback((item: CatalogItem) => {
    setState((s) => {
      const existing = s.cart.find((c) => c.item.id === item.id);
      if (existing) {
        return { ...s, cart: s.cart.map((c) => (c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)) };
      }
      return { ...s, cart: [...s.cart, { item, quantity: 1 }] };
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((c) => c.item.id !== itemId) }));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setState((s) => {
      if (quantity <= 0) return { ...s, cart: s.cart.filter((c) => c.item.id !== itemId) };
      return { ...s, cart: s.cart.map((c) => (c.item.id === itemId ? { ...c, quantity } : c)) };
    });
  }, []);

  const addCustomItem = useCallback((description: string) => {
    setState((s) => ({ ...s, customItems: [...s.customItems, { description }] }));
  }, []);

  const removeCustomItem = useCallback((index: number) => {
    setState((s) => ({ ...s, customItems: s.customItems.filter((_, i) => i !== index) }));
  }, []);

  const setSelectedDate = useCallback((selectedDate: Date | null) => setState((s) => ({ ...s, selectedDate })), []);
  const setSelectedTimeWindow = useCallback((selectedTimeWindow: TimeWindow | null) => setState((s) => ({ ...s, selectedTimeWindow })), []);
  const updateCustomer = useCallback((partial: Partial<CustomerDetails>) => {
    setState((s) => ({ ...s, customer: { ...s.customer, ...partial } }));
  }, []);
  const setPaymentId = useCallback((paymentId: string) => setState((s) => ({ ...s, paymentId })), []);
  const setCompleted = useCallback((completed: boolean) => setState((s) => ({ ...s, completed })), []);

  const subtotal = useMemo(() => state.cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0), [state.cart]);
  const total = useMemo(() => Math.max(subtotal, state.cart.length > 0 ? BOOKING_CONFIG.minimumCharge : 0), [subtotal, state.cart.length]);
  const payableAmount = useMemo(
    () => (BOOKING_CONFIG.depositMode ? Math.ceil((total * BOOKING_CONFIG.depositPercentage) / 100) : total),
    [total],
  );

  const canProceed = useMemo(() => {
    switch (state.step) {
      case 0: return !!state.serviceType;
      case 1: return state.cart.length > 0;
      case 2: return !!state.selectedDate && !!state.selectedTimeWindow;
      case 3: {
        const c = state.customer;
        const hasRequired = !!(c.name && c.phone && c.email && c.address && c.zip);
        if (!hasRequired) return false;
        if (BOOKING_CONFIG.serviceAreaZips.length > 0 && !BOOKING_CONFIG.serviceAreaZips.includes(c.zip)) return false;
        return true;
      }
      case 4: return !!state.paymentId;
      default: return false;
    }
  }, [state]);

  const value: BookingContextValue = {
    state, catalog, categories, catalogLoading,
    setStep, nextStep, prevStep, setServiceType,
    addToCart, removeFromCart, updateQuantity,
    addCustomItem, removeCustomItem,
    setSelectedDate, setSelectedTimeWindow,
    updateCustomer, setPaymentId, setCompleted,
    subtotal, total, payableAmount, canProceed,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};
