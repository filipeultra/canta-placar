-- ULTRA PLAY · instalação completa do banco (gerado por montar.sh; não edite aqui, edite schema.sql, storage.sql e admin.sql).
-- Colar inteiro no Supabase → SQL Editor → Run, num projeto novo. Depois rode agendar.sql.

-- ============================== schema.sql ==============================
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

-- texto que aparece para os outros (nomes): sem caracteres de controle nem os invisíveis que invertem ou escondem letras
-- (U+202E etc.), usados para se passar por outra pessoa ("Bia" que se lê "aiB") ou quebrar a tela e as planilhas
create or replace function public.plain_text(t text) returns boolean
language sql immutable as $$ select t is null or t !~ '[[:cntrl:]​-‏‪-‮⁠-⁩﻿]' $$;

-- placar no formato do app: { sets: [[a,b]...] | null, final: [a,b] | null, winner: 0|1|null }, números de 0 a 999
-- (vencedor que não é 0/1 quebraria o ranking do grupo e o confronto, que leem winner como número)
create or replace function public.result_ok(r jsonb) returns boolean
language sql immutable as $$
  select r is null or (jsonb_typeof(r) = 'object' and pg_column_size(r) < 4000
    and coalesce(r -> 'winner', 'null') in ('null', '0', '1')
    and (coalesce(r -> 'sets', 'null') = 'null' or (jsonb_typeof(r -> 'sets') = 'array' and jsonb_array_length(r -> 'sets') <= 9
         and not exists (select 1 from jsonb_array_elements(r -> 'sets') s
                         where case when jsonb_typeof(s) = 'array' then jsonb_array_length(s) > 3 or exists (select 1 from jsonb_array_elements(s) v
                                 where case when jsonb_typeof(v) = 'number' then not (v::numeric between 0 and 999) else true end) else true end)))
    and (coalesce(r -> 'final', 'null') = 'null' or (jsonb_typeof(r -> 'final') = 'array' and jsonb_array_length(r -> 'final') <= 3
         and not exists (select 1 from jsonb_array_elements(r -> 'final') v where case when jsonb_typeof(v) = 'number' then not (v::numeric between 0 and 999) else true end))))
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
  name           text not null check (char_length(name) between 1 and 60 and btrim(name) <> '' and public.plain_text(name)),   -- "nome nos pontos" (nome e sobrenome curtos, usado no placar e na voz)
  full_name      text check (char_length(full_name) <= 60 and public.plain_text(full_name)),
  city           text check (char_length(city) <= 60 and public.plain_text(city)),
  bio            text check (char_length(bio) <= 160),
  avatar_url     text check (avatar_url ~ '^(https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/)?avatars/[0-9a-f-]{36}/[A-Za-z0-9_.-]{1,80}$'),   -- só do próprio armazenamento, na pasta de alguém (foto de fora rastrearia quem abre o perfil)
  sports         text[] not null default '{}' check (cardinality(sports) <= 12 and pg_column_size(sports) < 400),
  privacy_level  text not null default 'aberto' check (privacy_level in ('aberto', 'personalizado', 'privado')),
  privacy_show   jsonb not null default '{"partidas":true,"estatisticas":true,"conquistas":true,"recordes":true,"confrontos":true,"atividade":true,"geral":true}'
                 check (jsonb_typeof(privacy_show) = 'object' and pg_column_size(privacy_show) < 1000),
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
  -- o nome do Google/Apple pode ser longo ou trazer caracteres estranhos: limpa e corta em 60 (senão o cadastro inteiro falharia)
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(btrim(left(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'full_name', ''),
                                                            '[[:cntrl:]​-‏‪-‮⁠-⁩﻿]', ' ', 'g'), 60)), ''), 'Jogador'));
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
  name        text not null check (char_length(name) between 2 and 80 and public.plain_text(name)),
  city        text check (char_length(city) <= 60 and public.plain_text(city)),
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
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
  name       text not null check (char_length(name) between 1 and 40),
  starts_at  timestamptz not null default now()
);

-- ============================================================
-- grupos (turmas, clubes, times)
-- ============================================================
create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('G-' || public.short_code(6)),   -- convite: …/#grupo-G-XXXXXX
  name         text not null check (char_length(name) between 2 and 40 and btrim(name) <> '' and public.plain_text(name)),
  sport        text not null check (char_length(sport) between 1 and 20),
  place_id     uuid references public.places(id) on delete set null,
  place_name   text check (char_length(place_name) <= 60),
  when_text    text check (char_length(when_text) <= 40),       -- "Segundas, 19h"
  color        text not null default '#AFFB48' check (color ~ '^#[0-9A-F]{6}$'),
  description  text check (char_length(description) <= 160),
  open         boolean not null default false,                  -- aberto: entra direto; fechado: pede e o organizador aprova
  avatar_url   text check (avatar_url ~ '^(https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/)?avatars/[0-9a-f-]{36}/[A-Za-z0-9_.-]{1,80}$'),     -- foto do grupo (bucket avatars, pasta do organizador)
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
  sport        text not null check (char_length(sport) between 1 and 20),
  source       text not null default 'live' check (source in ('live', 'manual')),
  cfg          jsonb not null default '{}' check (jsonb_typeof(cfg) = 'object' and pg_column_size(cfg) < 8000),
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
  city         text check (char_length(city) <= 60),
  result       jsonb check (public.result_ok(result)),     -- { sets: [[a,b]...] | null, final: [a,b] | null, winner: 0|1|null }
  summary      jsonb check (pg_column_size(summary) < 256000),   -- { pts:[a,b], aces:[a,b], timeline:[...] } (só ao vivo)
  replay       jsonb check (pg_column_size(replay) < 256000),    -- visual do replay animado publicado no post
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
  event     jsonb not null check (jsonb_typeof(event) = 'object' and pg_column_size(event) < 2000),     -- o lance como o app guarda (sem o texto falado)
  primary key (match_id, seq)
);

create table public.match_players (
  match_id       text not null references public.matches(id) on delete cascade,
  team           smallint not null check (team in (0, 1)),
  slot           smallint not null check (slot between 0 and 5),
  user_id        uuid references public.profiles(id) on delete set null,
  guest_name     text check (char_length(guest_name) <= 40 and public.plain_text(guest_name)),
  nickname       text check (char_length(nickname) between 1 and 24 and public.plain_text(nickname)),   -- apelido só nesta partida (dois jogadores com o mesmo nome)
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
  guest_name    text not null check (char_length(guest_name) between 1 and 40 and public.plain_text(guest_name)),
  status        text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);
create unique index match_claims_one_accepted on public.match_claims (match_id, guest_name) where status = 'aceito';
create unique index match_claims_one_pending on public.match_claims (match_id, user_id) where status = 'pendente';   -- duplo clique no pedido

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
  storage_path  text not null check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$'
                                     and split_part(storage_path, '/', 1) = owner_id::text),   -- bucket "videos": <owner_id>/<match_id>/<início>.webm|mp4 (só a própria pasta)
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  bytes         bigint not null check (bytes >= 0),
  mime          text not null check (mime ~ '^video/(webm|mp4)(;[ A-Za-z0-9=,."-]{0,60})?$'),
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
-- Elas podem ser chamadas direto pela API (/rpc). Pelo app (papel anon/authenticated), só respondem sobre a própria
-- sessão: ninguém pergunta "fulano bloqueou beltrano?", "fulano segue o perfil privado de beltrano?" ou "fulano é do
-- grupo fechado?". As regras e gatilhos sempre passam auth.uid() num dos lados; o servidor (service role, SQL) vê tudo.
create or replace function public.is_app_role() returns boolean
language sql stable as $$ select coalesce(current_setting('role', true), '') in ('anon', 'authenticated') $$;

-- sem a própria pessoa num dos lados, responde "bloqueado" (o mais fechado)
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is distinct from a and auth.uid() is distinct from b and public.is_app_role() then true
    else exists (select 1 from blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a)) end
$$;

-- sem a própria pessoa num dos lados, responde "não segue"
create or replace function public.follows_active(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is distinct from follower and auth.uid() is distinct from followee and public.is_app_role() then false
    else exists (select 1 from follows where follower_id = follower and followee_id = followee and status = 'ativo') end
$$;

-- papel de outra pessoa no grupo: só para quem também é membro ativo dele (como na lista de membros)
create or replace function public.group_role(gid uuid, uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from group_members where group_id = gid and user_id = uid and status = 'ativo'
    and (uid = auth.uid() or not public.is_app_role()
         or exists (select 1 from group_members me where me.group_id = gid and me.user_id = auth.uid() and me.status = 'ativo'))
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
  -- pelo app, só "eu vejo?": não dá para perguntar se outra pessoa vê (revelaria quem segue quem, grupos e bloqueios)
  if viewer is distinct from auth.uid() and public.is_app_role() then return false; end if;
  select * into m from matches where id = mid;
  if not found or m.deleted_at is not null then return false; end if;
  if viewer is not null and m.owner_id = viewer then return true; end if;
  if m.status <> 'publicada' or m.visibility = 'so-eu' then return false; end if;
  -- (bloqueio, grupo e seguir lidos direto, sem chamar as funções: esta regra roda em cada linha da timeline)
  if viewer is not null and exists (select 1 from blocks where (user_id = m.owner_id and blocked_id = viewer) or (user_id = viewer and blocked_id = m.owner_id)) then return false; end if;
  player := viewer is not null and exists (select 1 from match_players where match_id = mid and user_id = viewer and tag_status = 'aceito');
  if player then return true; end if;
  if m.group_id is not null and viewer is not null and exists (select 1 from group_members where group_id = m.group_id and user_id = viewer and status = 'ativo') then return true; end if;
  follower := viewer is not null and exists (select 1 from follows where follower_id = viewer and followee_id = m.owner_id and status = 'ativo');
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
    -- seguir e deixar de seguir em sequência não enche as notificações: um aviso por pessoa a cada 7 dias
    if not exists (select 1 from notifications where actor_id = new.follower_id and user_id = new.followee_id and kind in ('follow', 'follow_request') and created_at > now() - interval '7 days') then
      insert into notifications (user_id, kind, actor_id) values (new.followee_id, case when new.status = 'pendente' then 'follow_request' else 'follow' end, new.follower_id);
    end if;
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
  -- tirar e dar o zap de novo não manda outro aviso: um por pessoa e partida
  if not exists (select 1 from notifications where actor_id = new.user_id and user_id = owner and kind = 'zap' and match_id = new.match_id) then
    insert into notifications (user_id, kind, actor_id, match_id) values (owner, 'zap', new.user_id, new.match_id);
  end if;
  return new;
end $$;
create trigger zaps_notify after insert on public.zaps for each row execute function public.zap_notify();

-- entrar no grupo: aberto entra; fechado vira pedido (avisa quem organiza)
create or replace function public.group_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare g groups; adder uuid := auth.uid();
begin
  select * into g from groups where id = new.group_id;
  -- organizador ou moderador não põe no grupo quem tem bloqueio com ele
  if adder is not null and adder is distinct from new.user_id and public.is_blocked_between(adder, new.user_id) then
    raise exception 'bloqueado' using errcode = '42501';
  end if;
  if adder is distinct from new.user_id and coalesce(public.group_role(new.group_id, adder), '') <> 'admin' then
    new.role := 'membro';   -- moderador adiciona membro; só o organizador escolhe papel
  end if;
  if adder = new.user_id and coalesce(current_setting('ultraplay.invite', true), '') <> '1'
     and not exists (select 1 from groups where id = new.group_id and created_by = adder) then
    new.role := 'membro';
    new.status := case when g.open then 'ativo' else 'pendente' end;
    -- sair e pedir de novo em sequência não enche as notificações de quem organiza: um aviso a cada 7 dias
    if new.status = 'pendente' and not exists (select 1 from notifications where actor_id = new.user_id and group_id = new.group_id and kind = 'group_request' and created_at > now() - interval '7 days') then
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
-- grupo tirado do ar (pela equipe ou pelo organizador) não volta: um update sem where não passa pela regra de leitura
create policy groups_update on public.groups for update using (deleted_at is null and public.group_role(id, auth.uid()) = 'admin') with check (public.group_role(id, auth.uid()) = 'admin');
-- apagar o grupo (organizador): pela função, pelo mesmo motivo do post (o grupo apagado some da regra de leitura)
create or replace function public.remove_group(gid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update groups set deleted_at = now() where id = gid and deleted_at is null and public.group_role(gid, auth.uid()) = 'admin';
  if not found then raise exception 'grupo não encontrado' using errcode = '42501'; end if;
  return true;
end $$;
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
-- tirar do ar (o autor ou quem modera): pela função remove_group_post. Ninguém edita post pela API (antes, quem moderava
-- reescrevia o texto e o autor de outro post, e um update sem filtro devolvia ao ar o que a equipe tirou).
-- Um update direto com filtro nem funcionaria: a regra de leitura esconde o post apagado, e o Postgres recusa a linha nova.
create or replace function public.remove_group_post(pid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update group_posts set deleted_at = now() where id = pid and deleted_at is null
    and (user_id = auth.uid() or public.is_group_manager(group_id, auth.uid()));
  if not found then raise exception 'post não encontrado' using errcode = '42501'; end if;
  return true;
end $$;

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
create policy claims_insert on public.match_claims for insert with check (user_id = auth.uid() and status = 'pendente' and public.can_see_match(match_id, auth.uid()));
create policy claims_answer on public.match_claims for update using (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()));

create policy zaps_read on public.zaps for select using (public.can_see_match(match_id, auth.uid()));
create policy zaps_insert on public.zaps for insert with check (user_id = auth.uid() and public.can_see_match(match_id, auth.uid()));
create policy zaps_delete on public.zaps for delete using (user_id = auth.uid());

-- notificações: gravadas pelos gatilhos; cada um lê e marca as suas
create policy notif_read on public.notifications for select using (user_id = auth.uid());
create policy notif_mark on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vídeos: só o dono (os jogadores veem pelo link assinado que o app gera)
create policy videos_own on public.video_segments for select using (owner_id = auth.uid());
create policy videos_del on public.video_segments for delete using (owner_id = auth.uid());
create policy videos_upd on public.video_segments for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

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
-- a hora do ponto é do servidor: com "último ponto" no futuro, a partida ficaria em "jogando agora" para sempre
create or replace function public.live_clock() returns trigger
language plpgsql as $$
begin
  new.last_point_at := least(new.last_point_at, now());
  new.started_at := least(new.started_at, now());
  return new;
end $$;
create trigger live_matches_clock before insert or update on public.live_matches for each row execute function public.live_clock();

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
  perform pg_advisory_xact_lock(hashtextextended('presets:' || new.user_id || ':' || new.sport, 0));   -- duas gravações juntas: uma espera a outra
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
-- trecho de vídeo novo na nuvem: só Pro (a regra fica aqui porque usa has_pro)
create policy videos_add on public.video_segments for insert with check (owner_id = auth.uid() and public.has_pro(auth.uid()));

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
    -- trava a assinatura: dois convites ao mesmo tempo esperam um pelo outro e a conta de vagas não fura
    select * into s from subscriptions where user_id = new.owner_id for update;
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
  result        jsonb not null check (jsonb_typeof(result) = 'object' and (result ? 'winner') and public.result_ok(result)),
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
  where m.owner_id = auth.uid()
     or not exists (select 1 from blocks b where (b.user_id = m.owner_id and b.blocked_id = auth.uid()) or (b.user_id = auth.uid() and b.blocked_id = m.owner_id))
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

-- 7) Data e grupo da partida (auditoria de 15/10/2026):
--    · a data do jogo fica entre 2000 e amanhã (uma partida em 2099 ficaria no topo da timeline Geral para sempre);
--    · a partida só entra (ou muda) para um grupo de que o dono é membro ativo (senão alguém de fora poria partidas
--      no grupo fechado dos outros).
create or replace function public.match_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.played_at is distinct from old.played_at)
     and (new.played_at > now() + interval '1 day' or new.played_at < timestamptz '2000-01-01') then
    raise exception 'data_da_partida: fora do intervalo aceito' using errcode = 'check_violation';
  end if;
  if new.group_id is not null and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id)
     and auth.uid() is not null and not public.is_group_member(new.group_id, auth.uid()) then
    raise exception 'partida_em_grupo_alheio: só membro do grupo põe partida nele' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger matches_guard before insert or update of played_at, group_id on public.matches for each row execute function public.match_guard();

