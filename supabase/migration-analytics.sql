-- ============================================================
-- POINTA — Statistiques d'audience (console plateforme)
-- À exécuter dans Supabase → SQL Editor → New query → Run.
-- Aucune donnée personnelle : pas d'adresse IP, pas de cookie publicitaire.
-- « visitor » est une empreinte éphémère (jour + appareil) qui sert uniquement
-- à ne pas compter dix fois la même personne dans la même journée.
-- ============================================================

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  kind text not null default 'vue' check (kind in ('vue', 'whatsapp', 'inscription', 'connexion')),
  path text not null default '/',
  referrer text,          -- d'où vient la visite (facebook, whatsapp, google…)
  device text,            -- 'mobile' | 'ordinateur'
  visitor text,           -- empreinte du jour, non réversible
  created_at timestamptz not null default now()
);

create index if not exists idx_site_events_created on public.site_events(created_at desc);
create index if not exists idx_site_events_kind on public.site_events(kind, created_at desc);

alter table public.site_events enable row level security;
-- Aucune policy : seul le serveur (clé secrète) écrit et lit ces lignes.
