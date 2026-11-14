-- ULTRA SUPPLY — initial schema
-- Run in the Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------- Admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Categories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name jsonb not null,            -- { "fr": "...", "en": "...", "ar": "..." }
  description jsonb not null default '{}'::jsonb,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id uuid references public.categories(id) on delete set null,
  reference text not null,
  name jsonb not null,
  description jsonb not null default '{}'::jsonb,
  specs jsonb not null default '[]'::jsonb,   -- [{ "label": {fr,en,ar}, "value": "..." }]
  image_url text,
  featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);

-- ---------- Partners ----------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website text,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Site content (translatable) ----------
create table if not exists public.site_content (
  key text primary key,
  fr text not null default '',
  en text not null default '',
  ar text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- Quote requests ----------
create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  company text check (char_length(company) <= 160),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  phone text not null check (char_length(phone) between 6 and 30),
  product text not null check (char_length(product) between 2 and 200),
  reference text check (char_length(reference) <= 120),
  quantity int not null check (quantity between 1 and 1000000),
  message text check (char_length(message) <= 4000),
  attachment_path text,
  status text not null default 'new' check (status in ('new','in_progress','answered','archived')),
  locale text not null default 'fr' check (locale in ('fr','en','ar')),
  created_at timestamptz not null default now()
);

-- ---------- Contact messages ----------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  subject text not null check (char_length(subject) between 2 and 200),
  message text not null check (char_length(message) between 10 and 4000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists content_touch on public.site_content;
create trigger content_touch before update on public.site_content for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.partners enable row level security;
alter table public.site_content enable row level security;
alter table public.quote_requests enable row level security;
alter table public.contact_messages enable row level security;

create policy "admins read self" on public.admins for select using (user_id = auth.uid());

create policy "public read categories" on public.categories for select using (true);
create policy "admin write categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "public read products" on public.products for select using (published or public.is_admin());
create policy "admin write products" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "public read partners" on public.partners for select using (published or public.is_admin());
create policy "admin write partners" on public.partners for all using (public.is_admin()) with check (public.is_admin());

create policy "public read content" on public.site_content for select using (true);
create policy "admin write content" on public.site_content for all using (public.is_admin()) with check (public.is_admin());

-- Visitors may only INSERT requests (with forced default status); never read them.
create policy "anyone submits quotes" on public.quote_requests for insert
  with check (status = 'new');
create policy "admin manages quotes" on public.quote_requests for select using (public.is_admin());
create policy "admin updates quotes" on public.quote_requests for update using (public.is_admin());
create policy "admin deletes quotes" on public.quote_requests for delete using (public.is_admin());

create policy "anyone submits messages" on public.contact_messages for insert
  with check (is_read = false);
create policy "admin reads messages" on public.contact_messages for select using (public.is_admin());
create policy "admin updates messages" on public.contact_messages for update using (public.is_admin());
create policy "admin deletes messages" on public.contact_messages for delete using (public.is_admin());

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('quote-attachments', 'quote-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "public reads product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin writes product images" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin updates product images" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
create policy "admin deletes product images" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

-- Visitors can upload a quote attachment (into the "incoming/" folder) but cannot list or read files.
create policy "anyone uploads quote attachment" on storage.objects for insert
  with check (bucket_id = 'quote-attachments' and (storage.foldername(name))[1] = 'incoming');
create policy "admin reads quote attachments" on storage.objects for select using (bucket_id = 'quote-attachments' and public.is_admin());
create policy "admin deletes quote attachments" on storage.objects for delete using (bucket_id = 'quote-attachments' and public.is_admin());

-- ---------- Make a user admin ----------
-- 1. Create the user in Authentication > Users.
-- 2. Run:  insert into public.admins (user_id) select id from auth.users where email = 'admin@your-domain.tn';
