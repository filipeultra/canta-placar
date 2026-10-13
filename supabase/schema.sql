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

-- 32^6 ≈ 1 bilhão de códigos: com ~50 mil partidas já é provável sortear um repetido (aniversário). O gatilho
-- abaixo sorteia de novo quando o código já existe, e passa a usar 7 letras se repetir várias vezes seguidas.
create or replace function public.unique_code() returns trigger
language plpgsql as $$
declare col text := tg_argv[0]; pre text := tg_argv[1]; tries int := 0; cur text; taken boolean;
begin
  cur := to_jsonb(new) ->> col;
  loop
    execute format('select exists (select 1 from %I.%I where %I = $1)', tg_table_schema, tg_table_name, col) into taken using cur;
    exit when not taken;
    tries := tries + 1;
    cur := pre || public.short_code(case when tries > 4 then 7 else 6 end);
  end loop;
  new := jsonb_populate_record(new, jsonb_build_object(col, cur));
  return new;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ============================================================
-- pessoas
-- ============================================================
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  public_id      text not null unique default ('UP-' || public.short_code(6)),
  handle         citext unique check (handle ~ '^[a-z0-9_.]{3,24}$'),
  name           text not null check (char_length(name) between 1 and 60),   -- "nome nos pontos" (nome e sobrenome curtos, usado no placar e na voz)
  full_name      text check (char_length(full_name) <= 60),
  city           text check (char_length(city) <= 60),
  bio            text check (char_length(bio) <= 160),
  avatar_url     text,
  sports         text[] not null default '{}',
  privacy_level  text not null default 'aberto' check (privacy_level in ('aberto', 'personalizado', 'privado')),
  privacy_show   jsonb not null default '{"partidas":true,"estatisticas":true,"conquistas":true,"recordes":true,"confrontos":true,"atividade":true,"geral":true}',
  birth_date     date,                       -- política de menores: ver docs/legal (decisão pendente)
  guardian_consent_at timestamptz,           -- consentimento do responsável, quando exigido
  pro_until      timestamptz,                -- cortesia dada pela equipe (admin_grant_pro); assinatura fica em subscriptions
  trial_used_at  timestamptz,                -- teste grátis de 14 dias já usado (só o servidor escreve)
  show_online    boolean not null default true,   -- "Mostrar quando estou jogando" (jogando agora)
  live_view      boolean not null default true,   -- "Deixar amigos verem o placar ao vivo"
  tag_policy     text not null default 'todos' check (tag_policy in ('todos', 'conexoes', 'sigo')),  -- quem pode me marcar numa partida (membros do mesmo grupo sempre podem, na partida do grupo)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger profiles_code before insert on public.profiles for each row execute function public.unique_code('public_id', 'UP-');


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
  avatar_url   text check (char_length(avatar_url) <= 300),     -- foto do grupo (bucket avatars, pasta do organizador)
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create trigger groups_code before insert on public.groups for each row execute function public.unique_code('code', 'G-');
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
-- (group_delegations saiu em 13/10/2026: estar no grupo já deixa os organizadores e membros marcarem você nas partidas
--  do grupo; a marcação continua indo para "aceitar" nas notificações, como qualquer outra)

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
  owner_id     uuid references public.profiles(id) on delete set null,  -- quem marcou o placar (pode não jogar: organizador do grupo); null = conta apagada
  owner_left_at timestamptz,   -- o dono usou "Excluir para mim": some do perfil dele e não edita mais
  corrected_at timestamptz,    -- placar corrigido depois, com o aceite de todos (match_corrections)
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
create trigger matches_code before insert on public.matches for each row execute function public.unique_code('code', 'P-');


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
  nickname       text check (char_length(nickname) between 1 and 24),   -- apelido só nesta partida (dois jogadores com o mesmo nome)
  tag_status     text check (tag_status in ('pendente', 'aceito', 'recusado')),
  display_name   text check (char_length(display_name) <= 60),   -- nome na hora da marcação (fica na partida se a conta for apagada)
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  left_at        timestamptz,   -- "Excluir para mim": sai das estatísticas da pessoa e dos confrontos/parcerias dos outros com ela
  primary key (match_id, team, slot),
  check (user_id is not null or guest_name is not null)
);
create index match_players_user on public.match_players (user_id, tag_status) where user_id is not null;
create index match_players_recent on public.match_players (created_at) where user_id is not null;

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
  kind        text not null check (kind in ('tag', 'zap', 'accepted', 'follow', 'follow_request', 'claim', 'claim_ok', 'group_request', 'group_joined', 'group_role', 'delete_request', 'delete_done', 'delete_refused', 'delete_expired', 'fix_request', 'fix_done', 'fix_refused', 'fix_expired')),
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
  plan                text not null check (plan in ('pro_mensal', 'pro_semestral', 'pro_anual', 'amigos_semestral', 'amigos_anual', 'fundador', 'professor', 'arena')),
  status              text not null check (status in ('trial', 'ativa', 'cancelada', 'atrasada', 'encerrada')),
  provider            text not null check (provider in ('web', 'apple', 'google', 'cortesia')),
  provider_ref        text,
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,   -- cancelou a renovação: o Pro vale até current_period_end
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- uso da análise por IA (cota mensal e custo): escrito só pela Edge Function "analise" (service role)
create table public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  match_id       text,
  model          text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  created_at     timestamptz not null default now()
);
create index ai_usage_user_month on public.ai_usage (user_id, created_at);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  target_user_id   uuid references public.profiles(id) on delete cascade,
  target_match_id  text references public.matches(id) on delete cascade,
  target_group_id  uuid references public.groups(id) on delete cascade,
  target_post_id   uuid references public.group_posts(id) on delete cascade,
  category         text not null default 'outro' check (category in ('ofensivo', 'partida_falsa', 'flood_convites', 'se_passando', 'assedio', 'spam', 'menor', 'outro')),
  reason           text not null check (char_length(reason) between 2 and 500),   -- detalhes que a pessoa escreveu (ou o nome do motivo)
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

-- outra pessoa (com conta) confirmou a partida e não saiu dela
create or replace function public.match_has_others(mid text, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from match_players where match_id = mid and user_id is not null and user_id is distinct from uid
                 and tag_status = 'aceito' and left_at is null)
