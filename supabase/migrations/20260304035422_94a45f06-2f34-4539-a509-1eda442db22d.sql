
-- Create catalog items table
CREATE TABLE public.catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- Public read access (catalog is public data)
CREATE POLICY "Anyone can read active catalog items"
  ON public.catalog_items FOR SELECT
  USING (active = true);

-- Seed with default catalog data
INSERT INTO public.catalog_items (id, name, category, price, sort_order) VALUES
  ('couch', 'Couch / Sofa', 'Furniture', 65, 1),
  ('loveseat', 'Loveseat', 'Furniture', 45, 2),
  ('mattress', 'Mattress', 'Furniture', 50, 3),
  ('dresser', 'Dresser', 'Furniture', 55, 4),
  ('desk', 'Desk', 'Furniture', 40, 5),
  ('dining-table', 'Dining Table', 'Furniture', 60, 6),
  ('chair', 'Chair', 'Furniture', 20, 7),
  ('bookshelf', 'Bookshelf', 'Furniture', 35, 8),
  ('fridge', 'Refrigerator', 'Appliances', 75, 9),
  ('washer', 'Washer', 'Appliances', 65, 10),
  ('dryer', 'Dryer', 'Appliances', 65, 11),
  ('dishwasher', 'Dishwasher', 'Appliances', 55, 12),
  ('oven', 'Oven / Stove', 'Appliances', 70, 13),
  ('microwave', 'Microwave', 'Appliances', 25, 14),
  ('tv', 'Television', 'Electronics', 35, 15),
  ('monitor', 'Computer / Monitor', 'Electronics', 25, 16),
  ('printer', 'Printer', 'Electronics', 20, 17),
  ('yard-bag', 'Yard Waste Bag', 'Yard & Outdoor', 15, 18),
  ('branches', 'Tree Branches (bundle)', 'Yard & Outdoor', 25, 19),
  ('hot-tub', 'Hot Tub', 'Yard & Outdoor', 150, 20),
  ('grill', 'BBQ Grill', 'Yard & Outdoor', 45, 21),
  ('boxes', 'Boxes (small load)', 'Miscellaneous', 30, 22),
  ('tires', 'Tires (each)', 'Miscellaneous', 15, 23),
  ('debris-bag', 'Construction Debris Bag', 'Miscellaneous', 25, 24),
  ('misc', 'Miscellaneous Item', 'Miscellaneous', 20, 25);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
