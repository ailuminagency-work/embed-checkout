-- Add description field to catalog items
alter table public.catalog_items
  add column if not exists description text;

-- Create public storage bucket for catalog item images
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

-- Allow admins to upload
create policy "admin_insert_catalog_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Allow admins to update (replace)
create policy "admin_update_catalog_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Allow admins to delete
create policy "admin_delete_catalog_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Public read (images are public)
create policy "public_read_catalog_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'catalog-images');
