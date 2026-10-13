-- ULTRA PLAY · esquema do banco (Supabase / Postgres 15+)
-- Rodar no SQL Editor do Supabase, numa base vazia. Cria tabelas, índices, gatilhos e as regras por linha (RLS).
-- Espelha o que o protótipo faz no aparelho (social.js, app.js): ver docs/SOCIAL.md e supabase/README.md.
-- Convenções: ids de partida vêm do aparelho (texto), para a fila offline subir sem duplicar; o resto é uuid.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ============================================================
-- utilidades
-- ============================================================
-- código curto sem 0/O/1/I (UP-XXXXXX, P-XXXXXX, G-XXXXXX)
create or replace function public.short_code(n int) returns text
language sql volatile as $$
  select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n)
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ============================================================
-- pessoas
-- ============================================================
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  public_id      text not null unique default ('UP-' || public.short_code(6)),
  handle         citext unique check (handle ~ '^[a-z0-9_.]{3,24}$'),
  name           text not null check (char_length(name) between 1 and 60),
  city           text check (char_length(city) <= 60),
  bio            text check (char_length(bio) <= 160),
  avatar_url     text,
  sports         text[] not null default '{}',
  privacy_level  text not null default 'aberto' check (privacy_level in ('aberto', 'personalizado', 'privado')),
  privacy_show   jsonb not null default '{"partidas":true,"estatisticas":true,"conquistas":true,"recordes":true,"confrontos":true,"atividade":true,"geral":true}',
  birth_date     date,                       -- política de menores: ver docs/legal (decisão pendente)
  guardian_consent_at timestamptz,           -- consentimento do responsável, quando exigido
  pro_until      timestamptz,                -- preenchido pelo webhook de pagamento (service role)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- perfil criado junto com a conta (nome vem do login ou fica "Jogador")
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), 'Jogador'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  followee_id  uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'ativo' check (status in ('ativo', 'pendente')),
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id, status);

create table public.blocks (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);

-- ============================================================
-- lugares (arenas, clubes, quadras) e temporadas da arena
-- ============================================================
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  city        text,
  lat         double precision,
  lng         double precision,
  verified    boolean not null default false,   -- arena parceira, confirmada pela equipe
  manager_id  uuid references public.profiles(id) on delete set null,  -- conta da arena (edita e reseta rankings)
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table public.courts (
  id        uuid primary key default gen_random_uuid(),
  place_id  uuid not null references public.places(id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 40)   -- "Quadra 1"
);
-- reset dos rankings da arena sem apagar partida de ninguém: o ranking conta a partir do início da temporada
create table public.arena_seasons (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id) on delete cascade,
  name       text not null,
  starts_at  timestamptz not null default now()
);

-- ============================================================
-- grupos (turmas, clubes, times)
-- ============================================================
create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('G-' || public.short_code(6)),   -- convite: …/#grupo-G-XXXXXX
  name         text not null check (char_length(name) between 2 and 40),
  sport        text not null,
  place_id     uuid references public.places(id) on delete set null,
  place_name   text check (char_length(place_name) <= 60),
  when_text    text check (char_length(when_text) <= 40),       -- "Segundas, 19h"
  color        text not null default '#AFFB48' check (color ~ '^#[0-9A-F]{6}$'),
  description  text check (char_length(description) <= 160),
  open         boolean not null default false,                  -- aberto: entra direto; fechado: pede e o organizador aprova
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create table public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'membro' check (role in ('admin', 'mod', 'membro')),
  status     text not null default 'ativo' check (status in ('ativo', 'pendente')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on public.group_members (user_id, status);

-- quem cria o grupo vira organizador
create or replace function public.group_creator_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, status) values (new.id, new.created_by, 'admin', 'ativo');
  return new;
end $$;
create trigger groups_creator after insert on public.groups for each row execute function public.group_creator_admin();

-- autorização temporária: o membro deixa organizador e moderadores lançarem partidas com ele (máximo 24 h)
create table public.group_delegations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  starts_at   timestamptz not null default now(),
  until       timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (until > starts_at and until <= starts_at + interval '24 hours')
);
create index group_delegations_lookup on public.group_delegations (group_id, user_id, until);

