-- ============================================================
-- POINTA — Migration : créneaux horaires par classe
-- À exécuter une fois dans Supabase → SQL Editor → Run.
-- Idempotent (add column if not exists).
-- ============================================================
alter table public.class_assignments add column if not exists day        text; -- ex: "Lundi"
alter table public.class_assignments add column if not exists start_time text; -- ex: "08:00"
alter table public.class_assignments add column if not exists end_time   text; -- ex: "10:00"