-- 8) Quem lança joga: fora da partida do GRUPO, o dono está sempre entre os jogadores (ninguém lança partida de
--    terceiros). Só a partida do grupo (group_id, com o dono membro) pode ser lançada por quem não joga (organizador).
--    A conferência é adiada para o fim da transação (a partida e os jogadores entram em comandos separados) e não vale
--    para conta apagada (owner_id nulo) nem para quem já usou "Excluir para mim" (owner_left_at).
--    O app grava a partida com save_match(partida, jogadores), que faz tudo numa transação só: pela API (PostgREST),
--    cada pedido é uma transação, então um insert só da partida e outro só dos jogadores seria recusado.
create or replace function public.match_owner_plays() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid text; m matches;
begin
  if tg_table_name = 'matches' then
    mid := new.id;
    -- o grupo foi apagado de vez (a chave estrangeira zerou group_id): a partida do grupo continua valendo
    if tg_op = 'UPDATE' and old.group_id is not null and new.group_id is null and not exists (select 1 from groups where id = old.group_id) then return null; end if;
  else
    mid := old.match_id;
  end if;
  select * into m from matches where id = mid;
  if not found or m.group_id is not null or m.owner_id is null or m.owner_left_at is not null then return null; end if;
  if not exists (select 1 from match_players where match_id = mid and user_id = m.owner_id) then
    raise exception 'dono_precisa_jogar: fora da partida do grupo, quem lança tem que estar entre os jogadores' using errcode = 'check_violation';
  end if;
  return null;
end $$;
create constraint trigger matches_owner_plays after insert or update of group_id, owner_id on public.matches
  deferrable initially deferred for each row execute function public.match_owner_plays();
create constraint trigger players_owner_plays after delete or update of user_id on public.match_players
  deferrable initially deferred for each row execute function public.match_owner_plays();

-- lançar partida (e subir da fila offline): a partida e os jogadores juntos. Mandar de novo a mesma partida não duplica
-- nada (devolve o id). Roda com as permissões e regras de quem chama (security invoker).
-- m: { id, group_id, sport, source, cfg, played_at, duration_ms, type, title, caption, visibility, status, place_id,
--      court_id, place_name, city, result, summary, replay }   players: [{ team, slot, user_id | guest_name, nickname }]
create or replace function public.save_match(m jsonb, players jsonb default '[]') returns text
language plpgsql security invoker set search_path = public as $$
declare r matches;
begin
  if auth.uid() is null then raise exception 'precisa entrar na conta' using errcode = '42501'; end if;
  if jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(players) is distinct from 'array' or jsonb_array_length(players) > 12 then
    raise exception 'partida inválida' using errcode = '22023';
  end if;
  r := jsonb_populate_record(null::matches, m);
  insert into matches (id, owner_id, group_id, sport, source, cfg, played_at, duration_ms, type, title, caption, visibility, status,
                       place_id, court_id, place_name, city, result, summary, replay)
  values (r.id, auth.uid(), r.group_id, r.sport, coalesce(r.source, 'live'), coalesce(r.cfg, '{}'), r.played_at, r.duration_ms,
          coalesce(r.type, 'amistoso'), r.title, r.caption, coalesce(r.visibility, 'todos'), coalesce(r.status, 'publicada'),
          r.place_id, r.court_id, r.place_name, r.city, r.result, r.summary, r.replay)
  on conflict (id) do nothing;
  if not found then
    if exists (select 1 from matches where id = r.id and owner_id = auth.uid()) then return r.id; end if;   -- já tinha subido
    raise exception 'partida_ja_existe' using errcode = '23505';
  end if;
  insert into match_players (match_id, team, slot, user_id, guest_name, nickname)
    select r.id, p.team, p.slot, p.user_id, p.guest_name, p.nickname
    from jsonb_to_recordset(players) as p(team smallint, slot smallint, user_id uuid, guest_name text, nickname text);
  return r.id;
end $$;

-- data de nascimento e consentimento do responsável: só a própria pessoa lê (a coluna não sai para os outros)
create or replace function public.my_private_profile() returns table (birth_date date, guardian_consent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.birth_date, p.guardian_consent_at from profiles p where p.id = auth.uid()
$$;

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
-- perfil: data de nascimento e consentimento do responsável (dado de menor) não saem para ninguém; a pessoa lê os seus
-- por my_private_profile(). No app, ler o perfil com as colunas listadas (select=* pede todas e é recusado).
revoke select on public.profiles from anon, authenticated;
grant select (id, public_id, handle, name, full_name, city, bio, avatar_url, sports, privacy_level, privacy_show, pro_until, trial_used_at,
              show_online, live_view, tag_policy, created_at, updated_at, deleted_at) on public.profiles to anon, authenticated;
-- partida e post: código, selo de corrigido, datas de criação e de exclusão são do servidor (lançar pelo save_match)
revoke insert on public.matches from authenticated;
grant insert (id, owner_id, group_id, sport, source, cfg, played_at, duration_ms, type, title, caption, visibility, status, place_id, court_id,
              place_name, city, result, summary, replay) on public.matches to authenticated;
revoke insert, update on public.group_posts from authenticated;
grant insert (id, group_id, user_id, text) on public.group_posts to authenticated;
-- seguir: quem é seguido só aprova (status); não troca quem segue
revoke update on public.follows from authenticated;
grant update (status) on public.follows to authenticated;
-- pedido de convidado: o dono só responde
revoke update on public.match_claims from authenticated;
grant update (status, responded_at) on public.match_claims to authenticated;
-- denúncias: ninguém edita depois de enviar
revoke update, delete on public.reports from authenticated;
-- grupo: código do convite não muda (nem é escolhido por quem cria)
revoke insert on public.groups from authenticated;
grant insert (id, name, sport, place_id, place_name, when_text, color, description, open, avatar_url, created_by) on public.groups to authenticated;
revoke update on public.groups from authenticated;
grant update (name, sport, place_id, place_name, when_text, color, description, open, avatar_url) on public.groups to authenticated;   -- apagar: remove_group
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
-- defesa em profundidade (auditoria de 15/10/2026): além das regras por linha, anon não escreve em tabela nenhuma
-- (o admin.sql devolve só o insert de eventos), e ninguém do app tem TRUNCATE (passa por cima da RLS), TRIGGER ou REFERENCES
revoke insert, update, delete on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke execute on function public.save_match(jsonb, jsonb), public.remove_group_post(uuid), public.remove_group(uuid), public.my_private_profile() from public, anon;

-- ============================== storage.sql ==============================
-- ULTRA PLAY · arquivos (Supabase Storage). Rodar depois do schema.sql.
-- avatars: público (foto do perfil). videos: privado (trechos gravados, Pro), cada um na pasta do próprio id.
insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars', 'avatars', true, 2097152),
  ('videos', 'videos', false, 209715200)
on conflict (id) do nothing;
-- a foto sai do app em JPEG 320×320 (~20 KB); o limite de 512 KB e os tipos barram arquivo que não é imagem
update storage.buckets set file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'avatars';

-- o bucket é público (a foto abre pelo link); esta regra é para o app listar e trocar a própria foto (upsert pede leitura)
-- nas regras de gravar, o nome não tem trecho vazio, "." nem ".." ("minha-pasta/../pasta-de-outro/foto.jpg" passaria
-- pela 1ª pasta, mas o link normalizado abriria a pasta de outra pessoa)
create policy "avatar: vê os seus" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: cada um na sua pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)');
create policy "avatar: troca o seu" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)');   -- não move para a pasta de outra pessoa
create policy "avatar: apaga o seu" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- vídeo: só o dono lê, troca e apaga; gravar novo trecho pede Pro (sem isso, qualquer conta encheria a nuvem).
-- Quem deixou de ser Pro continua vendo, baixando e apagando o que já gravou. Para mostrar a outra pessoa,
-- o app gera um link assinado (createSignedUrl).
update storage.buckets set allowed_mime_types = array['video/webm', 'video/mp4'] where id = 'videos';
create policy "vídeo: o dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vídeo: grava quem é Pro" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)' and public.has_pro(auth.uid()));
create policy "vídeo: o dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and name !~ '(^|/)\.{0,2}(/|$)' and public.has_pro(auth.uid()));
create policy "vídeo: o dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================== admin.sql ==============================
-- ULTRA PLAY · estatísticas de uso e painel de admin. Rodar depois do schema.sql.
-- Eventos chegam do app e do site (sem nome, e-mail ou conteúdo das partidas). Só quem está na tabela admins lê.

