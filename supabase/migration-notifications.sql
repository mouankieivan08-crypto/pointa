-- ============================================================
-- POINTA — Migration : notifications + abonnements push
-- À exécuter une fois dans Supabase → SQL Editor → Run. Idempotent.
-- ============================================================

-- Notifications (in-app + envoyées)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade, -- null = notif établissement
  type text not null default 'info',   -- info | cours_bientot | pointer_depart | alerte
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_school on public.notifications(school_id, created_at desc);
create index if not exists idx_notif_teacher on public.notifications(teacher_id, read);

-- Abonnements Web Push (un par appareil d'enseignant)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (endpoint)
);
create index if not exists idx_push_teacher on public.push_subscriptions(teacher_id);

-- Suivi d'envoi (évite d'envoyer 2 fois la même notif pour un créneau/jour)
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid,          -- créneau concerné
  teacher_id uuid,
  kind text not null,          -- cours_bientot | pointer_depart
  the_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (assignment_id, kind, the_date)
);

-- RLS (accès applicatif via clé secrète serveur qui la contourne)
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;
