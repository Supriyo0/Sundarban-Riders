-- ============================================================
-- 044_driver_unique_id
--
-- Adds unique_id to drivers and driver_unique_id to toto_bookings
-- for custom admin driver identifier management.
-- ============================================================

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS unique_id TEXT;

ALTER TABLE public.toto_bookings
  ADD COLUMN IF NOT EXISTS driver_unique_id TEXT;