$$;

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
declare m matches; pol text; allowed boolean;
begin
  if new.user_id is null then return new; end if;
  select * into m from matches where id = new.match_id;
  select coalesce(new.display_name, name), tag_policy into new.display_name, pol from profiles where id = new.user_id;
  new.created_at := now(); new.left_at := null;
  if new.user_id = m.owner_id then new.tag_status := 'aceito'; new.responded_at := now(); return new; end if;
  if is_blocked_between(m.owner_id, new.user_id) then raise exception 'bloqueado' using errcode = '42501'; end if;
  -- quem pode marcar: na partida do grupo, qualquer membro marca outro membro; fora dela vale o ajuste da pessoa
  allowed := (m.group_id is not null and is_group_member(m.group_id, m.owner_id) and is_group_member(m.group_id, new.user_id))
          or pol = 'todos'
          or (pol = 'sigo' and follows_active(new.user_id, m.owner_id))
          or (pol = 'conexoes' and (follows_active(new.user_id, m.owner_id) or follows_active(m.owner_id, new.user_id)));
  if not allowed then raise exception 'convite_nao_permitido' using errcode = '42501'; end if;
  -- contra flood: no máximo 60 convites por dia por pessoa, e quem recusou 3 vezes em 30 dias para de receber desse dono
  --   (conta pelos avisos de marcação, que só este gatilho grava: um índice responde, mesmo com milhões de partidas)
  if (select count(*) from notifications where actor_id = m.owner_id and kind = 'tag' and created_at > now() - interval '24 hours') >= 60 then
    raise exception 'limite_de_convites' using errcode = '54000';
  end if;
  if (select count(*) from match_players mp join matches x on x.id = mp.match_id
      where x.owner_id = m.owner_id and mp.user_id = new.user_id and mp.tag_status = 'recusado' and mp.responded_at > now() - interval '30 days') >= 3 then
    raise exception 'convite_recusado_demais' using errcode = '42501';
  end if;
  new.tag_status := 'pendente'; new.responded_at := null;
  insert into notifications (user_id, kind, actor_id, match_id, group_id) values (new.user_id, 'tag', m.owner_id, m.id, m.group_id);
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
alter table public.ai_usage enable row level security;

-- perfis: nome, cidade e foto são públicos (quem bloqueou não vê); cada um edita o seu
-- o próprio perfil sempre (senão a pessoa não consegue marcar a conta para apagar, nem ver que ela está saindo)
create policy profiles_read on public.profiles for select using (id = auth.uid() or (deleted_at is null and (auth.uid() is null or not public.is_blocked_between(id, auth.uid()))));
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


-- resenha
create policy posts_read on public.group_posts for select using (deleted_at is null and public.is_group_member(group_id, auth.uid()) and not public.is_blocked_between(user_id, auth.uid()));
create policy posts_insert on public.group_posts for insert with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy posts_delete on public.group_posts for update using (user_id = auth.uid() or public.is_group_manager(group_id, auth.uid()));

-- partidas
-- o dono primeiro: no insert ... returning, a função ainda não enxerga a linha nova (e evita a chamada nas próprias partidas)
create policy matches_read on public.matches for select using (owner_id = auth.uid() or public.can_see_match(id, auth.uid()));
create policy matches_insert on public.matches for insert with check (owner_id = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));
create policy matches_update on public.matches for update using (owner_id = auth.uid() and owner_left_at is null) with check (owner_id = auth.uid());
-- apagar de vez: só sem ninguém mais confirmado (com outros, é leave_match ou o pedido de exclusão para todos)
create policy matches_delete on public.matches for delete using (owner_id = auth.uid() and not public.match_has_others(id, auth.uid()));

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

-- análise por IA: cada um vê o próprio uso (para mostrar "x de 60 no mês"); só o servidor grava
create policy ai_usage_read on public.ai_usage for select using (user_id = auth.uid());

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
-- jogando agora (presença e placar ao vivo) e análise do dia
-- ============================================================
-- Quem vê: só quem segue a pessoa (e sem bloqueio), e só se ela deixou "Mostrar quando estou jogando" (show_online).
-- O placar e os nomes saem pela função live_for_viewer, nunca direto das tabelas:
--   · a pessoa com live_view desligado: só "está jogando <esporte>", sem placar;
--   · outra pessoa da partida com live_view desligado: placar sim, mas os outros nomes viram "Jogador 2, 3…";
--   · todos permitem: placar e nomes. Vale a escolha mais fechada entre os jogadores.
create table public.live_matches (
  match_id       text primary key check (match_id ~ '^[A-Za-z0-9_-]{1,64}$'),   -- o mesmo id da partida no aparelho
  owner_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  sport          text not null check (char_length(sport) <= 20),
  place_name     text check (char_length(place_name) <= 60),
  started_at     timestamptz not null default now(),
  last_point_at  timestamptz not null default now(),
  score          jsonb not null default '{}',   -- { sets:[[a,b]...], games:[a,b], points:["15","30"], server:0|1 }
  guests         jsonb not null default '[]',   -- [{ team, slot, name }] de quem não tem conta
  check (jsonb_typeof(score) = 'object' and jsonb_typeof(guests) = 'array' and pg_column_size(score) < 4000 and pg_column_size(guests) < 2000)
);
create index live_matches_recent on public.live_matches (last_point_at desc);