-- resenha: o mural do grupo
create table public.group_posts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 280),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index group_posts_group on public.group_posts (group_id, created_at desc);

-- ============================================================
-- partidas
-- ============================================================
create table public.matches (
  id           text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),   -- id gerado no aparelho
  code         text not null unique default ('P-' || public.short_code(6)),
  owner_id     uuid not null references public.profiles(id) on delete cascade,  -- quem marcou o placar
  group_id     uuid references public.groups(id) on delete set null,
  sport        text not null,
  source       text not null default 'live' check (source in ('live', 'manual')),
  cfg          jsonb not null default '{}',
  played_at    timestamptz not null,
  duration_ms  integer check (duration_ms between 0 and 86400000),
  type         text not null default 'amistoso' check (type in ('amistoso', 'treino', 'resenha', 'campeonato', 'aula', 'desafio')),
  title        text check (char_length(title) <= 60),
  caption      text check (char_length(caption) <= 140),
  visibility   text not null default 'todos' check (visibility in ('todos', 'seguidores', 'so-eu')),
  status       text not null default 'publicada' check (status in ('rascunho', 'publicada')),
  place_id     uuid references public.places(id) on delete set null,
  court_id     uuid references public.courts(id) on delete set null,
  place_name   text check (char_length(place_name) <= 60),
  city         text,
  result       jsonb,     -- { sets: [[a,b]...] | null, final: [a,b] | null, winner: 0|1|null }
  summary      jsonb,     -- { pts:[a,b], aces:[a,b], timeline:[...] } (só ao vivo)
  replay       jsonb,     -- visual do replay animado publicado no post
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index matches_owner on public.matches (owner_id, played_at desc);
create index matches_group on public.matches (group_id, played_at desc) where group_id is not null;
create index matches_place on public.matches (place_id, played_at desc) where place_id is not null;
create index matches_feed on public.matches (played_at desc) where status = 'publicada' and deleted_at is null;
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();

create table public.match_events (
  match_id  text not null references public.matches(id) on delete cascade,
  seq       integer not null,
  event     jsonb not null,     -- o lance como o app guarda (sem o texto falado)
  primary key (match_id, seq)
);

create table public.match_players (
  match_id       text not null references public.matches(id) on delete cascade,
  team           smallint not null check (team in (0, 1)),
  slot           smallint not null check (slot between 0 and 5),
  user_id        uuid references public.profiles(id) on delete set null,
  guest_name     text check (char_length(guest_name) <= 40),
  tag_status     text check (tag_status in ('pendente', 'aceito', 'recusado')),
  auto_accepted  boolean not null default false,   -- aceito pela autorização ao organizador do grupo
  responded_at   timestamptz,
  primary key (match_id, team, slot),
  check (user_id is not null or guest_name is not null)
);
create index match_players_user on public.match_players (user_id, tag_status) where user_id is not null;

