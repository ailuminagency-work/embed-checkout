import { CatalogItem } from "@/types/booking";

export const defaultCatalog: CatalogItem[] = [
  // Furniture
  { id: "couch", name: "Couch / Sofa", category: "Furniture", price: 65 },
  { id: "loveseat", name: "Loveseat", category: "Furniture", price: 45 },
  { id: "mattress", name: "Mattress", category: "Furniture", price: 50 },
  { id: "dresser", name: "Dresser", category: "Furniture", price: 55 },
  { id: "desk", name: "Desk", category: "Furniture", price: 40 },
  { id: "dining-table", name: "Dining Table", category: "Furniture", price: 60 },
  { id: "chair", name: "Chair", category: "Furniture", price: 20 },
  { id: "bookshelf", name: "Bookshelf", category: "Furniture", price: 35 },
  // Appliances
  { id: "fridge", name: "Refrigerator", category: "Appliances", price: 75 },
  { id: "washer", name: "Washer", category: "Appliances", price: 65 },
  { id: "dryer", name: "Dryer", category: "Appliances", price: 65 },
  { id: "dishwasher", name: "Dishwasher", category: "Appliances", price: 55 },
  { id: "oven", name: "Oven / Stove", category: "Appliances", price: 70 },
  { id: "microwave", name: "Microwave", category: "Appliances", price: 25 },
  // Electronics
  { id: "tv", name: "Television", category: "Electronics", price: 35 },
  { id: "monitor", name: "Computer / Monitor", category: "Electronics", price: 25 },
  { id: "printer", name: "Printer", category: "Electronics", price: 20 },
  // Yard & Outdoor
  { id: "yard-bag", name: "Yard Waste Bag", category: "Yard & Outdoor", price: 15 },
  { id: "branches", name: "Tree Branches (bundle)", category: "Yard & Outdoor", price: 25 },
  { id: "hot-tub", name: "Hot Tub", category: "Yard & Outdoor", price: 150 },
  { id: "grill", name: "BBQ Grill", category: "Yard & Outdoor", price: 45 },
  // Miscellaneous
  { id: "boxes", name: "Boxes (small load)", category: "Miscellaneous", price: 30 },
  { id: "tires", name: "Tires (each)", category: "Miscellaneous", price: 15 },
  { id: "debris-bag", name: "Construction Debris Bag", category: "Miscellaneous", price: 25 },
  { id: "misc", name: "Miscellaneous Item", category: "Miscellaneous", price: 20 },
];
