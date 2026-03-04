import { CatalogItem } from "@/types/booking";
import couchImg from "@/assets/catalog/couch.jpg";
import loveseatImg from "@/assets/catalog/loveseat.jpg";
import mattressImg from "@/assets/catalog/mattress.jpg";
import dresserImg from "@/assets/catalog/dresser.jpg";
import deskImg from "@/assets/catalog/desk.jpg";
import diningTableImg from "@/assets/catalog/dining-table.jpg";
import chairImg from "@/assets/catalog/chair.jpg";
import bookshelfImg from "@/assets/catalog/bookshelf.jpg";
import fridgeImg from "@/assets/catalog/fridge.jpg";
import washerImg from "@/assets/catalog/washer.jpg";
import dryerImg from "@/assets/catalog/dryer.jpg";
import dishwasherImg from "@/assets/catalog/dishwasher.jpg";
import ovenImg from "@/assets/catalog/oven.jpg";
import microwaveImg from "@/assets/catalog/microwave.jpg";
import tvImg from "@/assets/catalog/tv.jpg";
import monitorImg from "@/assets/catalog/monitor.jpg";
import printerImg from "@/assets/catalog/printer.jpg";
import yardBagImg from "@/assets/catalog/yard-bag.jpg";
import branchesImg from "@/assets/catalog/branches.jpg";
import hotTubImg from "@/assets/catalog/hot-tub.jpg";
import grillImg from "@/assets/catalog/grill.jpg";
import boxesImg from "@/assets/catalog/boxes.jpg";
import tiresImg from "@/assets/catalog/tires.jpg";
import debrisBagImg from "@/assets/catalog/debris-bag.jpg";
import miscImg from "@/assets/catalog/misc.jpg";

export const defaultCatalog: CatalogItem[] = [
  // Furniture
  { id: "couch", name: "Couch / Sofa", category: "Furniture", price: 65, imageUrl: couchImg },
  { id: "loveseat", name: "Loveseat", category: "Furniture", price: 45, imageUrl: loveseatImg },
  { id: "mattress", name: "Mattress", category: "Furniture", price: 50, imageUrl: mattressImg },
  { id: "dresser", name: "Dresser", category: "Furniture", price: 55, imageUrl: dresserImg },
  { id: "desk", name: "Desk", category: "Furniture", price: 40, imageUrl: deskImg },
  { id: "dining-table", name: "Dining Table", category: "Furniture", price: 60, imageUrl: diningTableImg },
  { id: "chair", name: "Chair", category: "Furniture", price: 20, imageUrl: chairImg },
  { id: "bookshelf", name: "Bookshelf", category: "Furniture", price: 35, imageUrl: bookshelfImg },
  // Appliances
  { id: "fridge", name: "Refrigerator", category: "Appliances", price: 75, imageUrl: fridgeImg },
  { id: "washer", name: "Washer", category: "Appliances", price: 65, imageUrl: washerImg },
  { id: "dryer", name: "Dryer", category: "Appliances", price: 65, imageUrl: dryerImg },
  { id: "dishwasher", name: "Dishwasher", category: "Appliances", price: 55, imageUrl: dishwasherImg },
  { id: "oven", name: "Oven / Stove", category: "Appliances", price: 70, imageUrl: ovenImg },
  { id: "microwave", name: "Microwave", category: "Appliances", price: 25, imageUrl: microwaveImg },
  // Electronics
  { id: "tv", name: "Television", category: "Electronics", price: 35, imageUrl: tvImg },
  { id: "monitor", name: "Computer / Monitor", category: "Electronics", price: 25, imageUrl: monitorImg },
  { id: "printer", name: "Printer", category: "Electronics", price: 20, imageUrl: printerImg },
  // Yard & Outdoor
  { id: "yard-bag", name: "Yard Waste Bag", category: "Yard & Outdoor", price: 15, imageUrl: yardBagImg },
  { id: "branches", name: "Tree Branches (bundle)", category: "Yard & Outdoor", price: 25, imageUrl: branchesImg },
  { id: "hot-tub", name: "Hot Tub", category: "Yard & Outdoor", price: 150, imageUrl: hotTubImg },
  { id: "grill", name: "BBQ Grill", category: "Yard & Outdoor", price: 45, imageUrl: grillImg },
  // Miscellaneous
  { id: "boxes", name: "Boxes (small load)", category: "Miscellaneous", price: 30, imageUrl: boxesImg },
  { id: "tires", name: "Tires (each)", category: "Miscellaneous", price: 15, imageUrl: tiresImg },
  { id: "debris-bag", name: "Construction Debris Bag", category: "Miscellaneous", price: 25, imageUrl: debrisBagImg },
  { id: "misc", name: "Miscellaneous Item", category: "Miscellaneous", price: 20, imageUrl: miscImg },
];