create table public.live_players (
  match_id  text not null references public.live_matches(match_id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  team      smallint not null check (team in (0, 1)),
  slot      smallint not null check (slot between 0 and 5),
  primary key (match_id, user_id),
  unique (match_id, team, slot)
);
create index live_players_user on public.live_players (user_id);

alter table public.live_matches enable row level security;
alter table public.live_players enable row level security;
-- direto nas tabelas, só o dono da partida (ele publica o placar a cada ponto)
create policy live_owner_all on public.live_matches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy live_players_read on public.live_players for select using (user_id = auth.uid() or exists (select 1 from public.live_matches l where l.match_id = live_players.match_id and l.owner_id = auth.uid()));
create policy live_players_owner_ins on public.live_players for insert with check (exists (select 1 from public.live_matches l where l.match_id = live_players.match_id and l.owner_id = auth.uid()) and not public.is_blocked_between(user_id, auth.uid()));
create policy live_players_owner_del on public.live_players for delete using (exists (select 1 from public.live_matches l where l.match_id = live_players.match_id and l.owner_id = auth.uid()) or user_id = auth.uid());

-- o que quem está olhando (viewer) pode ver de alguém (target) que está jogando agora
create or replace function public.live_for_viewer(target uuid)
returns table (match_id text, sport text, place_name text, started_at timestamptz, last_point_at timestamptz, mode text, score jsonb, players jsonb)
language plpgsql stable security definer set search_path = public as $$
declare viewer uuid := auth.uid(); t profiles; l live_matches; any_closed boolean;
begin
  if viewer is null then return; end if;
  select * into t from profiles where id = target and deleted_at is null;
  if not found or not t.show_online then return; end if;
  if viewer <> target and (not public.follows_active(viewer, target) or public.is_blocked_between(viewer, target)) then return; end if;
  select lm.* into l from live_matches lm
   where (lm.owner_id = target or exists (select 1 from live_players lp where lp.match_id = lm.match_id and lp.user_id = target))
     and lm.last_point_at > now() - interval '30 minutes'
   order by lm.last_point_at desc limit 1;
  if not found then return; end if;
  match_id := l.match_id; sport := l.sport; place_name := l.place_name; started_at := l.started_at; last_point_at := l.last_point_at;
  if not t.live_view then
    mode := 'so-jogando'; score := null; players := null; return next; return;
  end if;
  -- a escolha mais fechada entre todos os jogadores com conta (o dono da partida também conta)
  select exists (select 1 from profiles p where (p.id = l.owner_id or p.id in (select lp.user_id from live_players lp where lp.match_id = l.match_id)) and not p.live_view)
    into any_closed;
  mode := case when any_closed then 'nomes' else 'aberto' end;
  score := l.score;
  select coalesce(jsonb_agg(x order by (x->>'team')::int, (x->>'slot')::int), '[]'::jsonb) into players from (
    select jsonb_build_object('team', lp.team, 'slot', lp.slot,
             'name', case when lp.user_id = target or not any_closed then p.name else null end,
             'user_id', case when lp.user_id = target or not any_closed then lp.user_id else null end) as x
      from live_players lp join profiles p on p.id = lp.user_id where lp.match_id = l.match_id
    union all
    select jsonb_build_object('team', (g->>'team')::int, 'slot', (g->>'slot')::int, 'name', case when any_closed then null else g->>'name' end, 'user_id', null)
      from jsonb_array_elements(l.guests) g
  ) s;
  return next;
end $$;

-- limpeza (agendar no Supabase a cada 15 min): partida sem ponto há mais de 30 min sai do "jogando agora"
create or replace function public.live_cleanup() returns integer
language sql volatile security definer set search_path = public as $$
  with d as (delete from live_matches where last_point_at < now() - interval '30 minutes' returning 1) select count(*)::int from d
$$;

-- análise do dia: uma por pessoa, por esporte e por dia, e só quando há partida nova desde a última
create table public.daily_analyses (
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  sport          text not null check (sport ~ '^[a-z]{2,20}$'),   -- 'geral' ou o esporte
  day            date not null default current_date,
  last_match_at  timestamptz not null,
  items          jsonb not null check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 8000),
  source         text not null default 'regras' check (source in ('regras', 'ia')),
  created_at     timestamptz not null default now(),
  primary key (user_id, sport, day)
);
alter table public.daily_analyses enable row level security;
create policy daily_read on public.daily_analyses for select using (user_id = auth.uid());
-- pelo app só entra a análise por regras; a da IA quem grava é a função do servidor (service role)
create policy daily_insert on public.daily_analyses for insert with check (user_id = auth.uid() and source = 'regras');
create policy daily_delete on public.daily_analyses for delete using (user_id = auth.uid());
create or replace function public.daily_only_new() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from daily_analyses d where d.user_id = new.user_id and d.sport = new.sport and d.last_match_at >= new.last_match_at) then
    raise exception 'sem partida nova desde a última análise' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger daily_only_new before insert on public.daily_analyses for each row execute function public.daily_only_new();

-- predefinições de formato (BT1-Amigos de Segunda): grátis 1 por esporte, Pro até 3
create table public.format_presets (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  sport       text not null check (sport in ('tenis', 'beach', 'padel', 'peteca', 'volei', 'futevolei')),
  n           smallint not null check (n between 1 and 3),
  name        text not null check (name ~ '^(TEN|BT|PAD|PET|VOL|FUT)[1-3]-.{1,18}$'),
  cfg         jsonb not null check (jsonb_typeof(cfg) = 'object' and pg_column_size(cfg) < 2000),
  created_at  timestamptz not null default now(),
  primary key (user_id, sport, n)
);
alter table public.format_presets enable row level security;
create policy presets_own on public.format_presets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- o prefixo tem que ser do esporte e do número certos, e o limite do plano vale no servidor
create or replace function public.presets_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare pre text := case new.sport when 'tenis' then 'TEN' when 'beach' then 'BT' when 'padel' then 'PAD' when 'peteca' then 'PET' when 'volei' then 'VOL' else 'FUT' end;
        lim int; used int;
begin
  if left(new.name, char_length(pre) + 2) <> pre || new.n || '-' then raise exception 'nome fora do padrão' using errcode = 'check_violation'; end if;
  lim := case when public.has_pro(new.user_id) then 3 else 1 end;
  select count(*) into used from format_presets f where f.user_id = new.user_id and f.sport = new.sport;
  if used >= coalesce(lim, 1) then raise exception 'limite de predefinições do plano' using errcode = 'check_violation'; end if;
  return new;
end $$;
create trigger presets_check before insert on public.format_presets for each row execute function public.presets_check();

-- ---------- assinatura: plano Amigos e pagamentos ----------
-- Pro Amigos (amigos_semestral, amigos_anual): quem paga + até 5 pessoas, cada uma com a própria conta.
-- O convite nasce "pendente" e só vira "ativo" quando a pessoa aceita; ninguém fica em dois planos Amigos ao mesmo tempo.
create table public.subscription_members (
  owner_id    uuid not null references public.subscriptions(user_id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pendente' check (status in ('pendente', 'ativo')),
  invited_at  timestamptz not null default now(),
  joined_at   timestamptz,
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);
create unique index sub_members_one_plan on public.subscription_members (member_id) where status = 'ativo';
create index sub_members_owner on public.subscription_members (owner_id);

-- recibos (escritos pelo webhook do pagamento; cada um lê os seus)
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan          text not null,
  amount        numeric(10, 2) not null check (amount >= 0),
  method        text not null check (method in ('pix', 'cartao', 'apple', 'google', 'cortesia')),
  status        text not null default 'pago' check (status in ('pendente', 'pago', 'estornado')),
  provider_ref  text,
  period_start  timestamptz,
  period_end    timestamptz,
  created_at    timestamptz not null default now()
);
create index payments_user on public.payments (user_id, created_at desc);