-- ---------- eventos ----------
-- device_id: sorteado no aparelho. Sem consentimento, vale só para a visita (sessão) e só entram "visit", "app_open" e
-- "visit_end" (tempo e rolagem da própria visita); com consentimento (Ajustes → Estatísticas de uso), fica fixo no aparelho
-- e entram os outros eventos (telas do app, recursos usados) e os cliques do mapa de calor (heat_clicks).
create table public.app_events (
  id          bigserial primary key,
  device_id   text not null check (device_id ~ '^[a-z0-9]{8,32}$'),
  session     boolean not null default false,          -- true = id só da visita (sem consentimento)
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null check (name ~ '^[a-z_]{2,32}$'),
  -- e-mail não entra nem por engano (props ou caminho da página): os eventos não guardam dado pessoal
  props       jsonb not null default '{}' check (pg_column_size(props) < 2000 and props::text !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]'),
  path        text check (char_length(path) <= 120 and path !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]'),
  source      text check (char_length(source) <= 40),
  medium      text check (char_length(medium) <= 40),
  campaign    text check (char_length(campaign) <= 40),
  content     text check (char_length(content) <= 40),   -- utm_content: o link rastreável (tracked_links.slug)
  ref         text check (ref ~ '^UP-[A-Z0-9]{6}$'),
  referrer    text check (referrer ~ '^[a-z0-9.-]{3,60}$'),  -- só o domínio do site que mandou a pessoa (instagram.com, google.com)
  sid         text check (sid ~ '^[a-z0-9]{8,32}$'),         -- a visita (aba aberta): junta as páginas e o tempo da mesma visita
  app_version text check (char_length(app_version) <= 20),
  created_at  timestamptz not null default now()
);
create index app_events_time on public.app_events (created_at);
create index app_events_name_time on public.app_events (name, created_at);
create index app_events_device on public.app_events (device_id, created_at);

create table public.admins (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  -- dono: tudo (cortesia, tirar do ar, ver e-mails); moderador: denúncias e contas (e-mail mascarado); leitor: só os números
  role        text not null default 'dono' check (role in ('dono', 'moderador', 'leitor')),
  disabled_at timestamptz,   -- suspenso: perde o acesso na hora, sem apagar o histórico
  created_at  timestamptz not null default now()
);
-- admin = está na tabela admins E entrou com a 2ª etapa (código do app autenticador): o token da sessão diz aal2.
-- Sem parâmetro: ninguém consegue perguntar "fulano é admin?" por outra pessoa.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and exists (select 1 from admins where user_id = auth.uid() and disabled_at is null)
$$;
-- só a própria pessoa, na tela de entrada do painel: "esta conta está na lista de admins?" (para pedir a 2ª etapa)
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = public as $$ select auth.uid() is not null and exists (select 1 from admins where user_id = auth.uid() and disabled_at is null) $$;
-- papel de quem está no painel (nulo para quem não é admin com a 2ª etapa)
create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public as $$ select case when is_admin() then (select role from admins where user_id = auth.uid()) end $$;
-- há quantos minutos a pessoa digitou o código do autenticador (o token guarda a hora em "amr"; renovar a sessão não muda)
create or replace function public.admin_mfa_age_min() returns integer
language sql stable set search_path = public as $$
  select coalesce((select ((extract(epoch from now()) - max((a ->> 'timestamp')::numeric)) / 60)::int
                   from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
                   where a ->> 'method' in ('totp', 'mfa/totp') and a ->> 'timestamp' ~ '^[0-9]+$'), 99999)
$$;
revoke execute on function public.is_admin(), public.am_i_admin() from public, anon;
grant execute on function public.is_admin(), public.am_i_admin() to authenticated;

-- preço mensal de cada plano, para o MRR (ajuste quando os preços forem decididos; ver docs/PRECOS.md)
create table public.plan_prices (
  plan     text primary key,
  monthly  numeric(10, 2) not null
);
insert into public.plan_prices (plan, monthly) values
  ('pro_mensal', 24.90), ('pro_semestral', 19.98), ('pro_anual', 14.99), ('amigos_semestral', 41.65), ('amigos_anual', 33.33), ('fundador', 9.99), ('professor', 59.90), ('arena', 149.90)
on conflict (plan) do nothing;

alter table public.app_events enable row level security;
alter table public.admins enable row level security;
alter table public.plan_prices enable row level security;
-- qualquer um manda evento (o app sem login também); ninguém lê, só admin
create policy events_insert on public.app_events for insert to anon, authenticated
  with check ((user_id is null or user_id = auth.uid()) and created_at > now() - interval '2 days' and created_at < now() + interval '5 minutes'
              and (session = false or name in ('visit', 'app_open', 'visit_end')));
create policy events_admin on public.app_events for select using (public.is_admin());
create policy admins_self on public.admins for select using (user_id = auth.uid());
create policy prices_read on public.plan_prices for select using (true);
grant usage on sequence public.app_events_id_seq to anon, authenticated;
-- o Supabase dá acesso total às tabelas novas para anon e authenticated: aqui fica só o que precisa
revoke all on public.app_events, public.admins, public.plan_prices from anon, authenticated;
grant insert (device_id, session, user_id, name, props, path, source, medium, campaign, content, ref, referrer, sid, app_version, created_at) on public.app_events to anon, authenticated;
grant select on public.app_events to authenticated;   -- a regra events_admin deixa só admin ler
grant select on public.admins to authenticated;       -- a regra admins_self deixa ver só a própria linha
grant select on public.plan_prices to anon, authenticated;

-- ---------- números do painel (uma chamada só; só admin) ----------
-- days: tamanho do período; ate: último dia (nulo = hoje). Ex.: admin_metrics(30, '2026-09-30') é setembro.
create or replace function public.admin_metrics(days int default 30, ate date default null) returns jsonb
language plpgsql stable security definer set search_path = public set work_mem = '64MB' as $$
declare
  d int := greatest(1, least(days, 730));
  tend timestamptz := case when ate is null then now() else least(now(), (ate + 1)::timestamptz) end;   -- fim do período (exclusivo)
  t0 timestamptz := date_trunc('day', tend - interval '1 second') - make_interval(days => d - 1);
  p0 timestamptz := t0 - make_interval(days => d);
  dlast date := (tend - interval '1 second')::date;
  lf date;   -- 1º dia do período que ainda não está no resumo diário (dali em diante, as visitas por dia são contadas na hora)
  out jsonb;
