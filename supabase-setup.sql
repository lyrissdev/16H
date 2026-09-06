-- 16H — Supabase setup
-- Run this entire file once in Supabase > SQL Editor.

create table if not exists public.timeline_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null default '',
  start_ms bigint not null default 0,
  end_ms bigint not null default 0,
  color text not null default '#23272d',
  address text not null default 'Aucune',
  description text not null default 'Aucune',
  type_id text,
  updated_ms bigint not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.timeline_blocks add column if not exists address text not null default 'Aucune';
alter table public.timeline_blocks add column if not exists description text not null default 'Aucune';
alter table public.timeline_blocks add column if not exists type_id text;

create table if not exists public.timeline_block_types (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null default '',
  address text not null default 'Aucune',
  description text not null default 'Aucune',
  duration_minutes integer not null default 15,
  updated_ms bigint not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.timeline_rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null default '',
  start_time text not null default '00:00',
  end_time text not null default '08:00',
  enabled boolean not null default true,
  color text not null default '#5b6472',
  updated_ms bigint not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.timeline_blocks enable row level security;
alter table public.timeline_rules enable row level security;
alter table public.timeline_block_types enable row level security;

-- Re-running this setup stays safe.
drop policy if exists "16H users manage own blocks" on public.timeline_blocks;
create policy "16H users manage own blocks"
on public.timeline_blocks
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "16H users manage own rules" on public.timeline_rules;
create policy "16H users manage own rules"
on public.timeline_rules
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.timeline_blocks from anon;
revoke all on table public.timeline_rules from anon;
grant select, insert, update, delete on table public.timeline_blocks to authenticated;
grant select, insert, update, delete on table public.timeline_rules to authenticated;

create index if not exists timeline_blocks_user_updated_idx
  on public.timeline_blocks (user_id, updated_ms);
create index if not exists timeline_rules_user_updated_idx
  on public.timeline_rules (user_id, updated_ms);


drop policy if exists "16H users manage own block types" on public.timeline_block_types;
create policy "16H users manage own block types"
on public.timeline_block_types
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.timeline_block_types from anon;
grant select, insert, update, delete on table public.timeline_block_types to authenticated;

create index if not exists timeline_block_types_user_updated_idx
  on public.timeline_block_types (user_id, updated_ms);
