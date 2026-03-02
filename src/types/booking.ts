export type ServiceType = "junk-removal" | "donation-pickup";

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string;
}

export interface CartItem {
  item: CatalogItem;
  quantity: number;
}

export interface TimeWindow {
  id: string;
  label: string;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  zip: string;
  gateCode: string;
  notes: string;
  photos: File[];
}

export interface BookingState {
  step: number;
  serviceType: ServiceType | null;
  cart: CartItem[];
  customItems: { description: string }[];
  selectedDate: Date | null;
  selectedTimeWindow: TimeWindow | null;
  customer: CustomerDetails;
  paymentId: string | null;
  completed: boolean;
}