create table public.match_claims (
  id            uuid primary key default gen_random_uuid(),
  match_id      text not null references public.matches(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  guest_name    text not null,
  status        text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);
create unique index match_claims_one_accepted on public.match_claims (match_id, guest_name) where status = 'aceito';

create table public.zaps (
  match_id    text not null references public.matches(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,   -- quem recebe
  kind        text not null check (kind in ('tag', 'tag_auto', 'zap', 'accepted', 'follow', 'follow_request', 'claim', 'claim_ok', 'group_request', 'group_joined', 'group_role')),
  actor_id    uuid references public.profiles(id) on delete cascade,
  match_id    text references public.matches(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete cascade,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- vídeo na nuvem (Pro): trechos de ~5 min, com início e fim no relógio, como no aparelho (video.js)
create table public.video_segments (
  id            uuid primary key default gen_random_uuid(),
  match_id      text not null references public.matches(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  device        text not null default 'placar' check (device in ('placar', 'camera')),
  storage_path  text not null,          -- bucket "videos": <owner_id>/<match_id>/<início>.webm|mp4
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  bytes         bigint not null check (bytes >= 0),
  mime          text not null,
  created_at    timestamptz not null default now(),
  check (end_at > start_at)
);
create index video_segments_match on public.video_segments (match_id, start_at);

-- assinatura (escrita só pelo servidor de pagamento, com a service role)
create table public.subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  plan                text not null check (plan in ('pro_mensal', 'pro_anual', 'fundador', 'professor', 'arena')),
  status              text not null check (status in ('trial', 'ativa', 'cancelada', 'atrasada', 'encerrada')),
  provider            text not null check (provider in ('web', 'apple', 'google', 'cortesia')),
  provider_ref        text,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  target_user_id   uuid references public.profiles(id) on delete cascade,
  target_match_id  text references public.matches(id) on delete cascade,
  target_group_id  uuid references public.groups(id) on delete cascade,
  target_post_id   uuid references public.group_posts(id) on delete cascade,
  reason           text not null check (char_length(reason) between 2 and 500),
  status           text not null default 'aberta' check (status in ('aberta', 'em_analise', 'resolvida', 'descartada')),
  created_at       timestamptz not null default now(),
  handled_at       timestamptz
);

-- ============================================================
-- funções das regras (security definer: leem sem esbarrar nas próprias regras)
-- ============================================================
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a))
$$;

create or replace function public.follows_active(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from follows where follower_id = follower and followee_id = followee and status = 'ativo')
$$;

create or replace function public.group_role(gid uuid, uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from group_members where group_id = gid and user_id = uid and status = 'ativo'
$$;

create or replace function public.is_group_member(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.group_role(gid, uid) is not null $$;

create or replace function public.is_group_manager(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.group_role(gid, uid) in ('admin', 'mod'), false) $$;

-- o membro autorizou quem organiza/modera o grupo a lançar partidas por ele no instante t
create or replace function public.delegation_active(gid uuid, member uuid, t timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_delegations
                 where group_id = gid and user_id = member and revoked_at is null and t between starts_at and until)
$$;

-- quem pode ver a partida (visibilidade da partida + privacidade do perfil + bloqueios + grupo + marcados)
create or replace function public.can_see_match(mid text, viewer uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m matches; p profiles; follower boolean; player boolean;
begin
  select * into m from matches where id = mid;
  if not found or m.deleted_at is not null then return false; end if;
  if viewer is not null and m.owner_id = viewer then return true; end if;
  if m.status <> 'publicada' or m.visibility = 'so-eu' then return false; end if;
  if viewer is not null and is_blocked_between(m.owner_id, viewer) then return false; end if;
  player := viewer is not null and exists (select 1 from match_players where match_id = mid and user_id = viewer and tag_status = 'aceito');
  if player then return true; end if;
  if m.group_id is not null and viewer is not null and is_group_member(m.group_id, viewer) then return true; end if;
  follower := viewer is not null and follows_active(viewer, m.owner_id);
  if m.visibility = 'seguidores' then return follower; end if;
  select * into p from profiles where id = m.owner_id;
  if p.privacy_level = 'privado' then return follower; end if;
  if p.privacy_level = 'personalizado' and coalesce((p.privacy_show->>'partidas')::boolean, true) = false then return follower; end if;
  return true;
end $$;

create or replace function public.can_see_group(gid uuid, viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g where g.id = gid and g.deleted_at is null and (g.open or public.is_group_member(gid, viewer)))
$$;

-- ============================================================
-- gatilhos de regra de negócio
-- ============================================================
-- seguir perfil privado vira pedido
create or replace function public.follow_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_blocked_between(new.follower_id, new.followee_id) then raise exception 'bloqueado'; end if;
  if tg_op = 'INSERT' then
    new.status := case when (select privacy_level from profiles where id = new.followee_id) = 'privado' then 'pendente' else 'ativo' end;
    insert into notifications (user_id, kind, actor_id) values (new.followee_id, case when new.status = 'pendente' then 'follow_request' else 'follow' end, new.follower_id);
  end if;
  return new;
end $$;
create trigger follows_status before insert on public.follows for each row execute function public.follow_status();

-- bloquear desfaz o seguir nos dois sentidos
create or replace function public.block_unfollow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from follows where (follower_id = new.user_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.user_id);
  return new;
end $$;
create trigger blocks_unfollow after insert on public.blocks for each row execute function public.block_unfollow();

-- marcar alguém: notifica; se ele autorizou quem marcou (organizador/moderador do grupo), já entra aceito
create or replace function public.match_player_tag() returns trigger
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  if new.user_id is null then return new; end if;
  select * into m from matches where id = new.match_id;
  if new.user_id = m.owner_id then new.tag_status := 'aceito'; return new; end if;
  if is_blocked_between(m.owner_id, new.user_id) then raise exception 'bloqueado'; end if;
  if m.group_id is not null and is_group_manager(m.group_id, m.owner_id) and is_group_member(m.group_id, new.user_id)
     and delegation_active(m.group_id, new.user_id, m.played_at) then
    new.tag_status := 'aceito'; new.auto_accepted := true; new.responded_at := now();
    insert into notifications (user_id, kind, actor_id, match_id, group_id) values (new.user_id, 'tag_auto', m.owner_id, m.id, m.group_id);
  else
    new.tag_status := 'pendente'; new.auto_accepted := false;
    insert into notifications (user_id, kind, actor_id, match_id) values (new.user_id, 'tag', m.owner_id, m.id);
  end if;
  return new;
end $$;
create trigger match_players_tag before insert on public.match_players for each row execute function public.match_player_tag();

-- zap: notifica o dono (não dá zap na própria partida)
create or replace function public.zap_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from matches where id = new.match_id;
  if owner = new.user_id then raise exception 'zap na própria partida'; end if;
  insert into notifications (user_id, kind, actor_id, match_id) values (owner, 'zap', new.user_id, new.match_id);
  return new;
end $$;
create trigger zaps_notify after insert on public.zaps for each row execute function public.zap_notify();

-- entrar no grupo: aberto entra; fechado vira pedido (avisa quem organiza)
create or replace function public.group_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare g groups; adder uuid := auth.uid();
begin
  select * into g from groups where id = new.group_id;
  if adder is distinct from new.user_id and coalesce(public.group_role(new.group_id, adder), '') <> 'admin' then
    new.role := 'membro';   -- moderador adiciona membro; só o organizador escolhe papel
  end if;
  if adder = new.user_id and coalesce(current_setting('ultraplay.invite', true), '') <> '1'
     and not exists (select 1 from groups where id = new.group_id and created_by = adder) then
    new.role := 'membro';
    new.status := case when g.open then 'ativo' else 'pendente' end;
    if new.status = 'pendente' then
      insert into notifications (user_id, kind, actor_id, group_id) select user_id, 'group_request', new.user_id, new.group_id from group_members where group_id = new.group_id and role in ('admin', 'mod') and status = 'ativo';
    end if;
  end if;
  return new;
end $$;
create trigger group_members_join before insert on public.group_members for each row execute function public.group_join();

-- ============================================================
-- regras por linha (RLS)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.places enable row level security;
alter table public.courts enable row level security;
alter table public.arena_seasons enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_delegations enable row level security;
alter table public.group_posts enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.match_players enable row level security;
alter table public.match_claims enable row level security;
alter table public.zaps enable row level security;
alter table public.notifications enable row level security;
alter table public.video_segments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reports enable row level security;

-- perfis: nome, cidade e foto são públicos (quem bloqueou não vê); cada um edita o seu
create policy profiles_read on public.profiles for select using (deleted_at is null and (auth.uid() is null or not public.is_blocked_between(id, auth.uid())));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- seguir
create policy follows_read on public.follows for select using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert on public.follows for insert with check (follower_id = auth.uid());
create policy follows_approve on public.follows for update using (followee_id = auth.uid()) with check (followee_id = auth.uid());
create policy follows_delete on public.follows for delete using (follower_id = auth.uid() or followee_id = auth.uid());

-- bloqueios: só o próprio
create policy blocks_own on public.blocks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- lugares: todos leem; quem está logado cadastra; a arena (manager) edita
create policy places_read on public.places for select using (true);
create policy places_insert on public.places for insert with check (created_by = auth.uid() and verified = false and manager_id is null);
create policy places_update on public.places for update using (manager_id = auth.uid());
create policy courts_read on public.courts for select using (true);
create policy courts_write on public.courts for all using (exists (select 1 from places p where p.id = place_id and p.manager_id = auth.uid())) with check (exists (select 1 from places p where p.id = place_id and p.manager_id = auth.uid()));
create policy seasons_read on public.arena_seasons for select using (true);
create policy seasons_write on public.arena_seasons for all using (exists (select 1 from places p where p.id = place_id and p.manager_id = auth.uid())) with check (exists (select 1 from places p where p.id = place_id and p.manager_id = auth.uid()));

-- grupos
create policy groups_read on public.groups for select using (deleted_at is null and (open or public.is_group_member(id, auth.uid()) or created_by = auth.uid()));
create policy groups_insert on public.groups for insert with check (created_by = auth.uid());
create policy groups_update on public.groups for update using (public.group_role(id, auth.uid()) = 'admin');
-- grupo fechado: quem tem o código do convite acha o grupo por esta função (sem listar os fechados)
create or replace function public.group_by_code(c text) returns setof public.groups
language sql stable security definer set search_path = public as $$ select * from groups where code = upper(c) and deleted_at is null $$;

-- convite: quem abre o link entra direto, mesmo em grupo fechado
create or replace function public.join_group_by_code(c text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'precisa entrar na conta'; end if;
  select id into gid from groups where code = upper(c) and deleted_at is null;
  if gid is null then raise exception 'convite inválido'; end if;
  perform set_config('ultraplay.invite', '1', true);
  insert into group_members (group_id, user_id, role, status) values (gid, auth.uid(), 'membro', 'ativo')
    on conflict (group_id, user_id) do update set status = 'ativo';
  return gid;
end $$;

create policy members_read on public.group_members for select using (public.can_see_group(group_id, auth.uid()) or user_id = auth.uid());
create policy members_join on public.group_members for insert with check (user_id = auth.uid() or public.is_group_manager(group_id, auth.uid()));
create policy members_manage on public.group_members for update using (public.group_role(group_id, auth.uid()) = 'admin' or (public.is_group_manager(group_id, auth.uid()) and role = 'membro'));
create policy members_leave on public.group_members for delete using (user_id = auth.uid() or public.group_role(group_id, auth.uid()) = 'admin');

-- autorização: cada um cria e cancela a sua; quem organiza vê quem autorizou
create policy deleg_read on public.group_delegations for select using (user_id = auth.uid() or public.is_group_manager(group_id, auth.uid()));
create policy deleg_insert on public.group_delegations for insert with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()) and starts_at <= now() + interval '1 minute');
create policy deleg_revoke on public.group_delegations for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- resenha
create policy posts_read on public.group_posts for select using (deleted_at is null and public.is_group_member(group_id, auth.uid()) and not public.is_blocked_between(user_id, auth.uid()));
create policy posts_insert on public.group_posts for insert with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy posts_delete on public.group_posts for update using (user_id = auth.uid() or public.is_group_manager(group_id, auth.uid()));

-- partidas
create policy matches_read on public.matches for select using (public.can_see_match(id, auth.uid()));
create policy matches_insert on public.matches for insert with check (owner_id = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));
create policy matches_update on public.matches for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy matches_delete on public.matches for delete using (owner_id = auth.uid());

create policy events_read on public.match_events for select using (public.can_see_match(match_id, auth.uid()));
create policy events_write on public.match_events for all using (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid())) with check (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()));

create policy players_read on public.match_players for select using (public.can_see_match(match_id, auth.uid()) or user_id = auth.uid());
create policy players_owner on public.match_players for insert with check (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()));
create policy players_owner_del on public.match_players for delete using (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()) or user_id = auth.uid());
-- o marcado responde (aceitar/recusar) só na própria linha
create policy players_respond on public.match_players for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy claims_read on public.match_claims for select using (user_id = auth.uid() or exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()));
create policy claims_insert on public.match_claims for insert with check (user_id = auth.uid() and status = 'pendente');
create policy claims_answer on public.match_claims for update using (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()));

