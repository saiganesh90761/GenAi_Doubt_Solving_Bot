-- ==========================================================
-- Engineering Doubt Solver - Supabase Database Schema
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==========================================================

-- 1. Create conversations table
create table if not exists public.conversations (
  id text primary key,
  user_id text not null,
  title text not null default 'New Doubt Session',
  messages jsonb not null default '[]'::jsonb,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- 2. Create indexes for fast lookups
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_conversations_updated_at on public.conversations(updated_at desc);

-- 3. Enable Row Level Security
alter table public.conversations enable row level security;

-- 4. Create policies (permissive for anon/authenticated API access)
create policy "Allow all operations for conversations"
  on public.conversations
  for all
  using (true)
  with check (true);
