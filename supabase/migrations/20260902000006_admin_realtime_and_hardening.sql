-- ============================================================
-- EV Hub · 0006 — admin dashboard support: realtime + hardening
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- Idempotent: safe to run twice.
-- ============================================================

-- ---------- 1) Realtime for the admin dashboards ----------
-- 0002 published only chargers + reservations. The admin Users dashboard
-- needs `profiles` (live signups), and the Stations dashboard also wants
-- `stations` (renames / district edits / is_active toggles stream in).
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.stations;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Realtime respects RLS: postgres_changes events are only delivered to
-- subscribers whose SELECT policy admits the row. profiles_select allows
-- auth.uid() = id or is_admin(), so only admins receive other users' rows.

-- ---------- 2) SECURITY FIX: users could promote themselves to admin ----------
-- profiles_update (0003) only checked auth.uid() = id, so ANY signed-in user
-- could run `update profiles set role = 'admin'` on their own row and unlock
-- every admin-only policy. Role changes must happen server-side (Dashboard /
-- SQL / service key) — clients may now edit only these three columns:
revoke update on public.profiles from authenticated;
grant update (full_name, phone, ev_model) on public.profiles to authenticated;
-- (the profiles_update RLS policy from 0003 still applies on top of these
--  column grants — the mobile app's profile editing keeps working)

-- ---------- 3) Maintenance RPC is for signed-in operators, not the public ----------
revoke execute on function public.expire_stale_reservations() from public;
grant execute on function public.expire_stale_reservations() to authenticated;

-- ============================================================
-- Bootstrap the FIRST operator (run once, then delete/comment out):
--
--   update public.profiles p
--      set role = 'admin'
--     from auth.users u
--    where u.id = p.id
--      and u.email = 'you@example.com';
--
-- (Sign up first — from the mobile app or the admin login page — then run
--  this with your real email. Only server-side SQL can set the role now.)
-- ============================================================