create policy zaps_read on public.zaps for select using (public.can_see_match(match_id, auth.uid()));
create policy zaps_insert on public.zaps for insert with check (user_id = auth.uid() and public.can_see_match(match_id, auth.uid()));
create policy zaps_delete on public.zaps for delete using (user_id = auth.uid());

-- notificações: gravadas pelos gatilhos; cada um lê e marca as suas
create policy notif_read on public.notifications for select using (user_id = auth.uid());
create policy notif_mark on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vídeos: só o dono (os jogadores veem pelo link assinado que o app gera)
create policy videos_own on public.video_segments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- assinatura: cada um lê a sua; escrita só pela service role (webhook do pagamento)
create policy subs_read on public.subscriptions for select using (user_id = auth.uid());

-- denúncias: cada um cria e vê as suas; a equipe lê pelo painel com a service role
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select using (reporter_id = auth.uid());

-- ============================================================
-- leituras prontas para as telas
-- ============================================================
-- contadores do perfil (seguidores, seguindo, partidas visíveis)
create or replace function public.profile_counts(uid uuid) returns table (followers bigint, following bigint, matches bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from follows where followee_id = uid and status = 'ativo'),
         (select count(*) from follows where follower_id = uid and status = 'ativo'),
         (select count(*) from matches m where m.owner_id = uid and public.can_see_match(m.id, auth.uid()))
