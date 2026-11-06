-- ============================================================
-- POINTA — Schéma de base de données (Supabase / PostgreSQL)
-- À exécuter dans Supabase → SQL Editor → New query → Run.
-- Multi-tenant (par école) + RLS. L'accès applicatif se fait côté
-- serveur avec la clé secrète (service_role) qui contourne la RLS ;
-- la RLS reste un filet de sécurité pour tout accès client.
-- ============================================================

-- Écoles (tenants) ------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  city text,
  address text,
  phone text,
  email text,
  lat double precision,
  lng double precision,
  radius_m integer not null default 100,          -- rayon géofence
  late_tolerance_min integer not null default 10, -- tolérance retard
  created_at timestamptz not null default now()
);

-- Pôles disciplinaires -------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null
);

-- Enseignants (et staff) -----------------------------------------
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- lien auth (optionnel)
  matricule text,
  first_name text not null,
  last_name text not null,
  position text not null default 'Enseignant',
  subject text,
  department_id uuid references public.departments(id) on delete set null,
  phone text,                       -- identifiant + mot de passe par défaut
  email text,
  photo_url text,                   -- photo d'inscription (reconnaissance faciale)
  hire_date date,
  base_salary integer not null default 0,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  color text default '#1e46c8',
  created_at timestamptz not null default now(),
  unique (school_id, phone)
);

-- Affectations par classe (emploi du temps) ----------------------
create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  classe text not null,
  day text,          -- créneau : jour (ex "Lundi")
  start_time text,   -- créneau : heure de début (ex "08:00")
  end_time text,     -- créneau : heure de fin (ex "10:00")
  hours_per_week numeric(5,2) not null default 0,
  hourly_rate integer not null default 0
);

-- Pointages -------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present' check (status in ('present','late','absent','off')),
  late_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  within_geofence boolean not null default true,
  lat double precision,
  lng double precision,
  method text not null default 'face' check (method in ('face','manual')),
  created_at timestamptz not null default now()
);

-- Congés / absences ----------------------------------------------
create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  type text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','accepted','refused')),
  created_at timestamptz not null default now()
);

-- Journal d'activité ---------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  actor text,
  action text not null,
  resource text,
  ip text,
  created_at timestamptz not null default now()
);

-- Index -----------------------------------------------------------
create index if not exists idx_teachers_school on public.teachers(school_id);
create index if not exists idx_assign_teacher on public.class_assignments(teacher_id);
create index if not exists idx_att_school_date on public.attendance(school_id, date);
create index if not exists idx_att_teacher on public.attendance(teacher_id);
create index if not exists idx_leaves_school on public.leaves(school_id);
create index if not exists idx_activity_school on public.activity_log(school_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.schools           enable row level security;
alter table public.departments       enable row level security;
alter table public.teachers          enable row level security;
alter table public.class_assignments enable row level security;
alter table public.attendance        enable row level security;
alter table public.leaves            enable row level security;
alter table public.activity_log      enable row level security;

-- Par défaut : aucun accès pour anon/authenticated (deny-all).
-- La clé service_role (serveur) contourne la RLS et gère les autorisations
-- dans le code applicatif. Ajoutez des policies ciblées quand vous
-- exposerez des lectures directes au client (scopées par school_id via le JWT).
-- Exemple (à activer plus tard) :
-- create policy "school members read teachers"
--   on public.teachers for select to authenticated
--   using (school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid);

-- ============================================================
-- Seed de démonstration (école + quelques enseignants)
-- ============================================================
insert into public.schools (id, name, type, city, address, phone, email, lat, lng, radius_m)
values ('00000000-0000-0000-0000-000000000001',
        'Complexe Scolaire La Réussite', 'Complexe scolaire', 'Brazzaville',
        'Brazzaville, Congo', '+242 06 000 00 00', 'contact@csr.cg',
        -4.2634, 15.2429, 100)
on conflict (id) do nothing;

insert into public.teachers (school_id, matricule, first_name, last_name, subject, phone, email, base_salary, status, color)
values
 ('00000000-0000-0000-0000-000000000001','CSR-001','Armand','Nkodia','Physique-Chimie','+242 06 100 20 30','armand.nkodia@csr.cg',0,'active','#1e46c8'),
 ('00000000-0000-0000-0000-000000000001','CSR-002','Sylvie','Massamba','Mathématiques','+242 06 101 21 31','sylvie.massamba@csr.cg',0,'active','#0d9488'),
 ('00000000-0000-0000-0000-000000000001','CSR-003','Patrick','Kaya','Français','+242 06 102 22 32','patrick.kaya@csr.cg',0,'active','#7c3aed')
on conflict do nothing;