create or replace function public.sub_active(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from subscriptions where user_id = uid and status in ('trial', 'ativa', 'cancelada') and current_period_end > now())
$$;
-- tem Pro: assinatura própria, vaga ativa num Amigos ativo, ou cortesia da equipe
create or replace function public.has_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select pro_until > now() from profiles where id = uid), false)
      or public.sub_active(uid)
      or exists (select 1 from subscription_members m join subscriptions s on s.user_id = m.owner_id
                 where m.member_id = uid and m.status = 'ativo' and s.plan like 'amigos_%'
                   and s.status in ('ativa', 'cancelada') and s.current_period_end > now())
$$;

alter table public.subscription_members enable row level security;
alter table public.payments enable row level security;
create policy subm_read on public.subscription_members for select using (owner_id = auth.uid() or member_id = auth.uid());
create policy subm_invite on public.subscription_members for insert with check (owner_id = auth.uid());
create policy subm_accept on public.subscription_members for update using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy subm_leave on public.subscription_members for delete using (owner_id = auth.uid() or member_id = auth.uid());
create policy payments_read on public.payments for select using (user_id = auth.uid());

create or replace function public.subm_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare s subscriptions; used int;
begin
  if tg_op = 'INSERT' then
    select * into s from subscriptions where user_id = new.owner_id;
    if not found or s.plan not like 'amigos_%' or s.status not in ('ativa', 'cancelada') or s.current_period_end <= now() then
      raise exception 'só quem tem o Pro Amigos ativo convida' using errcode = 'check_violation';
    end if;
    select count(*) into used from subscription_members where owner_id = new.owner_id;
    if used >= 5 then raise exception 'o plano Amigos tem no máximo 5 convidados' using errcode = 'check_violation'; end if;
    if public.is_blocked_between(new.owner_id, new.member_id) then raise exception 'bloqueio entre as contas' using errcode = 'check_violation'; end if;
    new.status := 'pendente'; new.invited_at := now(); new.joined_at := null;   -- quem decide entrar é a pessoa convidada
  else
    -- pelo app (com usuário logado), só a pessoa convidada aceita; o servidor (sem usuário) pode ajustar
    if auth.uid() is not null and (auth.uid() <> old.member_id or new.status <> 'ativo' or old.status <> 'pendente') then
      raise exception 'só a pessoa convidada aceita o convite' using errcode = 'check_violation';
    end if;
    new.joined_at := now();
  end if;
  return new;
end $$;
create trigger subm_check before insert or update on public.subscription_members for each row execute function public.subm_check();

-- ============================================================
-- regras da partida entre várias pessoas (13/10/2026) · ver docs/REGRAS-PARTIDAS.md
-- ============================================================
-- 1) Placar travado: depois que outra pessoa confirmou, o dono não muda placar, lances, esporte nem data.
--    Corrigir um erro de verdade é pelo pedido de exclusão para todos (e lançar de novo).
create or replace function public.match_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.result, new.summary, new.cfg, new.sport, new.played_at, new.duration_ms, new.source)
     is distinct from (old.result, old.summary, old.cfg, old.sport, old.played_at, old.duration_ms, old.source)
     and public.match_has_others(old.id, old.owner_id) and coalesce(current_setting('ultraplay.fix', true), '') <> '1' then
    raise exception 'placar_travado' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger matches_lock before update on public.matches for each row execute function public.match_lock();

create or replace function public.events_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid text := coalesce(new.match_id, old.match_id); own uuid;
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;   -- apagando a partida inteira (cascata)
  select owner_id into own from matches where id = mid;
  if public.match_has_others(mid, own) then raise exception 'placar_travado' using errcode = '42501'; end if;
  return coalesce(new, old);
end $$;
create trigger events_lock before insert or update or delete on public.match_events for each row execute function public.events_lock();

-- 2) Quem confirmou não é tirado da partida por outra pessoa, e não "desconfirma": para sair, usa leave_match.
create or replace function public.players_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 and old.tag_status = 'aceito' and old.user_id is not null and old.user_id is distinct from auth.uid()
       and old.user_id is distinct from (select owner_id from matches where id = old.match_id) then
      raise exception 'jogador_confirmado' using errcode = '42501';
    end if;
    -- a própria pessoa não apaga a linha dela: recusa o convite ou usa "Excluir para mim" (assim o nome fica e as recusas contam)
    if pg_trigger_depth() = 1 and old.user_id is not null and old.user_id = auth.uid()
       and old.user_id is distinct from (select owner_id from matches where id = old.match_id) then
      raise exception 'use_sair_da_partida' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.tag_status = 'aceito' and new.tag_status is distinct from 'aceito' then raise exception 'ja_confirmada' using errcode = '42501'; end if;
  if old.tag_status is distinct from 'pendente' and new.tag_status = 'pendente' then raise exception 'ja_respondida' using errcode = '42501'; end if;
  if old.tag_status = 'recusado' and new.tag_status = 'aceito' and old.responded_at < now() - interval '30 days' then raise exception 'convite_expirado' using errcode = '42501'; end if;
  -- a hora da resposta é do servidor (o aparelho não escolhe, senão burlaria o prazo de 30 dias e a contagem de recusas)
  new.responded_at := case when new.tag_status is distinct from old.tag_status then now() else old.responded_at end;
  return new;
end $$;
create trigger players_guard before update or delete on public.match_players for each row execute function public.players_guard();

