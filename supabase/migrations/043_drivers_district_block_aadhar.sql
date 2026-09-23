-- ============================================================
-- 043_drivers_district_block_aadhar
--
-- Adds optional district, block, and aadhar_no columns
-- to the drivers table for administrative verification.
-- ============================================================

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS block TEXT;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS aadhar_no TEXT;
