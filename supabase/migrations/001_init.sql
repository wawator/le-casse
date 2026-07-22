-- LE CASSE — schéma initial (marche ①, prépare la marche ② duel)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_number integer not null,
  tries integer not null,
  won boolean not null,
  grid jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_number)
);

-- Préparée pour la marche ② (duel) : non utilisée par l'UI de ce MVP.
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'en-attente',
  code jsonb,
  player_a uuid references public.profiles (id) on delete cascade,
  player_b uuid references public.profiles (id) on delete cascade,
  winner uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists daily_results_challenge_idx on public.daily_results (challenge_number);

-- Row Level Security : chacun ne lit/écrit que ses propres lignes.
alter table public.profiles enable row level security;
alter table public.daily_results enable row level security;
alter table public.duels enable row level security;

create policy "profiles: lecture de son propre profil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: creation de son propre profil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: mise a jour de son propre profil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "daily_results: lecture de ses propres resultats"
  on public.daily_results for select
  using (auth.uid() = user_id);

create policy "daily_results: creation de ses propres resultats"
  on public.daily_results for insert
  with check (auth.uid() = user_id);

create policy "duels: lecture si participant"
  on public.duels for select
  using (auth.uid() = player_a or auth.uid() = player_b);

create policy "duels: creation en tant que joueur A"
  on public.duels for insert
  with check (auth.uid() = player_a);

create policy "duels: mise a jour si participant"
  on public.duels for update
  using (auth.uid() = player_a or auth.uid() = player_b);

-- Les migrations SQL n'accordent PAS automatiquement de privilèges aux
-- rôles anon/authenticated (contrairement aux tables créées depuis l'éditeur
-- du dashboard Supabase) : la RLS ci-dessus filtre les LIGNES, encore faut-il
-- que le rôle ait le droit d'exécuter l'opération sur la table elle-même.
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.daily_results to authenticated;

-- Vue agrégée publique : répartition des essais du jour, sans exposer les
-- lignes individuelles. Volontairement PAS en security_invoker : la vue
-- s'exécute avec les privilèges de son propriétaire (comportement par
-- défaut de Postgres/Supabase) pour agréger toutes les lignes malgré la
-- RLS de daily_results, qui elle reste la seule voie d'accès ligne par ligne.
create or replace view public.daily_stats as
  select
    challenge_number,
    tries,
    won,
    count(*) as player_count
  from public.daily_results
  group by challenge_number, tries, won;

grant select on public.daily_stats to anon, authenticated;
