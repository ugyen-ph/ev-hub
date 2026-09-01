-- ============================================================
-- EV Hub · 0005 — DEMO-ONLY: dashboard status flips WITHOUT a secret key
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- Idempotent: safe to run twice.
-- ============================================================
-- WHY THIS EXISTS
--   The dashboard's status buttons normally use a secret/service key that
--   bypasses Row Level Security. That key is missing/broken in this
--   environment, so this migration opens a tightly-guarded PUBLIC (anon)
--   path instead, so the demo works today.
--
-- SAFETY RAILS (why this is acceptable for a demo)
--   1. COLUMN-level grant: anon may change ONLY `status` + `status_source`.
--      label, power_kw, station_id, charge_point_id ... are untouchable.
--   2. ROW-level guard: chargers whose status_source = 'ocpp' can NEVER be
--      flipped this way. When BPC connects real chargers (Phase 2), their
--      status is hardware truth — the public internet cannot override it.
--   3. Scope: policy is `to anon` only. Signed-in mobile users
--      (role `authenticated`) are NOT covered — they still can't flip.
--   4. Before going live: run the two DROP statements at the bottom.
-- ============================================================

grant update (status, status_source) on public.chargers to anon;

drop policy if exists chargers_demo_flip on public.chargers;
create policy chargers_demo_flip on public.chargers
  for update to anon
  using (status_source in ('seed', 'manual'))        -- which rows may be targeted
  with check (status_source in ('seed', 'manual'));  -- which resulting rows are acceptable

-- ---------- TO CLOSE THE DEMO PATH BEFORE PRODUCTION, run: ----------
-- drop policy if exists chargers_demo_flip on public.chargers;
-- revoke update (status, status_source) on public.chargers from anon;