begin
  if not is_admin() then raise exception 'acesso só para administradores' using errcode = '42501'; end if;
  select coalesce(min(g::date), dlast + 1) into lf from generate_series(t0, dlast::timestamptz, interval '1 day') g
    where exists (select 1 from (values ('site'), ('app')) ar(a)
      where g::date >= coalesce((select min(w.started_at)::date from web_sessions w where w.area = ar.a), dlast + 1)
        and not exists (select 1 from web_daily_done x where x.area = ar.a and x.day = g::date));
  with
  -- eventos do app no período e no anterior, sem as páginas do site, as saídas e as telas (essas o painel lê de web_sessions)
  ev as materialized (select device_id, session, name, created_at, app_version
    from app_events where created_at >= p0 and created_at < tend and name not in ('visit', 'visit_end', 'screen')),
  cur as (select * from ev where created_at >= t0),
  prev as (select * from ev where created_at < t0),
  -- visitas (site e app): uma linha por visita em web_sessions, lida pelo índice de cada área
  ws as (select area, device_id, started_at, source, medium, channel, consent, standalone
    from web_sessions where area in ('site', 'app') and started_at >= t0 and started_at < tend),
  -- contagens dos eventos numa passada só
  ek as (select
      count(distinct device_id) filter (where created_at >= t0 and name = 'app_open' and not session) as active,
      count(distinct device_id) filter (where created_at < t0 and name = 'app_open' and not session) as active_prev,
      count(*) filter (where created_at >= t0 and name = 'install') as installs,
      count(*) filter (where created_at >= t0 and name = 'rec_start') as recs,
      count(*) filter (where created_at >= t0 and name = 'share') as shares,
      count(*) filter (where created_at >= t0 and name = 'invite') as invites,
      count(*) filter (where created_at >= t0 and name = 'feedback') as feedbacks,
      count(*) filter (where created_at >= t0 and name = 'js_error') as errors,
      count(distinct device_id) filter (where created_at >= t0 and name = 'js_error') as errors_devices,
      count(*) filter (where created_at < t0 and name = 'js_error') as errors_prev
    from ev),
  wk as (select (select count(*) from (select distinct device_id from ws) v) as visits,
      (select count(*) from (select distinct device_id from web_sessions where area in ('site', 'app') and started_at >= p0 and started_at < t0) v) as visits_prev,
      coalesce(round(100.0 * (select count(*) from ws where area = 'app' and standalone) / nullif((select count(*) from ws where area = 'app' and standalone is not null), 0)), 0) as standalone_pct),
  -- o que precisa dos detalhes do evento: só as linhas daquele tipo
  vk as (select coalesce(round(avg((props->>'voice')::numeric)), 0) as voice_pct from app_events
    where name = 'match_end' and created_at >= t0 and created_at < tend and props->>'voice' ~ '^[0-9.]+$'),
  pro as (
    select s.plan from subscriptions s where s.status in ('trial', 'ativa') and (s.current_period_end is null or s.current_period_end > now())
    union all
    select 'cortesia' from profiles p where p.pro_until > now() and not exists (select 1 from subscriptions s where s.user_id = p.id and s.status in ('trial', 'ativa'))
  ),
  kpi as (
    select jsonb_build_object(
      'visits', (select visits from wk), 'visits_prev', (select visits_prev from wk),
      'active', (select active from ek), 'active_prev', (select active_prev from ek),
      'users', (select count(*) from profiles where deleted_at is null),
      'users_new', (select count(*) from profiles where created_at >= t0 and created_at < tend),
      'users_new_prev', (select count(*) from profiles where created_at >= p0 and created_at < t0),
      'pro', (select count(*) from pro),
      'pro_paying', (select count(*) from pro where plan <> 'cortesia'),
      'mrr', (select coalesce(sum(pp.monthly), 0) from pro join plan_prices pp using (plan)),
      'matches', (select count(*) from matches where created_at >= t0 and created_at < tend and deleted_at is null),
      'matches_prev', (select count(*) from matches where created_at >= p0 and created_at < t0 and deleted_at is null),
      'matches_total', (select count(*) from matches where deleted_at is null),
      'groups', (select count(*) from groups where deleted_at is null),
      'reports_open', (select count(*) from reports where status in ('aberta', 'em_analise')),
      'ai_runs', (select count(*) from ai_usage where created_at >= t0 and created_at < tend),
      'ai_tokens_in', (select coalesce(sum(input_tokens), 0) from ai_usage where created_at >= t0 and created_at < tend),
      'ai_tokens_out', (select coalesce(sum(output_tokens), 0) from ai_usage where created_at >= t0 and created_at < tend),
      'ai_users', (select count(distinct user_id) from ai_usage where created_at >= t0 and created_at < tend),
      -- uso (só aparelhos com estatísticas ligadas): agora = últimos 15 min; dia/semana/mês até agora
      'live_now', (select count(distinct device_id) from app_events where created_at > now() - interval '15 minutes'),
      'dau', (select count(distinct device_id) from app_events where name = 'app_open' and not session and created_at > now() - interval '1 day'),
      'wau', (select count(distinct device_id) from app_events where name = 'app_open' and not session and created_at > now() - interval '7 days'),
      'mau', (select count(distinct device_id) from app_events where name = 'app_open' and not session and created_at > now() - interval '30 days'),
      'installs', (select installs from ek), 'standalone_pct', (select standalone_pct from wk), 'voice_pct', (select voice_pct from vk),
      'recs', (select recs from ek), 'shares', (select shares from ek), 'invites', (select invites from ek), 'feedbacks', (select feedbacks from ek),
      'subs_new', (select count(*) from subscriptions where created_at >= t0 and created_at < tend and provider <> 'cortesia'),
      'subs_cancel', (select count(*) from subscriptions where status in ('cancelada', 'encerrada') and updated_at >= t0 and updated_at < tend),
      'users_deleted', (select count(*) from profiles where deleted_at >= t0 and deleted_at < tend),
      'groups_new', (select count(*) from groups where created_at >= t0 and created_at < tend and deleted_at is null),
      'posts', (select count(*) from group_posts where created_at >= t0 and created_at < tend and deleted_at is null),
      -- comunidade: marcações (sem contar o dono), bloqueios e pedidos entre jogadores
      'tags_new', (select count(*) from match_players mp join matches m on m.id = mp.match_id where mp.created_at >= t0 and mp.created_at < tend and mp.user_id is not null and mp.user_id <> m.owner_id),
      'tags_accepted', (select count(*) from match_players mp join matches m on m.id = mp.match_id where mp.created_at >= t0 and mp.created_at < tend and mp.user_id is not null and mp.user_id <> m.owner_id and mp.tag_status = 'aceito'),
      'tags_refused', (select count(*) from match_players mp join matches m on m.id = mp.match_id where mp.created_at >= t0 and mp.created_at < tend and mp.user_id is not null and mp.user_id <> m.owner_id and mp.tag_status = 'recusado'),
      'blocks_new', (select count(*) from blocks where created_at >= t0 and created_at < tend),
      'del_open', (select count(*) from match_delete_requests where status = 'aberto'),
      'fix_open', (select count(*) from match_corrections where status = 'aberto'),
      'fixes_done', (select count(*) from match_corrections where status = 'aprovado' and closed_at >= t0 and closed_at < tend),
      'trials', (select count(*) from subscriptions where status = 'trial' and (current_period_end is null or current_period_end > now())),
      -- saúde do app: erros que o app mandou (só aparelhos com estatísticas ligadas; sem mensagem, só arquivo e linha)
      'errors', (select errors from ek), 'errors_devices', (select errors_devices from ek), 'errors_prev', (select errors_prev from ek)
    ) as v
  ),
  days_s as (select generate_series(t0, date_trunc('day', tend - interval '1 second'), interval '1 day') as day),
  daily as (
    select jsonb_agg(jsonb_build_object('day', to_char(ds.day, 'YYYY-MM-DD'), 'visits', coalesce(w.n, 0), 'active', coalesce(e.n, 0),
      'signups', coalesce(pr.n, 0), 'matches', coalesce(mt.n, 0)) order by ds.day) as v
    from days_s ds
    left join (select day::timestamptz as day, sum(visitors) n from web_daily where area in ('site', 'app') and dim = 'all' and day >= t0::date and day < lf group by 1
      union all
      select day, sum(n) from (select area, date_trunc('day', started_at) as day, count(distinct device_id) n from web_sessions
        where area in ('site', 'app') and started_at >= greatest(t0, lf::timestamptz) and started_at < tend group by 1, 2) x group by 1) w on w.day = ds.day
    left join (select date_trunc('day', created_at) as day, count(distinct device_id) n from cur where name = 'app_open' and not session group by 1) e on e.day = ds.day
    left join (select date_trunc('day', created_at) as day, count(*) n from profiles where created_at >= t0 and created_at < tend group by 1) pr on pr.day = ds.day
    left join (select date_trunc('day', created_at) as day, count(*) n from matches where created_at >= t0 and created_at < tend and deleted_at is null group by 1) mt on mt.day = ds.day
  ),
  sports as (select coalesce(jsonb_agg(jsonb_build_object('sport', sport, 'n', n) order by n desc), '[]') as v from (select sport, count(*) n from matches where created_at >= t0 and created_at < tend and deleted_at is null group by sport) x),
  funnel as (
    select jsonb_build_array(
      jsonb_build_object('step', 'visit', 'n', (select count(*) from (select distinct device_id from ws where consent) v)),
      jsonb_build_object('step', 'signup', 'n', (select count(distinct device_id) from cur where name = 'signup')),
      jsonb_build_object('step', 'match_start', 'n', (select count(distinct device_id) from cur where name = 'match_start')),
      jsonb_build_object('step', 'match_end', 'n', (select count(distinct device_id) from cur where name = 'match_end')),
      jsonb_build_object('step', 'share', 'n', (select count(distinct device_id) from cur where name = 'share')),
      jsonb_build_object('step', 'pro_start', 'n', (select count(distinct device_id) from cur where name = 'pro_start'))
    ) as v
  ),
  -- origem de cada aparelho: a primeira fonte vista no período (utm ou convite); sem nada, "direto"
  -- só as visitas com origem marcada (utm ou convite) passam pela conta por aparelho; o resto é "direto"
  sg as (select distinct device_id from cur where name = 'signup'),
  tagged as (select distinct on (device_id) device_id, source as src, medium as med from ws where source is not null order by device_id, started_at),
  invited as (select distinct w.device_id from ws w where w.channel = 'convite' and w.source is null and not exists (select 1 from tagged t where t.device_id = w.device_id)),
  sources as (
    select coalesce(jsonb_agg(jsonb_build_object('source', src, 'medium', med, 'visits', visits, 'signups', signups) order by visits desc), '[]') as v from (
      select * from (
        select src, coalesce(med, '') med, count(*) visits, count(sg.device_id) signups from tagged left join sg using (device_id) group by 1, 2
        union all select 'convite', '', count(*), count(sg.device_id) from invited left join sg using (device_id)
        union all select 'direto', '', greatest(0, (select visits from wk) - (select count(*) from tagged) - (select count(*) from invited)),
          (select count(*) from sg where not exists (select 1 from tagged t where t.device_id = sg.device_id) and not exists (select 1 from invited i where i.device_id = sg.device_id))
      ) y where visits > 0 order by visits desc limit 12) z
  ),
  -- retenção semanal: de quem fez a 1ª abertura (com consentimento) em cada semana, quantos voltaram nas semanas seguintes
  app_s as materialized (select device_id, date_trunc('week', started_at) as wk from web_sessions
    where area = 'app' and consent and started_at >= date_trunc('week', now()) - interval '7 weeks' group by 1, 2),
  firsts as (select device_id, min(wk) as wk from app_s group by device_id),
  weeks_back as (select f.device_id, f.wk, (extract(epoch from s.wk - f.wk) / 604800)::int as w from firsts f join app_s s using (device_id)),
  retention as (
    select coalesce(jsonb_agg(jsonb_build_object('week', to_char(wk, 'YYYY-MM-DD'), 'size', size, 'w1', w1, 'w2', w2, 'w3', w3, 'w4', w4) order by wk), '[]') as v from (
      select wk, count(distinct device_id) filter (where w = 0) size,
        count(distinct device_id) filter (where w = 1) w1, count(distinct device_id) filter (where w = 2) w2,
        count(distinct device_id) filter (where w = 3) w3, count(distinct device_id) filter (where w = 4) w4
      from weeks_back group by wk) r
  ),
  plans as (select coalesce(jsonb_agg(jsonb_build_object('plan', plan, 'n', n) order by n desc), '[]') as v from (select plan, count(*) n from pro group by plan) p),
  events_top as (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc), '[]') as v from (select name, count(*) n from cur group by name order by count(*) desc limit 15) e),
  -- versões do app em uso (aparelhos distintos que abriram no período)
  versions as (select coalesce(jsonb_agg(jsonb_build_object('version', ver, 'n', n) order by n desc), '[]') as v from (select coalesce(app_version, '?') ver, count(distinct device_id) n from cur where name = 'app_open' group by 1 order by 2 desc limit 8) x),
  -- quando se joga: partidas por dia da semana (0 = domingo) e hora, no horário de Brasília
  hours as (select coalesce(jsonb_agg(jsonb_build_object('d', dw, 'h', hr, 'n', n)), '[]') as v from (
    select extract(dow from played_at at time zone 'America/Sao_Paulo')::int dw, extract(hour from played_at at time zone 'America/Sao_Paulo')::int hr, count(*) n
    from matches where played_at >= t0 and played_at < tend and deleted_at is null group by 1, 2) h),
  -- taxas: cancelamento (clientes e receita), teste → pago, ativação e retenção D1/D7/D30 de quem chegou no período
  paid as (select s.*, pp.monthly from subscriptions s join plan_prices pp using (plan) where s.provider <> 'cortesia'),
  firsts_p as (select x.device_id, x.f from (select device_id, min(created_at) f from cur where name = 'app_open' and not session group by device_id) x
    where not exists (select 1 from app_events e where e.device_id = x.device_id and e.name = 'app_open' and not e.session and e.created_at < t0)),
  sign_p as (select device_id, min(created_at) f from cur where name = 'signup' group by device_id),
  rates as (select jsonb_build_object(
      'paying_start', (select count(*) from paid where status <> 'trial' and created_at < t0 and (current_period_end is null or current_period_end > t0)),
      'mrr_start', (select coalesce(sum(monthly), 0) from paid where status <> 'trial' and created_at < t0 and (current_period_end is null or current_period_end > t0)),
      'canceled', (select count(*) from paid where status in ('cancelada', 'encerrada') and updated_at >= t0 and updated_at < tend),
      'mrr_lost', (select coalesce(sum(monthly), 0) from paid where status in ('cancelada', 'encerrada') and updated_at >= t0 and updated_at < tend),
      'mrr_new', (select coalesce(sum(monthly), 0) from paid where status <> 'trial' and created_at >= t0 and created_at < tend),
      -- teste grátis de 14 dias: quem começou há mais de 14 dias e já pagou (aproximação sem o histórico de cada mudança)
      'trial_total', (select count(*) from paid where created_at >= t0 - interval '14 days' and created_at < least(tend, now() - interval '14 days')),
      'trial_paid', (select count(*) from paid where created_at >= t0 - interval '14 days' and created_at < least(tend, now() - interval '14 days') and status in ('ativa', 'cancelada', 'atrasada')),
      -- ativação: criou conta e terminou uma partida em até 7 dias
      'act_signups', (select count(*) from sign_p),
      'act_done', (select count(*) from sign_p s where exists (select 1 from app_events e where e.device_id = s.device_id and e.name = 'match_end' and e.created_at >= s.f and e.created_at < s.f + interval '7 days')),
      'ret_base1', (select count(*) from firsts_p where f + interval '2 days' <= now()),
      'ret_d1', (select count(*) from firsts_p x where f + interval '2 days' <= now() and exists (select 1 from app_events e where e.device_id = x.device_id and e.name = 'app_open' and not e.session and e.created_at >= x.f + interval '1 day' and e.created_at < x.f + interval '2 days')),
      'ret_base7', (select count(*) from firsts_p where f + interval '8 days' <= now()),
      'ret_d7', (select count(*) from firsts_p x where f + interval '8 days' <= now() and exists (select 1 from app_events e where e.device_id = x.device_id and e.name = 'app_open' and not e.session and e.created_at >= x.f + interval '7 days' and e.created_at < x.f + interval '8 days')),
      'ret_base30', (select count(*) from firsts_p where f + interval '31 days' <= now()),
      'ret_d30', (select count(*) from firsts_p x where f + interval '31 days' <= now() and exists (select 1 from app_events e where e.device_id = x.device_id and e.name = 'app_open' and not e.session and e.created_at >= x.f + interval '30 days' and e.created_at < x.f + interval '31 days'))
    ) as v),
  -- onde estão as contas (cidade do perfil, as 8 mais comuns)
  cities as (select coalesce(jsonb_agg(jsonb_build_object('city', city, 'n', n) order by n desc), '[]') as v from (
    select city, count(*) n from profiles where deleted_at is null and coalesce(trim(city), '') <> '' group by city order by 2 desc limit 8) c),
  -- onde o app mais quebra: arquivo e linha (props.where), os 6 mais comuns
  errors_top as (select coalesce(jsonb_agg(jsonb_build_object('where', w, 'kind', k, 'n', n, 'devices', dv) order by n desc), '[]') as v from (
    select coalesce(props ->> 'where', '?') w, coalesce(props ->> 'kind', '') k, count(*) n, count(distinct device_id) dv from app_events
    where name = 'js_error' and created_at >= t0 and created_at < tend group by 1, 2 order by 3 desc limit 6) e),
  -- receita mensal dia a dia (assinaturas pagas valendo em cada dia, pelos preços de plan_prices)
  subs_p as (select s.created_at, s.current_period_end, s.status, pp.monthly from subscriptions s join plan_prices pp using (plan)
    where s.provider <> 'cortesia' and s.status in ('trial', 'ativa', 'cancelada', 'atrasada') and s.created_at < tend and (s.current_period_end is null or s.current_period_end > t0)),
  mrr_daily as (select jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'mrr', mrr, 'paying', paying) order by day) as v from (
    select ds.day, coalesce(sum(sp.monthly), 0) as mrr, count(sp.created_at) filter (where sp.status <> 'trial') as paying
    from days_s ds left join subs_p sp on sp.created_at < ds.day + interval '1 day' and (sp.current_period_end is null or sp.current_period_end > ds.day)
    group by ds.day) m)
  select jsonb_build_object('days', d, 'from', to_char(t0, 'YYYY-MM-DD'), 'generated_at', now(), 'kpi', kpi.v, 'daily', daily.v, 'sports', sports.v, 'funnel', funnel.v,
    'sources', sources.v, 'retention', retention.v, 'plans', plans.v, 'events', events_top.v, 'versions', versions.v, 'hours', hours.v,
    'cities', cities.v, 'errors_top', errors_top.v, 'mrr_daily', mrr_daily.v, 'rates', rates.v, 'role', admin_role(), 'mfa_age_min', admin_mfa_age_min(),
    'to', to_char(tend - interval '1 second', 'YYYY-MM-DD'))
  into out from kpi, daily, sports, funnel, sources, retention, plans, events_top, versions, hours, cities, errors_top, mrr_daily, rates;
  return out;