$$;

-- ranking do grupo no período (só membros; convidados não entram), como groupRank() no app
create or replace function public.group_ranking(gid uuid, since timestamptz default null)
returns table (user_id uuid, played bigint, wins bigint)
language sql stable security definer set search_path = public as $$
  select mp.user_id, count(*) as played,
         count(*) filter (where (m.result->>'winner')::int = mp.team) as wins
  from matches m
  join match_players mp on mp.match_id = m.id and mp.tag_status = 'aceito'
  join group_members gm on gm.group_id = m.group_id and gm.user_id = mp.user_id and gm.status = 'ativo'
  where m.group_id = gid and m.deleted_at is null and m.status = 'publicada'
    and m.result ? 'winner' and m.result->>'winner' is not null
    and (since is null or m.played_at >= since)
    and public.is_group_member(gid, auth.uid())
  group by mp.user_id
  order by wins desc, played desc
$$;

-- ============================================================
-- permissões por coluna (o Supabase dá acesso amplo às tabelas; as regras por linha dizem QUAIS linhas,
-- e estes grants dizem QUAIS COLUNAS cada um pode mudar)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
-- perfil: a pessoa não mexe no Pro, no ID público nem no consentimento do responsável
revoke update on public.profiles from authenticated;
grant update (handle, name, city, bio, avatar_url, sports, privacy_level, privacy_show, birth_date, deleted_at) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;
-- marcado só responde (aceitar/recusar); dono troca jogador apagando e inserindo de novo
revoke update on public.match_players from authenticated;
grant update (tag_status, responded_at) on public.match_players to authenticated;
-- partida: dono não troca id, código nem dono
revoke update on public.matches from authenticated;
grant update (group_id, sport, source, cfg, played_at, duration_ms, type, title, caption, visibility, status, place_id, court_id, place_name, city, result, summary, replay, deleted_at) on public.matches to authenticated;
-- notificações e assinatura: só o servidor escreve (cada um só marca como lida)
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
-- denúncias: ninguém edita depois de enviar
revoke update, delete on public.reports from authenticated;
-- grupo: código do convite não muda
revoke update on public.groups from authenticated;
grant update (name, sport, place_id, place_name, when_text, color, description, open, deleted_at) on public.groups to authenticated;
-- membro: organizador muda papel e status
revoke update on public.group_members from authenticated;
grant update (role, status) on public.group_members to authenticated;
-- autorização: só dá para cancelar (revoked_at)
revoke update on public.group_delegations from authenticated;
grant update (revoked_at) on public.group_delegations to authenticated;
-- lugares: arena verificada só pela equipe
revoke update on public.places from authenticated;
grant update (name, city, lat, lng) on public.places to authenticated;
