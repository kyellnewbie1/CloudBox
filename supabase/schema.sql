-- Run in Supabase SQL Editor.
-- Create a PRIVATE bucket named "cloudbox" in Storage first, or change SUPABASE_BUCKET.
-- Do not add public read/write policies to storage.objects. Access is mediated by server routes.

create table if not exists public.files (
  id text primary key,
  storage_path text not null unique,
  original_name text not null,
  safe_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  status text not null default 'pending' check (status in ('pending','active','deleted')),
  creator text not null default 'KyZX'
);

create index if not exists files_active_expiry_idx
  on public.files (expires_at) where status = 'active';
create index if not exists files_created_at_idx
  on public.files (created_at desc);

alter table public.files enable row level security;
-- Intentionally no anon/authenticated policies. Server uses service role and validates every request.
-- Keep SUPABASE_SERVICE_ROLE_KEY server-only.