-- 3) "Excluir para mim": some do seu perfil e das suas estatísticas. Para quem também confirmou, a partida continua
--    nas estatísticas gerais deles e o seu nome continua na partida (você reconheceu que ela aconteceu); só sai dos
--    confrontos e parcerias com você. Se ninguém com conta sobrar, a partida some de vez.
create or replace function public.finish_match_if_empty(mid text) returns boolean
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  select * into m from matches where id = mid;
  if not found or m.deleted_at is not null then return true; end if;
  if (m.owner_id is null or m.owner_left_at is not null)
     and not exists (select 1 from match_players where match_id = mid and user_id is not null and tag_status = 'aceito' and left_at is null) then
    update matches set deleted_at = now() where id = mid;
    update match_delete_requests set status = 'aprovado', closed_at = now() where match_id = mid and status = 'aberto';
    return true;
  end if;
  return false;
end $$;

create or replace function public.leave_match(mid text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m matches; r record;
begin
  if uid is null then raise exception 'precisa entrar na conta'; end if;
  select * into m from matches where id = mid and deleted_at is null;
  if not found then raise exception 'partida não encontrada'; end if;
  if m.owner_id is distinct from uid and not exists (select 1 from match_players where match_id = mid and user_id = uid) then
    raise exception 'você não está nesta partida' using errcode = '42501';
  end if;
  update match_players set left_at = now() where match_id = mid and user_id = uid and left_at is null;
  update match_players set tag_status = 'recusado', responded_at = now() where match_id = mid and user_id = uid and tag_status = 'pendente';
  if m.owner_id = uid then update matches set owner_left_at = now() where id = mid; end if;
  -- se havia um pedido de exclusão aberto, quem saiu não precisa mais votar
  delete from match_delete_votes v using match_delete_requests q where v.request_id = q.id and q.match_id = mid and q.status = 'aberto' and v.user_id = uid and v.vote = 'pendente';
  for r in select id from match_delete_requests where match_id = mid and status = 'aberto' loop perform public.close_delete_request(r.id); end loop;
  delete from match_correction_votes v using match_corrections q where v.correction_id = q.id and q.match_id = mid and q.status = 'aberto' and v.user_id = uid and v.vote = 'pendente';
  for r in select id from match_corrections where match_id = mid and status = 'aberto' loop perform public.close_correction(r.id); end loop;
  if public.finish_match_if_empty(mid) then return 'apagada'; end if;
  return 'saiu';
end $$;

-- conta apagada (ou marcada para apagar): sai de todas as partidas, e o nome fica nas partidas que já tinha confirmado
create or replace function public.leave_all(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; nm text;
begin
  select name into nm from profiles where id = uid;
  update match_players set display_name = coalesce(display_name, nm), left_at = coalesce(left_at, now()) where user_id = uid;
  update match_players set tag_status = 'recusado', responded_at = now() where user_id = uid and tag_status = 'pendente';
  update matches set owner_left_at = coalesce(owner_left_at, now()) where owner_id = uid;
  delete from match_delete_votes where user_id = uid and vote = 'pendente';
  delete from match_correction_votes where user_id = uid and vote = 'pendente';
  for r in select distinct match_id from match_players where user_id = uid union select id from matches where owner_id = uid loop
    -- os pedidos abertos que só esperavam por ela se resolvem agora, sem esperar o prazo
    perform public.close_delete_request(q.id) from match_delete_requests q where q.match_id = r.match_id and q.status = 'aberto';
    perform public.close_correction(q.id) from match_corrections q where q.match_id = r.match_id and q.status = 'aberto';
    perform public.finish_match_if_empty(r.match_id);
  end loop;
end $$;
create or replace function public.profile_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.leave_all(old.id);
    -- a linha da pessoa vira convidado com o nome que tinha (a chave estrangeira apaga o vínculo com a conta)
    update match_players set guest_name = coalesce(guest_name, display_name, 'Jogador') where user_id = old.id;
    return old;
  end if;
  if new.deleted_at is not null and old.deleted_at is null then perform public.leave_all(new.id); end if;
  return new;
end $$;
create trigger profiles_gone before delete or update of deleted_at on public.profiles for each row execute function public.profile_gone();

-- 4) Pedir exclusão para todos: cada pessoa que confirmou (e o dono) vota; se todos aceitarem, a partida some de
--    todos os lugares. Um "não" encerra o pedido. Serve para partida com erro (placar errado, partida duplicada).
create table public.match_delete_requests (
  id            uuid primary key default gen_random_uuid(),
  match_id      text not null references public.matches(id) on delete cascade,
  requested_by  uuid references public.profiles(id) on delete set null,
  reason        text check (char_length(reason) <= 200),
  status        text not null default 'aberto' check (status in ('aberto', 'aprovado', 'recusado', 'cancelado', 'expirado')),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create unique index match_delete_one_open on public.match_delete_requests (match_id) where status = 'aberto';
create table public.match_delete_votes (
  request_id  uuid not null references public.match_delete_requests(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  vote        text not null default 'pendente' check (vote in ('pendente', 'sim', 'nao')),
  voted_at    timestamptz,
  primary key (request_id, user_id)
);
alter table public.match_delete_requests enable row level security;
alter table public.match_delete_votes enable row level security;
-- (as duas leituras olham a outra tabela por funções, para as regras não se chamarem em círculo)
create or replace function public.del_is_voter(req uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from match_delete_votes where request_id = req and user_id = uid) $$;
create or replace function public.del_is_requester(req uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from match_delete_requests where id = req and requested_by = uid) $$;
create policy delreq_read on public.match_delete_requests for select using (requested_by = auth.uid() or public.del_is_voter(id, auth.uid()));
create policy delvote_read on public.match_delete_votes for select using (user_id = auth.uid() or public.del_is_requester(request_id, auth.uid()));

create or replace function public.close_delete_request(req uuid) returns text
language plpgsql security definer set search_path = public as $$
declare q match_delete_requests; v record;
begin
  select * into q from match_delete_requests where id = req for update;   -- dois votos ao mesmo tempo: um espera o outro
  if not found then return null; end if;
  if q.status <> 'aberto' then return q.status; end if;
  -- ninguém respondeu em 14 dias: o pedido expira e a partida fica
  if q.created_at < now() - interval '14 days' and exists (select 1 from match_delete_votes where request_id = req and vote = 'pendente') then
    update match_delete_requests set status = 'expirado', closed_at = now() where id = req;
    if q.requested_by is not null then insert into notifications (user_id, kind, match_id) values (q.requested_by, 'delete_expired', q.match_id); end if;
    return 'expirado';
  end if;
  if exists (select 1 from match_delete_votes where request_id = req and vote = 'nao') then
    update match_delete_requests set status = 'recusado', closed_at = now() where id = req;
    if q.requested_by is not null then insert into notifications (user_id, kind, match_id) values (q.requested_by, 'delete_refused', q.match_id); end if;
    return 'recusado';
  end if;
  if exists (select 1 from match_delete_votes where request_id = req and vote = 'pendente') then return 'aberto'; end if;
  update matches set deleted_at = now() where id = q.match_id;
  update match_delete_requests set status = 'aprovado', closed_at = now() where id = req;
  for v in select user_id from match_delete_votes where request_id = req union select q.requested_by loop
    if v.user_id is not null then insert into notifications (user_id, kind, match_id) values (v.user_id, 'delete_done', q.match_id); end if;
  end loop;
  return 'aprovado';
end $$;

create or replace function public.request_match_deletion(mid text, why text default null) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m matches; req uuid; voter uuid;
begin
  if uid is null then raise exception 'precisa entrar na conta'; end if;
  select * into m from matches where id = mid and deleted_at is null;
  if not found then raise exception 'partida não encontrada'; end if;
  if not ((m.owner_id = uid and m.owner_left_at is null)
          or exists (select 1 from match_players where match_id = mid and user_id = uid and tag_status = 'aceito' and left_at is null)) then
    raise exception 'só quem está na partida pede a exclusão' using errcode = '42501';
  end if;
  if (select count(*) from match_delete_requests where requested_by = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'limite_de_pedidos' using errcode = '54000';
  end if;
  perform public.close_delete_request(id) from match_delete_requests where match_id = mid and status = 'aberto';   -- um antigo vencido não trava um novo
  if exists (select 1 from match_delete_requests where match_id = mid and status = 'aberto') then raise exception 'pedido_em_andamento' using errcode = '23505'; end if;
  insert into match_delete_requests (match_id, requested_by, reason) values (mid, uid, left(why, 200)) returning id into req;
  insert into match_delete_votes (request_id, user_id, vote, voted_at) values (req, uid, 'sim', now());
  for voter in
    select distinct user_id from match_players where match_id = mid and user_id is not null and user_id <> uid and tag_status = 'aceito' and left_at is null
    union select m.owner_id where m.owner_id is not null and m.owner_id <> uid and m.owner_left_at is null
  loop
    insert into match_delete_votes (request_id, user_id) values (req, voter) on conflict do nothing;
    insert into notifications (user_id, kind, actor_id, match_id) values (voter, 'delete_request', uid, mid);
  end loop;
  return public.close_delete_request(req);
end $$;

create or replace function public.vote_match_deletion(req uuid, approve boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  -- trava o pedido antes de votar: se dois votam juntos, o segundo enxerga o voto do primeiro e o pedido fecha
  perform 1 from match_delete_requests where id = req for update;
  if public.close_delete_request(req) = 'expirado' then return 'expirado'; end if;
  update match_delete_votes set vote = case when approve then 'sim' else 'nao' end, voted_at = now()
   where request_id = req and user_id = auth.uid() and vote = 'pendente';
  if not found then raise exception 'sem voto pendente' using errcode = '42501'; end if;
  return public.close_delete_request(req);
end $$;

-- 4b) Correção de placar: quem está na partida propõe o placar certo; cada pessoa que confirmou (e o dono) aceita.
--     Todos aceitaram: o placar muda mesmo travado e a partida ganha o selo "placar corrigido". Um "não" encerra;
--     ninguém respondeu em 14 dias: expira e o placar fica como estava.
create table public.match_corrections (
  id            uuid primary key default gen_random_uuid(),
  match_id      text not null references public.matches(id) on delete cascade,
  proposed_by   uuid references public.profiles(id) on delete set null,
  result        jsonb not null check (jsonb_typeof(result) = 'object' and (result ? 'winner')),
  reason        text check (char_length(reason) <= 200),
  status        text not null default 'aberto' check (status in ('aberto', 'aprovado', 'recusado', 'cancelado', 'expirado')),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create unique index match_fix_one_open on public.match_corrections (match_id) where status = 'aberto';
create table public.match_correction_votes (
  correction_id  uuid not null references public.match_corrections(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  vote           text not null default 'pendente' check (vote in ('pendente', 'sim', 'nao')),
  voted_at       timestamptz,
  primary key (correction_id, user_id)
);
alter table public.match_corrections enable row level security;
alter table public.match_correction_votes enable row level security;
create or replace function public.fix_is_voter(req uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from match_correction_votes where correction_id = req and user_id = uid) $$;
create or replace function public.fix_is_proposer(req uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from match_corrections where id = req and proposed_by = uid) $$;
create policy fix_read on public.match_corrections for select using (proposed_by = auth.uid() or public.fix_is_voter(id, auth.uid()));
create policy fixvote_read on public.match_correction_votes for select using (user_id = auth.uid() or public.fix_is_proposer(correction_id, auth.uid()));

create or replace function public.close_correction(req uuid) returns text
language plpgsql security definer set search_path = public as $$
declare q match_corrections; v record;
begin
  select * into q from match_corrections where id = req for update;
  if not found then return null; end if;
  if q.status <> 'aberto' then return q.status; end if;
  if q.created_at < now() - interval '14 days' and exists (select 1 from match_correction_votes where correction_id = req and vote = 'pendente') then
    update match_corrections set status = 'expirado', closed_at = now() where id = req;
    if q.proposed_by is not null then insert into notifications (user_id, kind, match_id) values (q.proposed_by, 'fix_expired', q.match_id); end if;
    return 'expirado';
  end if;
  if exists (select 1 from match_correction_votes where correction_id = req and vote = 'nao') then
    update match_corrections set status = 'recusado', closed_at = now() where id = req;
    if q.proposed_by is not null then insert into notifications (user_id, kind, match_id) values (q.proposed_by, 'fix_refused', q.match_id); end if;
    return 'recusado';
  end if;
  if exists (select 1 from match_correction_votes where correction_id = req and vote = 'pendente') then return 'aberto'; end if;
  perform set_config('ultraplay.fix', '1', true);
  update matches set result = q.result, corrected_at = now() where id = q.match_id;
  perform set_config('ultraplay.fix', '', true);
  update match_corrections set status = 'aprovado', closed_at = now() where id = req;
  for v in select user_id from match_correction_votes where correction_id = req loop
    insert into notifications (user_id, kind, match_id) values (v.user_id, 'fix_done', q.match_id);
  end loop;
  return 'aprovado';
end $$;

create or replace function public.request_score_correction(mid text, new_result jsonb, why text default null) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m matches; req uuid; voter uuid;
begin
  if uid is null then raise exception 'precisa entrar na conta'; end if;
  select * into m from matches where id = mid and deleted_at is null;
  if not found then raise exception 'partida não encontrada'; end if;
  if not ((m.owner_id = uid and m.owner_left_at is null)
          or exists (select 1 from match_players where match_id = mid and user_id = uid and tag_status = 'aceito' and left_at is null)) then
    raise exception 'só quem está na partida corrige o placar' using errcode = '42501';
  end if;
  if new_result is null or jsonb_typeof(new_result) <> 'object' or not (new_result ? 'winner') then raise exception 'placar inválido'; end if;
  if (select count(*) from match_corrections where proposed_by = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'limite_de_pedidos' using errcode = '54000';
  end if;
  perform public.close_correction(id) from match_corrections where match_id = mid and status = 'aberto';
  if exists (select 1 from match_corrections where match_id = mid and status = 'aberto') then raise exception 'pedido_em_andamento' using errcode = '23505'; end if;
  insert into match_corrections (match_id, proposed_by, result, reason) values (mid, uid, new_result, left(why, 200)) returning id into req;
  insert into match_correction_votes (correction_id, user_id, vote, voted_at) values (req, uid, 'sim', now());
  for voter in
    select distinct user_id from match_players where match_id = mid and user_id is not null and user_id <> uid and tag_status = 'aceito' and left_at is null
    union select m.owner_id where m.owner_id is not null and m.owner_id <> uid and m.owner_left_at is null
  loop
    insert into match_correction_votes (correction_id, user_id) values (req, voter) on conflict do nothing;
    insert into notifications (user_id, kind, actor_id, match_id) values (voter, 'fix_request', uid, mid);
  end loop;
  return public.close_correction(req);
end $$;

create or replace function public.vote_score_correction(req uuid, approve boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from match_corrections where id = req for update;
  if public.close_correction(req) = 'expirado' then return 'expirado'; end if;   -- venceu: fecha e avisa quem pediu (sem erro, para gravar)
  update match_correction_votes set vote = case when approve then 'sim' else 'nao' end, voted_at = now()
   where correction_id = req and user_id = auth.uid() and vote = 'pendente';
  if not found then raise exception 'sem voto pendente' using errcode = '42501'; end if;
  return public.close_correction(req);
end $$;

-- prazos: a equipe agenda esta função (pg_cron ou função agendada) para fechar o que venceu, mesmo sem ninguém abrir a partida
create or replace function public.expire_open_requests() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in select id from match_delete_requests where status = 'aberto' and created_at < now() - interval '14 days' loop
    if public.close_delete_request(r.id) = 'expirado' then n := n + 1; end if;
  end loop;
  for r in select id from match_corrections where status = 'aberto' and created_at < now() - interval '14 days' loop
    if public.close_correction(r.id) = 'expirado' then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- 5) Números: as estatísticas da pessoa usam só partidas que ela confirmou e não excluiu;
--    confrontos e parcerias pedem as DUAS pessoas confirmadas e sem ter excluído.
create or replace function public.my_stats_matches() returns setof public.matches
language sql stable security definer set search_path = public as $$
  select m.* from matches m
  where m.deleted_at is null and m.status = 'publicada'
    and exists (select 1 from match_players mp where mp.match_id = m.id and mp.user_id = auth.uid() and mp.tag_status = 'aceito' and mp.left_at is null)
$$;
-- timeline "Seguindo" com uma consulta só: as 30 mais recentes de cada pessoa que sigo (pelo índice) e depois as 30 do total.
-- Para quem segue o dono, as regras de can_see_match se resumem a: publicada, não apagada e não "só eu" (bloquear desfaz o seguir).
-- Na carga de teste: 39 ms pela regra de linha → ~2 ms aqui. Paginação: passe o played_at da última que recebeu em "antes".
create or replace function public.feed_following(antes timestamptz default null, quantas integer default 30)
returns setof public.matches language sql stable security definer set search_path = public as $$
  select m.* from (
    select x.* from follows f cross join lateral (
      select * from matches m where m.owner_id = f.followee_id and m.status = 'publicada' and m.deleted_at is null and m.visibility <> 'so-eu'
        and (antes is null or m.played_at < antes) order by m.played_at desc limit least(greatest(quantas, 1), 50)) x
    where f.follower_id = auth.uid() and f.status = 'ativo'
    union all
    (select * from matches m where m.owner_id = auth.uid() and m.status = 'publicada' and m.deleted_at is null and (antes is null or m.played_at < antes)
      order by m.played_at desc limit least(greatest(quantas, 1), 50))
  ) m
  where not public.is_blocked_between(m.owner_id, auth.uid()) or m.owner_id = auth.uid()
  order by m.played_at desc limit least(greatest(quantas, 1), 50)
$$;

create or replace function public.head_to_head(other uuid)
returns table (match_id text, played_at timestamptz, sport text, relation text, my_team smallint, winner int)
language sql stable security definer set search_path = public as $$
  select m.id, m.played_at, m.sport, case when a.team = b.team then 'junto' else 'contra' end, a.team, (m.result->>'winner')::int
  from matches m
  join match_players a on a.match_id = m.id and a.user_id = auth.uid() and a.tag_status = 'aceito' and a.left_at is null
  join match_players b on b.match_id = m.id and b.user_id = other and b.tag_status = 'aceito' and b.left_at is null
  where m.deleted_at is null and m.status = 'publicada' and not public.is_blocked_between(auth.uid(), other)
  order by m.played_at desc
$$;

-- 6) Denúncias: motivo da lista, sem denunciar a si mesmo, uma aberta por alvo e no máximo 20 por dia.
create unique index reports_one_open on public.reports (reporter_id, coalesce(target_user_id::text, ''), coalesce(target_group_id::text, ''), coalesce(target_match_id, ''), coalesce(target_post_id::text, '')) where status in ('aberta', 'em_analise');
create or replace function public.report_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if num_nonnulls(new.target_user_id, new.target_match_id, new.target_group_id, new.target_post_id) <> 1 then raise exception 'denúncia precisa de um alvo'; end if;
  if new.target_user_id = new.reporter_id then raise exception 'não dá para denunciar a si mesmo'; end if;
  if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'limite_de_denuncias' using errcode = '54000';
  end if;
  new.status := 'aberta'; new.created_at := now(); new.handled_at := null;
  return new;
end $$;
create trigger reports_check before insert on public.reports for each row execute function public.report_check();
-- para a equipe: alvos com denúncias de 3 ou mais pessoas diferentes em 7 dias vão para o topo da fila
create or replace view public.report_hotlist as
  select coalesce(target_user_id::text, target_group_id::text, target_match_id, target_post_id::text) as target,
         case when target_user_id is not null then 'perfil' when target_group_id is not null then 'grupo' when target_match_id is not null then 'partida' else 'resenha' end as kind,
         count(distinct reporter_id) as people, array_agg(distinct category) as categories, max(created_at) as last_at
  from reports where status in ('aberta', 'em_analise') and created_at > now() - interval '7 days'
  group by 1, 2 having count(distinct reporter_id) >= 3;

-- índices das chaves estrangeiras (apagar conta, partida ou grupo sem varrer as tabelas) e dos limites por dia
create index blocks_blocked on public.blocks (blocked_id);
create index group_posts_user on public.group_posts (user_id);
create index groups_created_by on public.groups (created_by);
create index live_matches_owner on public.live_matches (owner_id);
create index match_claims_match on public.match_claims (match_id);
create index match_claims_user on public.match_claims (user_id);
create index match_delete_requests_match on public.match_delete_requests (match_id);
create index match_delete_requests_by on public.match_delete_requests (requested_by, created_at);
create index match_delete_votes_user on public.match_delete_votes (user_id);
create index match_corrections_match on public.match_corrections (match_id);
create index match_corrections_by on public.match_corrections (proposed_by, created_at);
create index match_correction_votes_user on public.match_correction_votes (user_id);
create index notifications_actor on public.notifications (actor_id, created_at);
create index notifications_match on public.notifications (match_id) where match_id is not null;
create index notifications_group on public.notifications (group_id) where group_id is not null;
create index reports_reporter on public.reports (reporter_id, created_at);
create index reports_target_user on public.reports (target_user_id) where target_user_id is not null;
create index reports_target_group on public.reports (target_group_id) where target_group_id is not null;
create index reports_target_match on public.reports (target_match_id) where target_match_id is not null;
create index reports_target_post on public.reports (target_post_id) where target_post_id is not null;
create index subscription_members_member on public.subscription_members (member_id);
create index video_segments_owner on public.video_segments (owner_id);
create index zaps_user on public.zaps (user_id);

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
grant update (handle, name, full_name, city, bio, avatar_url, sports, privacy_level, privacy_show, show_online, live_view, tag_policy, birth_date, deleted_at) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;
-- marcado só responde (aceitar/recusar); dono troca jogador apagando e inserindo de novo
revoke update on public.match_players from authenticated;
grant update (tag_status, responded_at) on public.match_players to authenticated;
-- partida: dono não troca id, código nem dono
revoke update on public.matches from authenticated;
grant update (group_id, sport, source, cfg, played_at, duration_ms, type, title, caption, visibility, status, place_id, court_id, place_name, city, result, summary, replay) on public.matches to authenticated;
-- notificações e assinatura: só o servidor escreve (cada um só marca como lida)
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
revoke insert, update, delete on public.ai_usage from authenticated;
-- exclusão e correção para todos: só pelas funções (request_/vote_match_deletion, request_/vote_score_correction)
revoke insert, update, delete on public.match_delete_requests, public.match_delete_votes, public.match_corrections, public.match_correction_votes from authenticated;
revoke all on public.match_delete_requests, public.match_delete_votes, public.match_corrections, public.match_correction_votes from anon;
revoke execute on function public.close_correction(uuid), public.expire_open_requests() from public, anon, authenticated;
revoke all on public.report_hotlist from anon, authenticated;
revoke execute on function public.leave_all(uuid), public.finish_match_if_empty(text), public.close_delete_request(uuid) from public, anon, authenticated;
-- marcado: left_at e display_name só pelas funções
-- o nome guardado na marcação não sai para os apps: quem foi bloqueado não descobre o nome de quem bloqueou
-- (o perfil some para ele pela regra profiles_read e o app mostra "Jogador")
revoke select on public.match_players from anon, authenticated;
grant select (match_id, team, slot, user_id, guest_name, nickname, tag_status, created_at, responded_at, left_at) on public.match_players to anon, authenticated;
-- denúncias: ninguém edita depois de enviar
revoke update, delete on public.reports from authenticated;
-- grupo: código do convite não muda
revoke update on public.groups from authenticated;
grant update (name, sport, place_id, place_name, when_text, color, description, open, avatar_url, deleted_at) on public.groups to authenticated;
-- membro: organizador muda papel e status
revoke update on public.group_members from authenticated;
grant update (role, status) on public.group_members to authenticated;
-- lugares: arena verificada só pela equipe
revoke update on public.places from authenticated;
grant update (name, city, lat, lng) on public.places to authenticated;
-- jogando agora: ninguém de fora lê as tabelas (só pela função live_for_viewer); dono não troca id nem dono
revoke all on public.live_matches, public.live_players, public.daily_analyses from anon;
revoke update on public.live_matches from authenticated;
grant update (sport, place_name, last_point_at, score, guests) on public.live_matches to authenticated;
revoke update on public.live_players, public.daily_analyses from authenticated;
revoke execute on function public.live_for_viewer(uuid), public.live_cleanup() from public, anon;
revoke execute on function public.live_cleanup() from authenticated;
revoke all on public.format_presets from anon;
revoke update on public.format_presets from authenticated;
-- assinatura: membros só aceitam (status); recibos e trial só pelo servidor; ninguém de fora lê
revoke all on public.subscription_members, public.payments from anon;
revoke update on public.subscription_members from authenticated;
grant update (status) on public.subscription_members to authenticated;
revoke insert, update, delete on public.payments from authenticated;
