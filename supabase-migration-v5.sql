-- 16H V5 — migration
-- À exécuter UNE FOIS dans Supabase > SQL Editor avant de publier la V5.

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

alter table public.timeline_block_types enable row level security;

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
