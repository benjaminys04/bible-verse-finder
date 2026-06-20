-- Open Source Bible — database schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- (Phase 1 = profiles + usage; subscriptions get used in Phase 3 with Stripe.)

-- One profile row per authenticated user.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'user',   -- 'user' | 'admin'
  plan        text not null default 'free',    -- 'free' | 'pro'
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Monthly message usage, for the free 10-messages/month limit.
create table if not exists public.usage_monthly (
  user_id        uuid references public.profiles(id) on delete cascade,
  period         text not null,                -- 'YYYY-MM' (UTC)
  message_count  int  not null default 0,
  primary key (user_id, period)
);

-- Stripe subscription state (kept in sync by the Stripe webhook in Phase 3).
create table if not exists public.subscriptions (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id   text,
  stripe_subscription_id text,
  status               text,                   -- 'active' | 'trialing' | 'canceled' | ...
  price_interval       text,                   -- 'month' | 'year'
  current_period_end   timestamptz,
  updated_at           timestamptz not null default now()
);

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: each user can read only their own rows.
-- The server uses the service-role key (bypasses RLS) to meter usage and to
-- power the admin dashboard.
alter table public.profiles      enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.subscriptions enable row level security;

create policy "own profile read"   on public.profiles      for select using (auth.uid() = id);
create policy "own profile update" on public.profiles      for update using (auth.uid() = id);
create policy "own usage read"     on public.usage_monthly for select using (auth.uid() = user_id);
create policy "own sub read"       on public.subscriptions for select using (auth.uid() = user_id);
