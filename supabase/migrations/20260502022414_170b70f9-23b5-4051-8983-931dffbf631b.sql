create table if not exists public.app_images (
  key text primary key,
  url text,
  updated_at timestamptz not null default now()
);

alter table public.app_images enable row level security;

create policy "app_images public read"
  on public.app_images for select
  using (true);

create policy "app_images admin insert"
  on public.app_images for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "app_images admin update"
  on public.app_images for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "app_images admin delete"
  on public.app_images for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

insert into public.app_images (key, url) values
  ('widget_background', null),
  ('junk_removal_card', null),
  ('donation_pickup_card', null)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('app-images', 'app-images', true)
on conflict (id) do nothing;

create policy "app-images public read"
  on storage.objects for select
  using (bucket_id = 'app-images');

create policy "app-images admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'app-images' and public.has_role(auth.uid(), 'admin'));

create policy "app-images admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'app-images' and public.has_role(auth.uid(), 'admin'));

create policy "app-images admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'app-images' and public.has_role(auth.uid(), 'admin'));
