import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BookingState,
  CatalogItem,
  CustomerDetails,
  ServiceType,
  TimeWindow,
  ZipPricingResult,
} from "@/types/booking";
import { BOOKING_CONFIG } from "@/config/booking";
import { defaultCatalog } from "@/data/defaultCatalog";
import { ImageSettings, parseImageSettings } from "@/lib/imageSettings";

export interface AppImage {
  url: string | null;
  settings: ImageSettings;
}

interface BookingContextValue {
  state: BookingState;
  catalog: CatalogItem[];
  categories: string[];
  catalogLoading: boolean;
  zipPricing: ZipPricingResult;
  zipLookupLoading: boolean;
  appImages: Record<string, AppImage>;
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
  setSkipPhotos: (v: boolean) => void;
  subtotal: number;
  itemTotal: number;
  photoPromoDiscount: number;
  adjustedItemTotal: number;
  total: number;
  payableAmount: number;
  canProceed: boolean;
}

const BookingContext = createContext<BookingContextValue | null>(null);

const emptyCustomer: CustomerDetails = {
  name: "",
  phone: "",
  email: "",
  address: "",
  address2: "",
  zip: "",
  gateCode: "",
  notes: "",
  photos: [],
  propertyType: null,
};

const idleZipPricing: ZipPricingResult = {
  zipCode: "",
  minimumPrice: null,
  status: "idle",
  message: "Enter your ZIP code to confirm pricing before checkout.",
};

const STORAGE_KEY = 'booking_draft_v1';