end $$;
revoke execute on function public.admin_metrics(int, date) from public, anon;
grant execute on function public.admin_metrics(int, date) to authenticated;

-- ---------- ações do painel (só admin; cada uma fica registrada em admin_log) ----------
create table public.admin_log (
  id          bigserial primary key,
  admin_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target      text,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.admin_log enable row level security;
create policy admin_log_read on public.admin_log for select using (public.admin_role() in ('dono', 'moderador'));
revoke all on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;    -- a regra admin_log_read deixa só admin ler; escrever, só as funções abaixo
revoke all on sequence public.admin_log_id_seq from anon, authenticated;

-- need: papel mínimo; fresh_min: ação sensível pede o código digitado há no máximo tantos minutos (senão, o painel pede de novo)
create or replace function public.admin_guard(need text default 'leitor', fresh_min integer default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := admin_role(); ranks text[] := array['leitor', 'moderador', 'dono'];
begin
  if r is null then raise exception 'acesso só para administradores' using errcode = '42501'; end if;
  if array_position(ranks, r) < array_position(ranks, need) then raise exception 'sem_permissao (precisa ser %)', need using errcode = '42501'; end if;
  if fresh_min is not null and admin_mfa_age_min() > fresh_min then
    raise exception 'codigo_recente: digite o código do autenticador de novo' using errcode = '28000';
  end if;
  return r;
end $$;

-- busca de contas (nome, @, código UP-… ou e-mail); sem busca, as mais recentes
-- e-mail aparece mascarado (an***@gmail.com); só o dono vê inteiro, com código recente, e isso fica no registro
create or replace function public.mask_email(e text) returns text
language sql immutable as $$ select case when e is null then null when position('@' in e) < 2 then '***' else left(split_part(e, '@', 1), 2) || '***@' || split_part(e, '@', 2) end $$;
create or replace function public.admin_users(q text default '', lim int default 50, reveal boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare pat text := '%' || replace(replace(replace(coalesce(trim(q), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform admin_guard('moderador');
  if reveal then
    perform admin_guard('dono', 480);
    insert into admin_log (admin_id, action, target, detail) values (auth.uid(), 'emails_view', left(coalesce(q, ''), 60), '{}');
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') from (
    select p.public_id, p.handle::text as handle, p.name, p.city, p.created_at, p.deleted_at is not null as deleted,
      case when reveal then u.email else mask_email(u.email) end as email,
      s.plan, s.status as sub_status, p.pro_until, exists (select 1 from admins a where a.user_id = p.id) as is_admin,
      (select count(*) from matches m where m.owner_id = p.id and m.deleted_at is null) as matches,
      (select max(m.played_at) from matches m where m.owner_id = p.id and m.deleted_at is null) as last_match,
      (select count(*) from group_members g where g.user_id = p.id and g.status = 'ativo') as groups,
      (select count(*) from reports r where r.target_user_id = p.id) as reported
    from profiles p left join auth.users u on u.id = p.id left join subscriptions s on s.user_id = p.id
    where coalesce(trim(q), '') = '' or p.name ilike pat or p.handle::text ilike pat or p.public_id ilike pat or u.email ilike pat
    order by p.created_at desc limit greatest(1, least(coalesce(lim, 50), 200))) x);
end $$;

-- Pro de cortesia: soma dias ao que a pessoa já tem (0 = tira a cortesia)
create or replace function public.admin_grant_pro(pid text, days int default 30) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare d int := greatest(0, least(coalesce(days, 30), 366)); uid uuid; until timestamptz;
begin
  perform admin_guard('dono', 480);
  if (select count(*) from admin_log where admin_id = auth.uid() and action in ('pro_grant', 'pro_revoke') and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'limite_de_cortesias: 30 por dia' using errcode = '54000';
  end if;
  select id into uid from profiles where public_id = upper(pid) and deleted_at is null;
  if uid is null then raise exception 'conta não encontrada' using errcode = 'P0002'; end if;
  update profiles set pro_until = case when d = 0 then null else greatest(coalesce(pro_until, now()), now()) + make_interval(days => d) end
    where id = uid returning pro_until into until;
  insert into admin_log (admin_id, action, target, detail) values (auth.uid(), case when d = 0 then 'pro_revoke' else 'pro_grant' end, upper(pid), jsonb_build_object('days', d));
  return until;
end $$;

-- fila de denúncias, com o que foi denunciado e quantas vezes
create or replace function public.admin_reports(st text default 'abertas', lim int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard('moderador');
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') from (
    select r.id, r.category, r.reason, r.status, r.created_at, r.handled_at, rp.public_id as reporter,
      case when r.target_post_id is not null then 'post' when r.target_match_id is not null then 'partida' when r.target_group_id is not null then 'grupo' else 'conta' end as kind,
      coalesce(left(gp.text, 120), m.code || coalesce(' · ' || m.title, ''), g.name || ' · ' || g.code, tu.name || ' · ' || tu.public_id) as target,
      coalesce(gp.deleted_at, m.deleted_at, g.deleted_at) is not null as removed,
      (select count(*) from reports r2 where r2.target_post_id is not distinct from r.target_post_id and r2.target_match_id is not distinct from r.target_match_id
        and r2.target_group_id is not distinct from r.target_group_id and r2.target_user_id is not distinct from r.target_user_id) as same_target
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    left join group_posts gp on gp.id = r.target_post_id
    left join matches m on m.id = r.target_match_id
    left join groups g on g.id = r.target_group_id
    left join profiles tu on tu.id = r.target_user_id
    where case st when 'abertas' then r.status in ('aberta', 'em_analise') when 'todas' then true else r.status = st end
    order by r.created_at desc limit greatest(1, least(coalesce(lim, 100), 300))) x);
end $$;

-- responder a uma denúncia; remove = tira do ar o post, a partida ou o grupo denunciado (contas não são apagadas por aqui)
create or replace function public.admin_handle_report(rid uuid, st text, remove boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  perform admin_guard('moderador', case when remove then 480 end);   -- tirar do ar pede código recente
  if (select count(*) from admin_log where admin_id = auth.uid() and action like 'report_%' and created_at > now() - interval '24 hours') >= 300 then
    raise exception 'limite_de_acoes: 300 por dia' using errcode = '54000';
  end if;
  if st not in ('em_analise', 'resolvida', 'descartada') then raise exception 'situação inválida' using errcode = '22023'; end if;
  select * into r from reports where id = rid;
  if not found then raise exception 'denúncia não encontrada' using errcode = 'P0002'; end if;
  update reports set status = st, handled_at = case when st = 'em_analise' then null else now() end where id = rid;
  if remove and st = 'resolvida' then
    if r.target_post_id is not null then update group_posts set deleted_at = coalesce(deleted_at, now()) where id = r.target_post_id;
    elsif r.target_match_id is not null then update matches set deleted_at = coalesce(deleted_at, now()) where id = r.target_match_id;
    elsif r.target_group_id is not null then update groups set deleted_at = coalesce(deleted_at, now()) where id = r.target_group_id;
    end if;
  end if;
  insert into admin_log (admin_id, action, target, detail) values (auth.uid(), 'report_' || st, rid::text, jsonb_build_object('remove', remove and st = 'resolvida'));
  return st;
end $$;

-- grupos mais movimentados no período
create or replace function public.admin_groups(days int default 30, lim int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t0 timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(days, 365)) - 1);
begin
  perform admin_guard('leitor');
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.matches desc, x.members desc), '[]') from (
    select g.code, g.name, g.sport, g.open, g.created_at,
      (select count(*) from group_members gm where gm.group_id = g.id and gm.status = 'ativo') as members,
      (select count(*) from group_members gm where gm.group_id = g.id and gm.status = 'pendente') as pending,
      (select count(*) from matches m where m.group_id = g.id and m.played_at >= t0 and m.deleted_at is null) as matches,
      (select count(*) from group_posts gp where gp.group_id = g.id and gp.created_at >= t0 and gp.deleted_at is null) as posts
    from groups g where g.deleted_at is null
    order by 8 desc, 6 desc limit greatest(1, least(coalesce(lim, 20), 100))) x);
end $$;

revoke execute on function public.admin_guard(text, integer), public.admin_role(), public.admin_mfa_age_min(), public.admin_users(text, int, boolean), public.admin_grant_pro(text, int), public.admin_reports(text, int),
  public.admin_handle_report(uuid, text, boolean), public.admin_groups(int, int) from public, anon;
grant execute on function public.admin_guard(text, integer), public.admin_role(), public.admin_mfa_age_min(), public.admin_users(text, int, boolean), public.admin_grant_pro(text, int), public.admin_reports(text, int),
  public.admin_handle_report(uuid, text, boolean), public.admin_groups(int, int) to authenticated;

-- ---------- segurança do painel ----------
-- o registro de ações não muda nem some (nem por admin): só as funções do painel escrevem nele
create or replace function public.admin_log_frozen() returns trigger
language plpgsql as $$
begin
  -- única exceção: conta de admin apagada (a chave estrangeira só tira o vínculo; a ação continua registrada)
  if tg_op = 'UPDATE' and new.admin_id is null and old.admin_id is not null
     and (new.id, new.action, new.target, new.detail, new.created_at) is not distinct from (old.id, old.action, old.target, old.detail, old.created_at) then
    return new;
  end if;
  raise exception 'o registro de ações não pode ser alterado nem apagado' using errcode = '42501';
end $$;
create trigger admin_log_frozen before update or delete on public.admin_log for each row execute function public.admin_log_frozen();

-- entrada no painel: registra o acesso (aparelho e IP, uma vez a cada 30 min por aparelho) e avisa se o aparelho é novo
create or replace function public.admin_hello() returns jsonb
language plpgsql security definer set search_path = public as $$
declare h jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  ua text := left(coalesce(h ->> 'user-agent', '?'), 160);
  ip text := left(trim(split_part(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-forwarded-for', h ->> 'x-real-ip', '?'), ',', 1)), 45);
  r text := admin_guard('leitor'); last timestamptz; seen boolean;
begin
  select max(created_at) into last from admin_log where admin_id = auth.uid() and action = 'login';
  seen := exists (select 1 from admin_log where admin_id = auth.uid() and action = 'login' and detail ->> 'ua' = ua and created_at > now() - interval '90 days');
  if not exists (select 1 from admin_log where admin_id = auth.uid() and action = 'login' and detail ->> 'ua' = ua and created_at > now() - interval '30 minutes') then
    insert into admin_log (admin_id, action, target, detail) values (auth.uid(), 'login', r, jsonb_build_object('ua', ua, 'ip', ip, 'new_device', not seen));
  end if;
  return jsonb_build_object('role', r, 'last_login', last, 'new_device', not seen, 'mfa_age_min', admin_mfa_age_min());
end $$;

-- acessos ao painel (o dono vê de todos; os outros, só os próprios)
create or replace function public.admin_access(lim int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text := admin_guard('leitor');
begin
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') from (
    select l.created_at, p.name as admin, l.detail ->> 'ip' as ip, l.detail ->> 'ua' as ua, coalesce((l.detail ->> 'new_device')::boolean, false) as new_device
    from admin_log l left join profiles p on p.id = l.admin_id
    where l.action = 'login' and (r = 'dono' or l.admin_id = auth.uid())
    order by l.created_at desc limit greatest(1, least(coalesce(lim, 30), 100))) x);
end $$;

-- a equipe: papel, situação e último acesso (só o dono)
create or replace function public.admin_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard('dono');
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.role, x.name), '[]') from (
    select p.name, p.public_id, a.role, a.disabled_at is not null as disabled, a.created_at,
      (select max(l.created_at) from admin_log l where l.admin_id = a.user_id and l.action = 'login') as last_login
    from admins a join profiles p on p.id = a.user_id) x);
end $$;

-- baixar planilha fica registrado; a de contas (com e-mail) é só do dono, com código recente
create or replace function public.admin_note_export(what text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if what = 'contas' then perform admin_guard('dono', 480); else perform admin_guard('leitor'); end if;
  insert into admin_log (admin_id, action, target, detail) values (auth.uid(), 'export', left(what, 30), '{}');
  return true;
end $$;
revoke execute on function public.admin_hello(), public.admin_access(int), public.admin_team(), public.admin_note_export(text), public.admin_log_frozen() from public, anon;
revoke execute on function public.admin_log_frozen() from authenticated;   -- só o gatilho usa
grant execute on function public.admin_hello(), public.admin_access(int), public.admin_team(), public.admin_note_export(text) to authenticated;

-- ---------- links rastreáveis (UTM) ----------
-- Cada link tem um código (slug) que vai no utm_content; origem, meio e campanha vão em utm_source, utm_medium e utm_campaign.
-- O app guarda o 1º toque no aparelho e manda junto em cada evento, então dá para ver visitas, contas, 1ª partida e Pro por link.
create table public.tracked_links (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  label       text not null check (char_length(label) between 1 and 60 and public.plain_text(label)),
  dest        text not null default 'app' check (dest in ('app', 'site', 'beach', 'padel', 'tenis', 'peteca')),
  source      text not null check (source ~ '^[a-z0-9_.-]{1,40}$'),
  medium      text not null check (medium ~ '^[a-z0-9_.-]{1,40}$'),
  campaign    text not null check (campaign ~ '^[a-z0-9_.-]{1,40}$'),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.tracked_links enable row level security;
create policy links_read on public.tracked_links for select using (public.is_admin());
revoke all on public.tracked_links from anon, authenticated;
grant select on public.tracked_links to authenticated;   -- escrever, só pela função abaixo
create index app_events_content on public.app_events (content, created_at) where content is not null;
create index app_events_source on public.app_events (source, created_at) where source is not null;

-- criar ou editar um link (moderador ou dono); arquivar = some da lista, os números ficam
create or replace function public.admin_link_save(slug text, label text, dest text, source text, medium text, campaign text, archive boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare clean text := lower(trim(slug)); out tracked_links;
begin
  perform admin_guard('moderador');
  if (select count(*) from admin_log where admin_id = auth.uid() and action = 'link_save' and created_at > now() - interval '24 hours') >= 200 then
    raise exception 'limite_de_links: 200 por dia' using errcode = '54000';
  end if;
  insert into tracked_links as t (slug, label, dest, source, medium, campaign, created_by)
    values (clean, trim(label), coalesce(dest, 'app'), lower(trim(source)), lower(trim(medium)), lower(trim(campaign)), auth.uid())
  on conflict on constraint tracked_links_pkey do update set label = excluded.label, dest = excluded.dest, source = excluded.source, medium = excluded.medium,
    campaign = excluded.campaign, archived_at = case when archive then coalesce(t.archived_at, now()) else null end
  returning * into out;
  insert into admin_log (admin_id, action, target, detail) values (auth.uid(), 'link_save', clean, jsonb_build_object('archive', archive));
  return to_jsonb(out);
end $$;

-- links com os números do período, e o tráfego por origem e campanha (dia a dia)
create or replace function public.admin_links(days int default 30, ate date default null) returns jsonb
language plpgsql stable security definer set search_path = public set work_mem = '64MB' as $$
declare d int := greatest(1, least(days, 730));
  tend timestamptz := case when ate is null then now() else least(now(), (ate + 1)::timestamptz) end;
  t0 timestamptz := date_trunc('day', tend - interval '1 second') - make_interval(days => d - 1);
begin
  perform admin_guard('leitor');
  return (with cur as (select device_id, name, source, medium, campaign, content, created_at from app_events
      where created_at >= t0 and created_at < tend and name not in ('visit_end', 'screen')),
  -- por aparelho: o 1º toque do período (origem, meio, campanha, link) e o que ele fez depois
  dev as (select device_id,
      (array_agg(source order by created_at) filter (where source is not null))[1] as src,
      (array_agg(medium order by created_at) filter (where medium is not null))[1] as med,
      (array_agg(campaign order by created_at) filter (where campaign is not null))[1] as cmp,
      (array_agg(content order by created_at) filter (where content is not null))[1] as cnt,
      bool_or(name = 'signup') as signed, bool_or(name = 'match_end') as played, bool_or(name = 'pro_start') as pro,
      min(created_at) as first_at
    from cur group by device_id),
  links as (select coalesce(jsonb_agg(jsonb_build_object('slug', l.slug, 'label', l.label, 'dest', l.dest, 'source', l.source, 'medium', l.medium, 'campaign', l.campaign,
      'created_at', l.created_at, 'archived', l.archived_at is not null,
      'visits', (select count(*) from dev where cnt = l.slug), 'signups', (select count(*) from dev where cnt = l.slug and signed),
      'played', (select count(*) from dev where cnt = l.slug and played), 'pro', (select count(*) from dev where cnt = l.slug and pro)) order by l.created_at desc), '[]') as v
    from tracked_links l),
  by_source as (select coalesce(jsonb_agg(jsonb_build_object('source', src, 'visits', n, 'signups', sg, 'pro', pr) order by n desc), '[]') as v from (
    select coalesce(src, 'direto') src, count(*) n, count(*) filter (where signed) sg, count(*) filter (where pro) pr from dev group by 1 order by 2 desc limit 12) x),
  by_campaign as (select coalesce(jsonb_agg(jsonb_build_object('campaign', cmp, 'source', src, 'visits', n, 'signups', sg, 'played', pl, 'pro', pr) order by n desc), '[]') as v from (
    select cmp, string_agg(distinct coalesce(src, '?'), ', ') src, count(*) n, count(*) filter (where signed) sg, count(*) filter (where played) pl, count(*) filter (where pro) pr
    from dev where cmp is not null group by cmp order by 3 desc limit 20) x),
  top4 as (select coalesce(src, 'direto') src from dev group by 1 order by count(*) desc limit 4),
  daily as (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(dia, 'YYYY-MM-DD'), 'source', src, 'visits', n) order by dia), '[]') as v from (
    select date_trunc('day', first_at) as dia, case when coalesce(src, 'direto') in (select src from top4) then coalesce(src, 'direto') else 'outros' end src, count(*) n
    from dev group by 1, 2) x)
  select jsonb_build_object('days', d, 'from', to_char(t0, 'YYYY-MM-DD'), 'to', to_char(tend - interval '1 second', 'YYYY-MM-DD'),
    'links', links.v, 'sources', by_source.v, 'campaigns', by_campaign.v, 'daily', daily.v,
    'totals', jsonb_build_object('visits', (select count(*) from dev), 'tagged', (select count(*) from dev where src is not null), 'signups', (select count(*) from dev where signed), 'pro', (select count(*) from dev where pro)))
  from links, by_source, by_campaign, daily);
end $$;
revoke execute on function public.admin_link_save(text, text, text, text, text, text, boolean), public.admin_links(int, date) from public, anon;
grant execute on function public.admin_link_save(text, text, text, text, text, text, boolean), public.admin_links(int, date) to authenticated;


-- ---------- site e app: visitas, tempo, origem, público e mapa de calor ----------
-- Tudo sem nome, e-mail ou conteúdo. Sem consentimento: a página vista ("visit" no site, "app_open" no app) e, ao sair,
-- quanto tempo ficou e quanto rolou ("visit_end"), com o id da visita que some ao fechar a aba. Com consentimento: as telas
-- do app ("screen") e os cliques do mapa de calor (heat_clicks). Aparelho, navegador, sistema, idioma e fuso vão em props.
--
-- Para o painel não ficar lento com milhões de eventos:
--  · o banco copia de props para colunas próprias o que o painel lê (área, página, aparelho, tempo, rolagem), e um índice
--    cobre essas colunas: contar páginas e tempos não abre a linha do evento;
--  · cada visita vira uma linha em web_sessions na hora em que chega (páginas, entrada, saída, canal, aparelho, tempo):
--    o painel lê uma linha por visita em vez de juntar todos os eventos.
alter table public.app_events
  add column area text check (area in ('site', 'app')),
  add column page text check (page ~ '^[a-z0-9._-]{1,40}$'),
  add column dev  text check (dev in ('m', 't', 'd')),
  add column ms   integer check (ms between 0 and 3600000),     -- até 1 h por página (aba esquecida aberta não conta mais)
  add column sc   smallint check (sc between 0 and 100);
-- (essas colunas o banco preenche; o app não manda: não estão no grant de insert)

-- canal de cada visita, a partir do 1º toque (convite, utm ou o site que mandou a pessoa)
create or replace function public.web_channel(src text, med text, rf text, ref text) returns text
language sql immutable set search_path = public as $$
  select case
    when ref is not null then 'convite'
    when med ~ '^(cpc|ppc|paid|ads?|anuncio|paid_social|paidsocial)$' then 'anúncio'
    when med = 'email' or src = 'email' then 'e-mail'
    when coalesce(src, '') ~ '^(instagram|ig|facebook|fb|tiktok|youtube|yt|linkedin|whatsapp|wa|zap|pinterest|reddit|threads|kwai|telegram|twitter|x)$'
      or coalesce(rf, '') ~ '(^|\.)(instagram|facebook|fb|tiktok|youtube|youtu|linkedin|lnkd|whatsapp|pinterest|reddit|threads|kwai|telegram|twitter)\.'
      or rf in ('t.co', 'x.com', 'wa.me') then 'social'
    when coalesce(src, '') ~ '^(google|bing|yahoo|duckduckgo)$' or coalesce(rf, '') ~ '(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|brave)\.' then 'busca'
    when src is not null then 'campanha'
    when rf is not null then 'outros sites'
    else 'direto' end
$$;

create or replace function public.events_fill() returns trigger language plpgsql set search_path = public as $$
declare pg text; v text;
begin
  new.area := case when new.name = 'visit' or (new.name = 'visit_end' and coalesce(new.props ->> 'a', 'site') = 'site') then 'site' else 'app' end;
  pg := case new.name when 'visit' then coalesce(nullif(new.props ->> 'page', ''), 'index')
                      when 'visit_end' then coalesce(nullif(new.props ->> 'pg', ''), case when new.area = 'site' then 'index' else 'app' end)
                      when 'screen' then new.props ->> 'v'
                      when 'app_open' then 'app' end;
  new.page := case when pg ~ '^[a-z0-9._-]{1,40}$' then pg end;
  new.dev := case when new.props ->> 'dv' in ('m', 't', 'd') then new.props ->> 'dv' end;
  v := new.props ->> 'ms'; new.ms := case when v ~ '^[0-9]{1,9}(\.[0-9]+)?$' then least(round(v::numeric), 3600000)::int end;
  v := new.props ->> 'sc'; new.sc := case when v ~ '^[0-9]{1,3}(\.[0-9]+)?$' then least(round(v::numeric), 100)::smallint end;
  return new;
end $$;
create trigger app_events_fill before insert on public.app_events for each row execute function public.events_fill();

-- uma linha por visita (aba aberta), por área: o site e o app na mesma aba são visitas separadas
create table public.web_sessions (
  area       text not null check (area in ('site', 'app')),
  sid        text not null check (sid ~ '^[a-z0-9]{8,32}$'),
  device_id  text not null check (device_id ~ '^[a-z0-9]{8,32}$'),
  started_at timestamptz not null,
  last_at    timestamptz not null,
  pages      integer not null default 1 check (pages between 0 and 100000),
  entry      text check (entry ~ '^[a-z0-9._-]{1,40}$'),
  exit       text check (exit ~ '^[a-z0-9._-]{1,40}$'),
  channel    text not null check (char_length(channel) <= 20),
  referrer   text check (char_length(referrer) <= 60),
  source     text check (char_length(source) <= 40),
  medium     text check (char_length(medium) <= 40),
  campaign   text check (char_length(campaign) <= 40),
  dv text check (dv in ('m', 't', 'd')), br text check (char_length(br) <= 20), os text check (char_length(os) <= 20),
  lg text check (char_length(lg) <= 12), tz text check (char_length(tz) <= 40), sw text check (char_length(sw) <= 6),
  standalone boolean,
  consent    boolean not null,
  ms         integer not null default 0 check (ms between 0 and 86400000),
  timed      boolean not null default false,
  sc         smallint check (sc between 0 and 100),
  primary key (area, sid)
) with (fillfactor = 70);   -- espaço livre na página: a visita é atualizada no lugar (sem inchar a tabela)
create index web_sessions_time on public.web_sessions (area, started_at) include (device_id);   -- visitantes do período sem abrir a linha
create index web_sessions_device on public.web_sessions (device_id, started_at);
alter table public.web_sessions enable row level security;   -- sem regra: ninguém lê pela API, só as funções do painel
revoke all on public.web_sessions from anon, authenticated;

create or replace function public.events_session() returns trigger language plpgsql security definer set search_path = public as $$
declare s text := coalesce(new.sid, new.device_id); p jsonb := new.props;
begin
  if new.name in ('visit', 'app_open') then
    insert into web_sessions as w (area, sid, device_id, started_at, last_at, pages, entry, exit, channel, referrer, source, medium, campaign,
        dv, br, os, lg, tz, sw, standalone, consent)
      values (new.area, s, new.device_id, new.created_at, new.created_at, case when new.name = 'visit' then 1 else 0 end, new.page, new.page,
        web_channel(new.source, new.medium, new.referrer, new.ref), new.referrer, new.source, new.medium, new.campaign,
        new.dev, left(p ->> 'br', 20), left(p ->> 'os', 20), left(p ->> 'lg', 12), left(p ->> 'tz', 40), left(p ->> 'sw', 6),
        case when p ? 'standalone' then p ->> 'standalone' = 'true' end, not new.session)
    on conflict (area, sid) do update set
      pages = w.pages + case when new.name = 'visit' then 1 else 0 end,
      entry = case when excluded.started_at < w.started_at then excluded.entry else w.entry end,
      exit = case when excluded.last_at >= w.last_at then excluded.exit else w.exit end,
      started_at = least(w.started_at, excluded.started_at), last_at = greatest(w.last_at, excluded.last_at),
      consent = w.consent or excluded.consent;
  elsif new.name = 'visit_end' and new.ms is not null then
    update web_sessions set ms = least(ms + new.ms, 86400000), timed = true, sc = greatest(coalesce(sc, 0), coalesce(new.sc, 0)),
      last_at = greatest(last_at, new.created_at)
    where area = new.area and sid = s;
  end if;
  return null;
end $$;
create trigger app_events_session after insert on public.app_events for each row
  when (new.name in ('visit', 'app_open', 'visit_end')) execute function public.events_session();
revoke execute on function public.events_session(), public.events_fill() from public, anon, authenticated;
-- páginas, tempos e telas por período, lidos só do índice
create index app_events_pages on public.app_events (name, created_at) include (area, page, dev, ms, sc, device_id)
  where name in ('visit', 'visit_end', 'screen');
-- e só os eventos do app (sem visitas, saídas e telas): a Visão geral lê deste
create index app_events_app on public.app_events (created_at) include (name, device_id, session, app_version)
  where name not in ('visit', 'visit_end', 'screen');

-- cliques e toques (só com consentimento): onde na página, em que elemento e se foi clique "com raiva" (3+ seguidos no mesmo
-- lugar) ou "morto" (num lugar que não faz nada). x em milésimos da largura; y em px do topo do conteúdo. Sem texto da página.
create table public.heat_clicks (
  id         bigserial primary key,
  device_id  text not null check (device_id ~ '^[a-z0-9]{8,32}$'),
  area       text not null check (area in ('site', 'app')),
  page       text not null check (page ~ '^[a-z0-9._-]{1,40}$'),   -- site: arquivo (index, ajuda); app: tela (inicio, jogar)
  dev        text not null check (dev in ('m', 't', 'd')),          -- celular, tablet, computador
  x          smallint not null check (x between 0 and 1000),
  y          integer not null check (y between 0 and 60000),
  vw         smallint check (vw between 200 and 4000),              -- largura da tela, para desenhar no tamanho certo
  sel        text check (sel ~ '^[a-z0-9#._:=-]{1,60}$'),            -- elemento (tag, id, data-go…), nunca o texto dele
  rage       boolean not null default false,
  dead       boolean not null default false,
  created_at timestamptz not null default now()
);
create index heat_clicks_page on public.heat_clicks (area, page, dev, created_at) include (x, y);
create index heat_clicks_time on public.heat_clicks (created_at);
alter table public.heat_clicks enable row level security;
create policy heat_insert on public.heat_clicks for insert to anon, authenticated
  with check (created_at > now() - interval '2 days' and created_at < now() + interval '5 minutes');
create policy heat_admin on public.heat_clicks for select using (public.is_admin());
revoke all on public.heat_clicks from anon, authenticated;
grant insert (device_id, area, page, dev, x, y, vw, sel, rage, dead, created_at) on public.heat_clicks to anon, authenticated;
grant select on public.heat_clicks to authenticated;   -- a regra heat_admin deixa só admin ler
grant usage on sequence public.heat_clicks_id_seq to anon, authenticated;

-- os cliques ficam 90 dias (agendar uma vez por dia: select public.prune_heat_clicks();)
create or replace function public.prune_heat_clicks(keep_days int default 90) returns int
language sql security definer set search_path = public as $$
  with d as (delete from heat_clicks where created_at < now() - make_interval(days => greatest(keep_days, 7)) returning 1) select count(*)::int from d
$$;
revoke execute on function public.prune_heat_clicks(int) from public, anon, authenticated;

-- resumo por dia (dias fechados): o painel soma linhas prontas em vez de passar por todas as visitas do período.
-- Hoje e ontem vêm sempre na hora (visitas que ainda estão abertas); um dia que ainda não entrou no resumo também.
-- dim: all (totais do dia), channel, referrer, campaign (origem|meio|campanha), entry, exit, dv, br, os, lg, tz, sw,
-- hour (dia-da-semana:hora em Brasília), consent, standalone, pv (vistas por página ou tela), pt (tempo e rolagem
-- por página ou tela) e flow (de que tela para qual, no app)
create table public.web_daily (
  area    text not null check (area in ('site', 'app')),
  day     date not null,
  dim     text not null check (char_length(dim) <= 12),
  k       text not null check (char_length(k) <= 130),
  n       bigint not null default 0, bounces bigint not null default 0, ms_sum bigint not null default 0, timed bigint not null default 0,
  sc_sum  bigint not null default 0, sc_n bigint not null default 0, pages bigint not null default 0, visitors bigint not null default 0,
  primary key (area, day, dim, k)
);
create table public.web_daily_done (area text not null check (area in ('site', 'app')), day date not null, done_at timestamptz not null default now(), primary key (area, day));
alter table public.web_daily enable row level security;
alter table public.web_daily_done enable row level security;   -- sem regra: só as funções do painel leem
revoke all on public.web_daily, public.web_daily_done from anon, authenticated;

-- os números de um intervalo, no formato do resumo, calculados das visitas e dos eventos
create or replace function public.web_agg(a text, t1 timestamptz, t2 timestamptz)
returns table (day date, dim text, k text, n bigint, bounces bigint, ms_sum bigint, timed bigint, sc_sum bigint, sc_n bigint, pages bigint, visitors bigint)
language sql stable security definer set search_path = public set work_mem = '64MB' as $$
  with s as materialized (
    select date_trunc('day', w.started_at)::date as day, w.device_id, w.pages, w.ms, w.timed, w.sc, (w.pages <= 1 and w.ms < 10000) as bounce,
      w.channel, w.referrer, w.source, w.medium, w.campaign, w.entry, w.exit, w.dv, w.br, w.os, w.lg, w.tz, w.sw, w.consent, w.standalone,
      extract(dow from w.started_at at time zone 'America/Sao_Paulo')::int || ':' || extract(hour from w.started_at at time zone 'America/Sao_Paulo')::int as hr
    from web_sessions w where w.area = a and w.started_at >= t1 and w.started_at < t2),
  d as (select s.day, x.dim, x.k, s.bounce, s.ms, s.timed, s.sc, s.pages from s cross join lateral (values
      ('channel', s.channel), ('referrer', s.referrer),
      ('campaign', case when s.source is not null then s.source || '|' || coalesce(s.medium, '') || '|' || coalesce(s.campaign, '') end),
      ('entry', s.entry), ('exit', s.exit), ('dv', coalesce(s.dv, '?')), ('br', coalesce(s.br, '?')), ('os', coalesce(s.os, '?')),
      ('lg', coalesce(s.lg, '?')), ('tz', coalesce(s.tz, '?')), ('sw', coalesce(s.sw, '?')), ('hour', s.hr),
      ('consent', case when s.consent then '1' end), ('standalone', case when s.standalone then '1' when not s.standalone then '0' end)) as x(dim, k)
    where x.k is not null)
  select s.day, 'all', '', count(*), count(*) filter (where bounce), coalesce(sum(ms) filter (where timed), 0), count(*) filter (where timed),
    coalesce(sum(sc), 0), count(sc), coalesce(sum(pages), 0), count(distinct device_id) from s group by 1
  union all
  select d.day, d.dim, d.k, count(*), count(*) filter (where bounce), coalesce(sum(ms) filter (where timed), 0), count(*) filter (where timed),
    coalesce(sum(sc), 0), count(sc), coalesce(sum(pages), 0), 0 from d group by 1, 2, 3
  union all
  select date_trunc('day', e.created_at)::date, 'pv', e.page, count(*), 0, 0, 0, 0, 0, 0, 0 from app_events e
    where e.name = case when a = 'site' then 'visit' else 'screen' end and e.created_at >= t1 and e.created_at < t2 and e.page is not null group by 1, 3
  union all
  select date_trunc('day', e.created_at)::date, 'pt', e.page, count(*), 0, coalesce(sum(e.ms), 0), count(e.ms), coalesce(sum(e.sc), 0), count(e.sc), 0, 0 from app_events e
    where e.name = case when a = 'site' then 'visit_end' else 'screen' end and e.area = a and e.created_at >= t1 and e.created_at < t2 and e.page is not null group by 1, 3
  union all
  select date_trunc('day', e.created_at)::date, 'flow', left((e.props ->> 'from') || '>' || e.page, 130), count(*), 0, 0, 0, 0, 0, 0, 0 from app_events e
    where a = 'app' and e.name = 'screen' and e.created_at >= t1 and e.created_at < t2 and e.props ->> 'from' ~ '^[a-z0-9._-]{1,40}$' and e.props ->> 'from' <> e.page group by 1, 3
$$;

-- fecha no resumo os dias que faltam (até anteontem). Agendar de hora em hora: select public.web_rollup();
-- (sem agendar, o painel faz isso sozinho ao abrir a seção Site e app)
create or replace function public.web_rollup(max_days int default 1500) returns int
language plpgsql security definer set search_path = public set work_mem = '64MB' as $$
declare a text; dd date; fd date; n int := 0; last date := (date_trunc('day', now()) - interval '2 days')::date;
begin
  foreach a in array array['site', 'app'] loop
    -- desde a 1ª visita (antes dela não há o que somar), no máximo max_days dias para trás
    select min(w.started_at)::date into fd from web_sessions w where w.area = a;
    continue when fd is null;
    for dd in select g::date from generate_series(greatest(fd, last - (greatest(1, least(max_days, 1500)) - 1)), last, interval '1 day') g
              where not exists (select 1 from web_daily_done x where x.area = a and x.day = g::date) order by 1 loop
      delete from web_daily w where w.area = a and w.day = dd;
      insert into web_daily (area, day, dim, k, n, bounces, ms_sum, timed, sc_sum, sc_n, pages, visitors)
        select a, g.day, g.dim, g.k, sum(g.n), sum(g.bounces), sum(g.ms_sum), sum(g.timed), sum(g.sc_sum), sum(g.sc_n), sum(g.pages), sum(g.visitors)
        from web_agg(a, dd::timestamptz, (dd + 1)::timestamptz) g where g.day = dd group by 2, 3, 4;
      insert into web_daily_done (area, day) values (a, dd) on conflict do nothing;
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
-- o painel pede o resumo ao abrir (quem é admin); demora só na 1ª vez
create or replace function public.admin_web_rollup() returns int
language plpgsql security definer set search_path = public as $$
begin perform admin_guard('leitor'); return web_rollup(); end $$;
revoke execute on function public.web_agg(text, timestamptz, timestamptz), public.web_rollup(int) from public, anon, authenticated;
revoke execute on function public.admin_web_rollup() from public, anon;
grant execute on function public.admin_web_rollup() to authenticated;

-- painel do site (area = 'site') ou do app (area = 'app'): visitantes, visitas, páginas, tempo, rejeição (uma página e menos
-- de 10 s), rolagem, canais, sites que mandaram gente, campanhas, público, horários e quem está agora.
create or replace function public.admin_web(area text default 'site', days int default 30, ate date default null) returns jsonb
language plpgsql stable security definer set search_path = public set work_mem = '64MB' as $$
declare
  d int := greatest(1, least(days, 730));
  tend timestamptz := case when ate is null then now() else least(now(), (ate + 1)::timestamptz) end;
  t0 timestamptz := date_trunc('day', tend - interval '1 second') - make_interval(days => d - 1);
  p0 timestamptz := t0 - make_interval(days => d);
  dlast date := (tend - interval '1 second')::date;
  a text := admin_web.area;
  st boolean;
  live_from date;
  fd date;
  out jsonb;
begin
  perform admin_guard('leitor');
  if a is null or a not in ('site', 'app') then raise exception 'area: site ou app' using errcode = '22023'; end if;
  st := a = 'site';
  -- 1º dia (desde o período anterior e a 1ª visita registrada) que ainda não está no resumo: dali em diante, calcula na hora
  select min(w.started_at)::date into fd from web_sessions w where w.area = a;
  select coalesce(min(g::date), dlast + 1) into live_from from generate_series(greatest(p0, coalesce(fd, dlast)::timestamptz), dlast::timestamptz, interval '1 day') g
    where not exists (select 1 from web_daily_done x where x.area = a and x.day = g::date);
  with
  ag as materialized (
    select w.day, w.dim, w.k, w.n, w.bounces, w.ms_sum, w.timed, w.sc_sum, w.sc_n, w.pages, w.visitors, w.day >= t0::date as cur
      from web_daily w where w.area = a and w.day >= p0::date and w.day < live_from and w.day <= dlast
    union all
    select g.day, g.dim, g.k, g.n, g.bounces, g.ms_sum, g.timed, g.sc_sum, g.sc_n, g.pages, g.visitors, g.day >= t0::date
      from web_agg(a, greatest(p0, live_from::timestamptz), tend) g),
  -- totais (dim all) do período e do anterior
  tt as (select
      coalesce(sum(n) filter (where cur), 0) s, coalesce(sum(n) filter (where not cur), 0) sp,
      coalesce(sum(pages) filter (where cur), 0) pv, coalesce(sum(pages) filter (where not cur), 0) pvp,
      round(sum(ms_sum) filter (where cur) / nullif(sum(timed) filter (where cur), 0)) ms, round(sum(ms_sum) filter (where not cur) / nullif(sum(timed) filter (where not cur), 0)) msp,
      round(100.0 * sum(bounces) filter (where cur) / nullif(sum(n) filter (where cur), 0), 1) b, round(100.0 * sum(bounces) filter (where not cur) / nullif(sum(n) filter (where not cur), 0), 1) bp,
      round(sum(sc_sum) filter (where cur) / nullif(sum(sc_n) filter (where cur), 0)) sc, coalesce(sum(timed) filter (where cur), 0) timed
    from ag where dim = 'all'),
  k as (select jsonb_build_object(
      -- visitantes: aparelhos diferentes no período inteiro (não dá para somar dias), pelo índice das visitas
      'visitors', (select count(*) from (select distinct w.device_id from web_sessions w where w.area = a and w.started_at >= t0 and w.started_at < tend) v),
      'visitors_prev', (select count(*) from (select distinct w.device_id from web_sessions w where w.area = a and w.started_at >= p0 and w.started_at < t0) v),
      'sessions', tt.s, 'sessions_prev', tt.sp, 'pageviews', tt.pv, 'pageviews_prev', tt.pvp, 'avg_ms', tt.ms, 'avg_ms_prev', tt.msp,
      'bounce', tt.b, 'bounce_prev', tt.bp, 'scroll', tt.sc, 'timed', tt.timed,
      'consent_pct', round(100.0 * (select coalesce(sum(n), 0) from ag where cur and dim = 'consent') / nullif(tt.s, 0)),
      'standalone_pct', round(100.0 * (select sum(n) from ag where cur and dim = 'standalone' and k = '1') / nullif((select sum(n) from ag where cur and dim = 'standalone'), 0)),
      'rollup_until', (live_from - 1)) as v from tt),
  daily as (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(ds.day, 'YYYY-MM-DD'), 'visitors', coalesce(x.v, 0), 'sessions', coalesce(x.n, 0),
      'pageviews', coalesce(x.pv, 0), 'avg_ms', x.ms) order by ds.day), '[]') as v
    from generate_series(t0, dlast::timestamptz, interval '1 day') ds(day)
    left join (select day, sum(visitors) v, sum(n) n, sum(pages) pv, round(sum(ms_sum) / nullif(sum(timed), 0)) ms from ag where cur and dim = 'all' group by 1) x on x.day = ds.day::date),
  dk as (select dim, k, sum(n) n, sum(bounces) bo, sum(ms_sum) ms, sum(timed) tm, sum(sc_sum) scs, sum(sc_n) scn from ag where cur and dim <> 'all' group by 1, 2),
  pages as (select coalesce(jsonb_agg(jsonb_build_object('page', pv.k, 'views', pv.n, 'avg_ms', round(pt.ms / nullif(pv.n, 0)), 'scroll', round(pt.scs / nullif(pt.scn, 0)),
      'entries', case when st then coalesce(en.n, 0) end, 'bounce', round(100.0 * en.bo / nullif(en.n, 0), 1), 'exits', case when st then coalesce(ex.n, 0) end) order by pv.n desc), '[]') as v
    from (select * from dk where dim = 'pv' order by n desc limit 30) pv
    left join dk pt on pt.dim = 'pt' and pt.k = pv.k left join dk en on en.dim = 'entry' and en.k = pv.k left join dk ex on ex.dim = 'exit' and ex.k = pv.k),
  flows as (select coalesce(jsonb_agg(jsonb_build_object('from', split_part(k, '>', 1), 'to', split_part(k, '>', 2), 'n', n) order by n desc), '[]') as v from (
    select k, n from dk where dim = 'flow' order by n desc limit 12) x),
  chan as (select coalesce(jsonb_agg(jsonb_build_object('channel', k, 'sessions', n, 'avg_ms', round(ms / nullif(tm, 0)), 'bounce', round(100.0 * bo / nullif(n, 0), 1)) order by n desc), '[]') as v
    from dk where dim = 'channel'),
  refs as (select coalesce(jsonb_agg(jsonb_build_object('referrer', k, 'channel', web_channel(null, null, k, null), 'sessions', n, 'avg_ms', round(ms / nullif(tm, 0)), 'bounce', round(100.0 * bo / nullif(n, 0), 1)) order by n desc), '[]') as v
    from (select * from dk where dim = 'referrer' order by n desc limit 15) x),
  camps as (select coalesce(jsonb_agg(jsonb_build_object('source', split_part(k, '|', 1), 'medium', nullif(split_part(k, '|', 2), ''), 'campaign', nullif(split_part(k, '|', 3), ''),
      'sessions', n, 'avg_ms', round(ms / nullif(tm, 0)), 'bounce', round(100.0 * bo / nullif(n, 0), 1)) order by n desc), '[]') as v
    from (select * from dk where dim = 'campaign' order by n desc limit 15) x),
  aud as (select coalesce(jsonb_object_agg(dim, items), '{}') as v from (
    select dim, jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) items from (
      select dim, k, n, row_number() over (partition by dim order by n desc) r from dk where dim in ('dv', 'br', 'os', 'lg', 'tz', 'sw')) y where r <= 12 group by dim) z),
  hours as (select coalesce(jsonb_agg(jsonb_build_object('d', split_part(k, ':', 1)::int, 'h', split_part(k, ':', 2)::int, 'n', n) order by split_part(k, ':', 1)::int, split_part(k, ':', 2)::int), '[]') as v from dk where dim = 'hour'),
  -- agora: quem mandou algo nos últimos 5 minutos e em que página ou tela está
  lv as (select e.device_id, coalesce(e.page, case when st then 'index' else 'app' end) as page from app_events e
    where e.created_at > now() - interval '5 minutes' and e.area = a),
  live as (select jsonb_build_object('now', (select count(distinct device_id) from lv),
      'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', page, 'n', n) order by n desc), '[]') from (select page, count(distinct device_id) n from lv group by 1 order by 2 desc limit 6) x)) as v)
  select jsonb_build_object('area', a, 'days', d, 'from', to_char(t0, 'YYYY-MM-DD'), 'to', to_char(dlast, 'YYYY-MM-DD'), 'generated_at', now(),
      'kpi', k.v, 'daily', daily.v, 'pages', pages.v, 'flows', flows.v, 'channels', chan.v, 'referrers', refs.v, 'campaigns', camps.v,
      'audience', aud.v, 'hours', hours.v, 'live', live.v)
    into out from k, daily, pages, flows, chan, refs, camps, aud, hours, live;
  return out;
