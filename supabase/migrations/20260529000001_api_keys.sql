create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  key_prefix   text not null unique,
  key_hash     text not null,
  permissions  text[] not null default '{"read:bookings","read:catalog"}',
  active       boolean not null default true,
  last_used_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.api_keys enable row level security;

-- Only admins can manage API keys
create policy "admin_manage_api_keys" on public.api_keys
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Service role bypass is implicit; anon/authed roles cannot read key_hash
create index if not exists api_keys_prefix_idx on public.api_keys (key_prefix);