const loadDraft = (): Partial<BookingState> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Restore selectedDate from ISO string back to Date object
    if (parsed.selectedDate) {
      parsed.selectedDate = new Date(parsed.selectedDate);
    }
    // Always start with empty photos since File objects can't be serialized
    if (parsed.customer) {
      parsed.customer.photos = [];
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveDraft = (state: BookingState) => {
  try {
    const serializable = {
      ...state,
      selectedDate: state.selectedDate ? state.selectedDate.toISOString() : null,
      customer: {
        ...state.customer,
        photos: [], // skip File objects
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore serialization errors
  }
};

export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
};

const normalizeZip = (zip: string) => zip.trim();

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BookingState>(() => {
    const draft = loadDraft();
    return {
      step: 0,
      serviceType: null,
      cart: [],
      customItems: [],
      selectedDate: null,
      selectedTimeWindow: null,
      customer: emptyCustomer,
      paymentId: null,
      completed: false,
      skipPhotos: false,
      ...draft,
    };
  });
  const [catalog, setCatalog] = useState<CatalogItem[]>(defaultCatalog);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [zipPricing, setZipPricing] = useState<ZipPricingResult>(idleZipPricing);
  const [zipLookupLoading, setZipLookupLoading] = useState(false);
  const [appImages, setAppImages] = useState<Record<string, AppImage>>({});

  // Persist draft to localStorage after every state change
  useEffect(() => {
    if (state.completed) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      saveDraft(state);
    }
  }, [state]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("app_images").select("key, url, settings");
      if (!active || !data) return;
      const map: Record<string, AppImage> = {};
      data.forEach((row: { key: string; url: string | null; settings: unknown }) => {
        map[row.key] = { url: row.url, settings: parseImageSettings(row.settings) };
      });
      setAppImages(map);
    };
    load();
    const channel = supabase
      .channel("app_images_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_images" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setCatalogLoading(true);

    const fetchCatalog = async () => {
      try {
        if (BOOKING_CONFIG.catalogEndpoint) {
          const response = await fetch(BOOKING_CONFIG.catalogEndpoint);
          const data = await response.json();
          setCatalog(data);
        } else {
          const { data, error } = await supabase.functions.invoke("get-catalog");
          if (error) throw error;

          if (Array.isArray(data)) {
            const defaultImageMap = new Map(defaultCatalog.map((item) => [item.id, item.imageUrl]));
            const merged = data.map((item: CatalogItem) => ({
              ...item,
              imageUrl: item.imageUrl || defaultImageMap.get(item.id) || undefined,
            }));
            setCatalog(merged);
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

  useEffect(() => {
    const zipCode = normalizeZip(state.customer.zip);

    if (!zipCode) {
      setZipLookupLoading(false);
      setZipPricing(idleZipPricing);
      return;
    }

    if (!BOOKING_CONFIG.zipCodePattern.test(zipCode)) {
      setZipLookupLoading(false);
      setZipPricing({
        zipCode,
        minimumPrice: null,
        status: "invalid",
        message: "Enter a valid ZIP code to continue.",
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setZipLookupLoading(true);

      const { data: row, error } = await supabase
        .from("zip_pricing")
        .select("minimum_price")
        .eq("zip_code", zipCode)
        .eq("active", true)
        .maybeSingle();

      if (cancelled) return;

      if (error || !row) {
        setZipPricing({
          zipCode,
          minimumPrice: null,
          status: "unmapped",
          message: "We need to confirm pricing for your area",
        });
        setZipLookupLoading(false);
        return;
      }

      setZipPricing({
        zipCode,
        minimumPrice: Number(row.minimum_price),
        status: "resolved",
        message: null,
      });
      setZipLookupLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.customer.zip]);

  const categories = useMemo(() => [...new Set(catalog.map((item) => item.category))], [catalog]);

  const setStep = useCallback((step: number) => setState((s) => ({ ...s, step })), []);
  const nextStep = useCallback(() => setState((s) => ({ ...s, step: Math.min(s.step + 1, 4) })), []);
  const prevStep = useCallback(() => setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) })), []);
  const setServiceType = useCallback((serviceType: ServiceType) => setState((s) => ({ ...s, serviceType })), []);

  const addToCart = useCallback((item: CatalogItem) => {
    setState((s) => {
      const existing = s.cart.find((entry) => entry.item.id === item.id);
      if (existing) {
        return {
          ...s,
          cart: s.cart.map((entry) =>
            entry.item.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
          ),
        };
      }
      return { ...s, cart: [...s.cart, { item, quantity: 1 }] };
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((entry) => entry.item.id !== itemId) }));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setState((s) => {
      if (quantity <= 0) {
        return { ...s, cart: s.cart.filter((entry) => entry.item.id !== itemId) };
      }

      return {
        ...s,
        cart: s.cart.map((entry) => (entry.item.id === itemId ? { ...entry, quantity } : entry)),
      };
    });
  }, []);

  const addCustomItem = useCallback((description: string) => {
    setState((s) => ({ ...s, customItems: [...s.customItems, { description }] }));
  }, []);

  const removeCustomItem = useCallback((index: number) => {
    setState((s) => ({ ...s, customItems: s.customItems.filter((_, itemIndex) => itemIndex !== index) }));
  }, []);

  const setSelectedDate = useCallback((selectedDate: Date | null) => {
    setState((s) => ({ ...s, selectedDate }));
  }, []);

  const setSelectedTimeWindow = useCallback((selectedTimeWindow: TimeWindow | null) => {
    setState((s) => ({ ...s, selectedTimeWindow }));
  }, []);

  const updateCustomer = useCallback((partial: Partial<CustomerDetails>) => {
    setState((s) => ({ ...s, customer: { ...s.customer, ...partial } }));
  }, []);

  const setPaymentId = useCallback((paymentId: string) => setState((s) => ({ ...s, paymentId })), []);
  const setCompleted = useCallback((completed: boolean) => setState((s) => ({ ...s, completed })), []);
  const setSkipPhotos = useCallback((skipPhotos: boolean) => setState((s) => ({ ...s, skipPhotos })), []);

  const itemTotal = useMemo(
    () => state.cart.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0),
    [state.cart],
  );
  const subtotal = itemTotal;
  const hasPhotos = state.customer.photos.length > 0;
  const photoPromoDiscount = useMemo(
    () => (hasPhotos && BOOKING_CONFIG.photoPromoPercent > 0
      ? Math.round((itemTotal * BOOKING_CONFIG.photoPromoPercent) / 100)
      : 0),
    [hasPhotos, itemTotal],
  );
  const adjustedItemTotal = useMemo(() => Math.max(itemTotal - photoPromoDiscount, 0), [itemTotal, photoPromoDiscount]);
  const total = useMemo(() => {
    if (state.cart.length === 0) return 0;
    if (zipPricing.minimumPrice == null) return adjustedItemTotal;
    return Math.max(adjustedItemTotal, zipPricing.minimumPrice);
  }, [adjustedItemTotal, state.cart.length, zipPricing.minimumPrice]);
  const payableAmount = useMemo(
    () => (BOOKING_CONFIG.depositMode ? Math.ceil((total * BOOKING_CONFIG.depositPercentage) / 100) : total),
    [total],
  );

  const zipReady = zipPricing.status === "resolved";

  const canProceed = useMemo(() => {
    switch (state.step) {
      case 0:
        return !!state.serviceType && zipReady;
      case 1:
        return state.cart.length > 0 && (state.customer.photos.length > 0 || state.skipPhotos) && zipReady;
      case 2:
        return !!state.selectedDate && !!state.selectedTimeWindow && zipReady;
      case 3: {
        const customer = state.customer;
        return !!(
          customer.name &&
          customer.phone &&
          customer.email &&
          customer.address &&
          customer.zip &&
          customer.propertyType &&
          zipReady
        );
      }
      case 4:
        return !!state.paymentId;
      default:
        return false;
    }
  }, [state, zipReady]);

  const value: BookingContextValue = {
    state,
    catalog,
    categories,
    catalogLoading,
    zipPricing,
    zipLookupLoading,
    appImages,
    setStep,
    nextStep,
    prevStep,
    setServiceType,
    addToCart,
    removeFromCart,
    updateQuantity,
    addCustomItem,
    removeCustomItem,
    setSelectedDate,
    setSelectedTimeWindow,
    updateCustomer,
    setPaymentId,
    setCompleted,
    setSkipPhotos,
    subtotal,
    itemTotal,
    photoPromoDiscount,
    adjustedItemTotal,
    total,
    payableAmount,
    canProceed,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};