end $$;

-- mapa de calor de uma página (site) ou tela (app) num tipo de aparelho: cliques em quadradinhos de 1% da largura por 10 px,
-- os elementos mais clicados, cliques com raiva e mortos, e até onde as pessoas rolaram. No máximo 90 dias (é o que fica guardado).
create or replace function public.admin_heatmap(area text, page text, dev text default 'm', days int default 30, ate date default null) returns jsonb
language plpgsql stable security definer set search_path = public set work_mem = '64MB' as $$
declare
  d int := greatest(1, least(days, 90));
  tend timestamptz := case when ate is null then now() else least(now(), (ate + 1)::timestamptz) end;
  t0 timestamptz := date_trunc('day', tend - interval '1 second') - make_interval(days => d - 1);
  a text := admin_heatmap.area; p text := admin_heatmap.page; dv text := admin_heatmap.dev;
  out jsonb;
begin
  perform admin_guard('leitor');
  if a is null or a not in ('site', 'app') or dv is null or dv not in ('m', 't', 'd') or p is null or p !~ '^[a-z0-9._-]{1,40}$' then
    raise exception 'mapa de calor: área, página ou aparelho inválido' using errcode = '22023';
  end if;
  with hc as materialized (select h.x, h.y, h.vw, h.sel, h.rage, h.dead, h.device_id from heat_clicks h
      where h.area = a and h.page = p and h.dev = dv and h.created_at >= t0 and h.created_at < tend),
  cells as (select coalesce(jsonb_agg(jsonb_build_array(cx, cy, n)), '[]') as v from (
      select x / 10 as cx, y / 10 as cy, count(*) n from hc group by 1, 2 order by 3 desc limit 6000) c),
  sels as (select coalesce(jsonb_agg(jsonb_build_object('sel', sel, 'n', n, 'devices', dvs, 'rage', rg, 'dead', dd) order by n desc), '[]') as v from (
      select sel, count(*) n, count(distinct device_id) dvs, count(*) filter (where rage) rg, count(*) filter (where dead) dd
      from hc where sel is not null group by sel order by 2 desc limit 15) s),
  -- rolagem: site = saída da página; app = saída da tela (só com consentimento)
  sc as materialized (select e.sc from app_events e
      where e.name = case when a = 'site' then 'visit_end' else 'screen' end and e.created_at >= t0 and e.created_at < tend
        and e.area = a and e.page = p and coalesce(e.dev, dv) = dv and e.sc is not null),
  depth as (select coalesce(jsonb_agg(jsonb_build_object('pct', b, 'n', n) order by b), '[]') as v from (
      select b, (select count(*) from sc where sc.sc >= b) n from generate_series(0, 100, 5) b) x)
  select jsonb_build_object('area', a, 'page', p, 'dev', dv, 'days', d, 'from', to_char(t0, 'YYYY-MM-DD'), 'to', to_char(tend - interval '1 second', 'YYYY-MM-DD'),
      'clicks', (select count(*) from hc), 'devices', (select count(distinct device_id) from hc),
      'rage', (select count(*) from hc where rage), 'dead', (select count(*) from hc where dead),
      'vw', (select percentile_disc(0.5) within group (order by vw) from hc where vw is not null),
      'max_y', (select percentile_disc(0.98) within group (order by y) from hc),
      'views', (select count(*) from sc), 'cells', cells.v, 'sels', sels.v, 'depth', depth.v)
    into out from cells, sels, depth;
  return out;
end $$;
revoke execute on function public.admin_web(text, int, date), public.admin_heatmap(text, text, text, int, date) from public, anon;
grant execute on function public.admin_web(text, int, date), public.admin_heatmap(text, text, text, int, date) to authenticated;
