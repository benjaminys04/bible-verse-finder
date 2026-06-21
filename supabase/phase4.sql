-- Open Source Bible — Phase 4: page-view tracking for the admin dashboard.
-- Optional: the dashboard works without this; it just shows "—" for Page views
-- until this table exists. Run in Supabase → SQL Editor → New query → Run.

create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  path       text,
  created_at timestamptz not null default now()
);

-- Only the server (service-role key) writes/reads this. Enable RLS with no
-- policies so regular users can't access it; the service role bypasses RLS.
alter table public.page_views enable row level security;
