-- 16H V8 — Web Push notifications
-- Exécuter UNE FOIS dans Supabase > SQL Editor.

create table if not exists public.timeline_push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  updated_ms bigint not null,
  primary key (user_id, endpoint)
);

alter table public.timeline_push_subscriptions enable row level security;

drop policy if exists "16H users manage own push subscriptions" on public.timeline_push_subscriptions;
create policy "16H users manage own push subscriptions"
on public.timeline_push_subscriptions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.timeline_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  block_start boolean not null default true,
  next_block_15 boolean not null default true,
  deep_task_end boolean not null default true,
  overdue boolean not null default false,
  timezone text not null default 'Europe/Paris',
  updated_ms bigint not null
);

alter table public.timeline_notification_settings enable row level security;

drop policy if exists "16H users manage own notification settings" on public.timeline_notification_settings;
create policy "16H users manage own notification settings"
on public.timeline_notification_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.timeline_notification_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);

alter table public.timeline_notification_log enable row level security;

-- Users may inspect their own notification log, but only the Edge Function
-- (service role) should create notification log rows.
drop policy if exists "16H users read own notification log" on public.timeline_notification_log;
create policy "16H users read own notification log"
on public.timeline_notification_log
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists timeline_push_subscriptions_active_idx
  on public.timeline_push_subscriptions (user_id, active);

create index if not exists timeline_notification_log_sent_idx
  on public.timeline_notification_log (sent_at);
