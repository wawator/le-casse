-- LE CASSE — marche ② : duel en temps réel.
--
-- Principe anti-triche : le code secret d'un duel (duels.code) n'est JAMAIS
-- lisible par les clients, même les participants. Toute évaluation d'essai
-- passe par la fonction submit_duel_guess (SECURITY DEFINER), qui est la
-- seule à lire la colonne. Le realtime des adversaires ne diffuse que le
-- nombre d'essais et l'état "résolu", jamais les couleurs jouées.

alter table public.duels
  add column if not exists updated_at timestamptz not null default now();

-- Historique privé des essais d'un joueur : couleurs jouées + indices.
create table if not exists public.duel_guesses (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  attempt_number integer not null,
  guess text[] not null,
  well_placed integer not null,
  misplaced integer not null,
  created_at timestamptz not null default now(),
  unique (duel_id, player_id, attempt_number)
);

-- Progression publique (aux deux joueurs d'un même duel) : jamais les couleurs.
create table if not exists public.duel_progress_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  attempt_number integer not null,
  solved boolean not null,
  created_at timestamptz not null default now()
);

alter table public.duel_guesses enable row level security;
alter table public.duel_progress_events enable row level security;

create policy "duel_guesses: lecture de ses propres essais"
  on public.duel_guesses for select
  using (auth.uid() = player_id);

create policy "duel_progress_events: lecture si participant au duel"
  on public.duel_progress_events for select
  using (
    exists (
      select 1 from public.duels d
      where d.id = duel_progress_events.duel_id
        and (auth.uid() = d.player_a or auth.uid() = d.player_b)
    )
  );

-- Aucune policy insert/update : ces tables ne sont écrites que par les
-- fonctions SECURITY DEFINER ci-dessous, qui s'exécutent avec les
-- privilèges du propriétaire (donc indépendamment de la RLS ci-dessus).
-- Le SELECT, en revanche, passe par le rôle authenticated normal : il faut
-- le GRANT de base en plus de la RLS (voir la remarque dans 001_init.sql).
grant select on public.duel_guesses to authenticated;
grant select on public.duel_progress_events to authenticated;

-- La colonne "code" ne doit jamais transiter vers un client, même le
-- propriétaire du duel : on retire son accès en lecture au rôle applicatif.
revoke select on public.duels from authenticated, anon;
grant select (id, status, player_a, player_b, winner, created_at, updated_at)
  on public.duels to authenticated;

create or replace function public._evaluate_guess(secret text[], guess text[])
returns table (well_placed integer, misplaced integer)
language plpgsql
immutable
as $$
declare
  secret_remaining text[] := secret;
  guess_remaining text[] := guess;
  i integer;
  wp integer := 0;
  mp integer := 0;
  idx integer;
begin
  for i in 1..array_length(secret, 1) loop
    if guess_remaining[i] = secret_remaining[i] then
      wp := wp + 1;
      secret_remaining[i] := null;
      guess_remaining[i] := null;
    end if;
  end loop;

  for i in 1..array_length(guess_remaining, 1) loop
    if guess_remaining[i] is not null then
      idx := array_position(secret_remaining, guess_remaining[i]);
      if idx is not null then
        mp := mp + 1;
        secret_remaining[idx] := null;
      end if;
    end if;
  end loop;

  return query select wp, mp;
end;
$$;

revoke execute on function public._evaluate_guess(text[], text[]) from public, anon, authenticated;

create or replace function public.create_duel()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  colors text[] := array['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet'];
  secret text[] := array[]::text[];
  i integer;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  for i in 1..4 loop
    secret := secret || colors[1 + floor(random() * 6)::integer];
  end loop;

  insert into public.duels (status, code, player_a)
  values ('en-attente', to_jsonb(secret), auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.join_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  select * into d from public.duels where id = p_duel_id for update;

  if d is null then
    raise exception 'duel introuvable';
  end if;
  if d.status <> 'en-attente' then
    raise exception 'ce duel a déjà commencé';
  end if;
  if d.player_a = auth.uid() then
    raise exception 'tu ne peux pas rejoindre ton propre duel';
  end if;

  update public.duels
    set player_b = auth.uid(), status = 'en-cours', updated_at = now()
    where id = p_duel_id;
end;
$$;

create or replace function public.submit_duel_guess(p_duel_id uuid, p_guess text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  secret text[];
  next_attempt integer;
  feedback record;
  opponent_id uuid;
  opponent_done boolean;
  result_status text;
  result_winner uuid;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if coalesce(array_length(p_guess, 1), 0) <> 4 then
    raise exception 'la tentative doit contenir 4 pions';
  end if;
  if p_guess <@ array['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet']::text[] = false then
    raise exception 'couleur invalide';
  end if;

  select * into d from public.duels where id = p_duel_id for update;
  if d is null then
    raise exception 'duel introuvable';
  end if;
  if d.status <> 'en-cours' then
    raise exception 'ce duel n''est pas en cours';
  end if;
  if auth.uid() <> d.player_a and auth.uid() <> d.player_b then
    raise exception 'tu ne participes pas à ce duel';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_attempt
    from public.duel_guesses
    where duel_id = p_duel_id and player_id = auth.uid();

  if next_attempt > 10 then
    raise exception 'plus aucun essai disponible';
  end if;

  select array(select jsonb_array_elements_text(d.code)) into secret;
  select * into feedback from public._evaluate_guess(secret, p_guess);

  insert into public.duel_guesses (duel_id, player_id, attempt_number, guess, well_placed, misplaced)
    values (p_duel_id, auth.uid(), next_attempt, p_guess, feedback.well_placed, feedback.misplaced);

  insert into public.duel_progress_events (duel_id, player_id, attempt_number, solved)
    values (p_duel_id, auth.uid(), next_attempt, feedback.well_placed = 4);

  result_status := d.status;
  result_winner := d.winner;

  if feedback.well_placed = 4 then
    update public.duels set status = 'terminee', winner = auth.uid(), updated_at = now()
      where id = p_duel_id and status = 'en-cours';
    result_status := 'terminee';
    result_winner := auth.uid();
  elsif next_attempt = 10 then
    opponent_id := case when auth.uid() = d.player_a then d.player_b else d.player_a end;
    select coalesce(max(attempt_number), 0) >= 10 into opponent_done
      from public.duel_guesses
      where duel_id = p_duel_id and player_id = opponent_id;

    if opponent_id is null or opponent_done then
      update public.duels set status = 'terminee', updated_at = now()
        where id = p_duel_id and status = 'en-cours';
      result_status := 'terminee';
    end if;
  end if;

  return jsonb_build_object(
    'wellPlaced', feedback.well_placed,
    'misplaced', feedback.misplaced,
    'attemptNumber', next_attempt,
    'duelStatus', result_status,
    'winner', result_winner
  );
end;
$$;

grant execute on function public.create_duel() to authenticated;
grant execute on function public.join_duel(uuid) to authenticated;
grant execute on function public.submit_duel_guess(uuid, text[]) to authenticated;

-- Realtime : uniquement la progression (jamais les couleurs). La table
-- "duels" contient la colonne "code" (le secret) : même avec le GRANT/REVOKE
-- colonne par colonne ci-dessus, la réplication logique utilisée par le
-- realtime Postgres diffuse la ligne complète et contournerait cette
-- restriction. On ne l'ajoute donc jamais à la publication ; le client
-- détecte la fin du duel via duel_progress_events puis re-vérifie le statut
-- par un SELECT REST classique (qui, lui, respecte les colonnes autorisées).
alter publication supabase_realtime add table public.duel_progress_events;
