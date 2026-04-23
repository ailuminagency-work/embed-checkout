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

export type PropertyType = "house" | "building" | "office" | "apartment";

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  address2?: string;
  zip: string;
  gateCode: string;
  notes: string;
  photos: File[];
  propertyType: PropertyType | null;
}

export type ZipPricingStatus = "idle" | "invalid" | "loading" | "resolved" | "unmapped";

export interface ZipPricingResult {
  zipCode: string;
  zoneId: string | null;
  zoneName: string | null;
  minimumPrice: number | null;
  status: ZipPricingStatus;
  message: string | null;
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
  skipPhotos: boolean;
}
