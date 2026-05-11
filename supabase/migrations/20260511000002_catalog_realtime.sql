-- Enable Realtime for catalog_items so the checkout widget
-- receives live updates when an admin changes the catalog.
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_items;
