-- ULTRA PLAY · estatísticas de uso e painel de admin. Rodar depois do schema.sql.
-- Eventos chegam do app e do site (sem nome, e-mail ou conteúdo das partidas). Só quem está na tabela admins lê.

-- ---------- eventos ----------
-- device_id: sorteado no aparelho. Sem consentimento, vale só para a visita (sessão) e só entram "visit" e "app_open";
-- com consentimento (Ajustes → Estatísticas de uso), fica fixo no aparelho e entram os outros eventos.
create table public.app_events (
  id          bigserial primary key,
  device_id   text not null check (device_id ~ '^[a-z0-9]{8,32}$'),
  session     boolean not null default false,          -- true = id só da visita (sem consentimento)
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null check (name ~ '^[a-z_]{2,32}$'),
  props       jsonb not null default '{}' check (pg_column_size(props) < 2000),
  path        text check (char_length(path) <= 120),
  source      text check (char_length(source) <= 40),
  medium      text check (char_length(medium) <= 40),
  campaign    text check (char_length(campaign) <= 40),
  ref         text check (ref ~ '^UP-[A-Z0-9]{6}$'),
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
              and (session = false or name in ('visit', 'app_open')));
create policy events_admin on public.app_events for select using (public.is_admin());
create policy admins_self on public.admins for select using (user_id = auth.uid());
create policy prices_read on public.plan_prices for select using (true);
grant usage on sequence public.app_events_id_seq to anon, authenticated;
-- o Supabase dá acesso total às tabelas novas para anon e authenticated: aqui fica só o que precisa
revoke all on public.app_events, public.admins, public.plan_prices from anon, authenticated;
grant insert (device_id, session, user_id, name, props, path, source, medium, campaign, ref, app_version, created_at) on public.app_events to anon, authenticated;
grant select on public.app_events to authenticated;   -- a regra events_admin deixa só admin ler
grant select on public.admins to authenticated;       -- a regra admins_self deixa ver só a própria linha
grant select on public.plan_prices to anon, authenticated;

-- ---------- números do painel (uma chamada só; só admin) ----------
create or replace function public.admin_metrics(days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d int := greatest(1, least(days, 365));
  t0 timestamptz := date_trunc('day', now()) - make_interval(days => d - 1);
  p0 timestamptz := t0 - make_interval(days => d);
  out jsonb;
begin
  if not is_admin() then raise exception 'acesso só para administradores' using errcode = '42501'; end if;
  with
  ev as (select * from app_events where created_at >= p0),
  cur as (select * from ev where created_at >= t0),
  prev as (select * from ev where created_at < t0),
  pro as (
    select s.plan from subscriptions s where s.status in ('trial', 'ativa') and (s.current_period_end is null or s.current_period_end > now())
    union all
    select 'cortesia' from profiles p where p.pro_until > now() and not exists (select 1 from subscriptions s where s.user_id = p.id and s.status in ('trial', 'ativa'))
  ),
  kpi as (
    select jsonb_build_object(
      'visits', (select count(distinct device_id) from cur where name in ('visit', 'app_open')),
      'visits_prev', (select count(distinct device_id) from prev where name in ('visit', 'app_open')),
      'active', (select count(distinct device_id) from cur where name = 'app_open' and not session),
      'active_prev', (select count(distinct device_id) from prev where name = 'app_open' and not session),
      'users', (select count(*) from profiles where deleted_at is null),
      'users_new', (select count(*) from profiles where created_at >= t0),
      'users_new_prev', (select count(*) from profiles where created_at >= p0 and created_at < t0),
      'pro', (select count(*) from pro),
      'pro_paying', (select count(*) from pro where plan <> 'cortesia'),
      'mrr', (select coalesce(sum(pp.monthly), 0) from pro join plan_prices pp using (plan)),
      'matches', (select count(*) from matches where created_at >= t0 and deleted_at is null),
      'matches_prev', (select count(*) from matches where created_at >= p0 and created_at < t0 and deleted_at is null),
      'matches_total', (select count(*) from matches where deleted_at is null),
      'groups', (select count(*) from groups where deleted_at is null),
      'reports_open', (select count(*) from reports where status in ('aberta', 'em_analise')),
      'ai_runs', (select count(*) from ai_usage where created_at >= t0),
      'ai_tokens_in', (select coalesce(sum(input_tokens), 0) from ai_usage where created_at >= t0),
      'ai_tokens_out', (select coalesce(sum(output_tokens), 0) from ai_usage where created_at >= t0),
      'ai_users', (select count(distinct user_id) from ai_usage where created_at >= t0),
      -- uso (só aparelhos com estatísticas ligadas): agora = últimos 15 min; dia/semana/mês até agora
      'live_now', (select count(distinct device_id) from ev where created_at > now() - interval '15 minutes'),
      'dau', (select count(distinct device_id) from ev where name = 'app_open' and not session and created_at > now() - interval '1 day'),
      'wau', (select count(distinct device_id) from ev where name = 'app_open' and not session and created_at > now() - interval '7 days'),
      'mau', (select count(distinct device_id) from app_events where name = 'app_open' and not session and created_at > now() - interval '30 days'),
      'installs', (select count(*) from cur where name = 'install'),
      'standalone_pct', (select coalesce(round(100.0 * count(*) filter (where props->>'standalone' = 'true') / nullif(count(*), 0)), 0) from cur where name = 'app_open' and props ? 'standalone'),
      'voice_pct', (select coalesce(round(avg((props->>'voice')::numeric)), 0) from cur where name = 'match_end' and props->>'voice' ~ '^[0-9.]+$'),
      'recs', (select count(*) from cur where name = 'rec_start'),
      'shares', (select count(*) from cur where name = 'share'),
      'invites', (select count(*) from cur where name = 'invite'),
      'feedbacks', (select count(*) from cur where name = 'feedback'),
      'subs_new', (select count(*) from subscriptions where created_at >= t0 and provider <> 'cortesia'),
      'subs_cancel', (select count(*) from subscriptions where status in ('cancelada', 'encerrada') and updated_at >= t0),
      'users_deleted', (select count(*) from profiles where deleted_at >= t0),
      'groups_new', (select count(*) from groups where created_at >= t0 and deleted_at is null),
      'posts', (select count(*) from group_posts where created_at >= t0 and deleted_at is null),
      -- comunidade: marcações (sem contar o dono), bloqueios e pedidos entre jogadores
      'tags_new', (select count(*) from match_players mp join matches m on m.id = mp.match_id where mp.created_at >= t0 and mp.user_id is not null and mp.user_id <> m.owner_id),
      'tags_accepted', (select count(*) from match_players mp join matches m on m.id = mp.match_id where mp.created_at >= t0 and mp.user_id is not null and mp.user_id <> m.owner_id and mp.tag_status = 'aceito'),
      'tags_refused', (select count(*) from match_players mp join matches m on m.id = mp.match_id where mp.created_at >= t0 and mp.user_id is not null and mp.user_id <> m.owner_id and mp.tag_status = 'recusado'),
      'blocks_new', (select count(*) from blocks where created_at >= t0),
      'del_open', (select count(*) from match_delete_requests where status = 'aberto'),
      'fix_open', (select count(*) from match_corrections where status = 'aberto'),
      'fixes_done', (select count(*) from match_corrections where status = 'aprovado' and closed_at >= t0),
      'trials', (select count(*) from subscriptions where status = 'trial' and (current_period_end is null or current_period_end > now())),
      -- saúde do app: erros que o app mandou (só aparelhos com estatísticas ligadas; sem mensagem, só arquivo e linha)
      'errors', (select count(*) from cur where name = 'js_error'),
      'errors_devices', (select count(distinct device_id) from cur where name = 'js_error'),
      'errors_prev', (select count(*) from prev where name = 'js_error')
    ) as v
  ),
  days_s as (select generate_series(t0, date_trunc('day', now()), interval '1 day') as day),
  daily as (
    select jsonb_agg(jsonb_build_object(
      'day', to_char(ds.day, 'YYYY-MM-DD'),
      'visits', (select count(distinct device_id) from cur where name in ('visit', 'app_open') and created_at >= ds.day and created_at < ds.day + interval '1 day'),
      'active', (select count(distinct device_id) from cur where name = 'app_open' and not session and created_at >= ds.day and created_at < ds.day + interval '1 day'),
      'signups', (select count(*) from profiles where created_at >= ds.day and created_at < ds.day + interval '1 day'),
      'matches', (select count(*) from matches where created_at >= ds.day and created_at < ds.day + interval '1 day' and deleted_at is null)
    ) order by ds.day) as v from days_s ds
  ),
  sports as (select coalesce(jsonb_agg(jsonb_build_object('sport', sport, 'n', n) order by n desc), '[]') as v from (select sport, count(*) n from matches where created_at >= t0 and deleted_at is null group by sport) x),
  funnel as (
    select jsonb_build_array(
      jsonb_build_object('step', 'visit', 'n', (select count(distinct device_id) from cur where not session and name in ('visit', 'app_open'))),
      jsonb_build_object('step', 'signup', 'n', (select count(distinct device_id) from cur where name = 'signup')),
      jsonb_build_object('step', 'match_start', 'n', (select count(distinct device_id) from cur where name = 'match_start')),
      jsonb_build_object('step', 'match_end', 'n', (select count(distinct device_id) from cur where name = 'match_end')),
      jsonb_build_object('step', 'share', 'n', (select count(distinct device_id) from cur where name = 'share')),
      jsonb_build_object('step', 'pro_start', 'n', (select count(distinct device_id) from cur where name = 'pro_start'))
    ) as v
  ),
  -- origem de cada aparelho: a primeira fonte vista no período (utm ou convite); sem nada, "direto"
  dev as (
    select device_id, (array_agg(source order by created_at) filter (where source is not null))[1] as src,
      (array_agg(medium order by created_at) filter (where medium is not null))[1] as med,
      bool_or(ref is not null) as has_ref, bool_or(name = 'signup') as signed
    from cur group by device_id
  ),
  sources as (
    select coalesce(jsonb_agg(jsonb_build_object('source', src, 'medium', med, 'visits', visits, 'signups', signups) order by visits desc), '[]') as v from (
      select coalesce(src, case when has_ref then 'convite' else 'direto' end) as src, coalesce(med, '') as med, count(*) as visits, count(*) filter (where signed) as signups
      from dev group by 1, 2 order by 3 desc limit 12) y
  ),
  -- retenção semanal: de quem fez a 1ª abertura (com consentimento) em cada semana, quantos voltaram nas semanas seguintes
  firsts as (select device_id, date_trunc('week', min(created_at)) as wk from app_events where name = 'app_open' and not session and created_at >= date_trunc('week', now()) - interval '7 weeks' group by device_id),
  weeks_back as (select f.device_id, f.wk, (extract(epoch from date_trunc('week', e.created_at) - f.wk) / 604800)::int as w from firsts f join app_events e on e.device_id = f.device_id and e.name = 'app_open' and not e.session group by 1, 2, 3),
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
    from matches where played_at >= t0 and deleted_at is null group by 1, 2) h),
  -- onde estão as contas (cidade do perfil, as 8 mais comuns)
  cities as (select coalesce(jsonb_agg(jsonb_build_object('city', city, 'n', n) order by n desc), '[]') as v from (
    select city, count(*) n from profiles where deleted_at is null and coalesce(trim(city), '') <> '' group by city order by 2 desc limit 8) c),
  -- onde o app mais quebra: arquivo e linha (props.where), os 6 mais comuns
  errors_top as (select coalesce(jsonb_agg(jsonb_build_object('where', w, 'kind', k, 'n', n, 'devices', dv) order by n desc), '[]') as v from (
    select coalesce(props ->> 'where', '?') w, coalesce(props ->> 'kind', '') k, count(*) n, count(distinct device_id) dv from cur where name = 'js_error' group by 1, 2 order by 3 desc limit 6) e),
  -- receita mensal dia a dia (assinaturas pagas valendo em cada dia, pelos preços de plan_prices)
  mrr_daily as (select jsonb_agg(jsonb_build_object('day', to_char(ds.day, 'YYYY-MM-DD'), 'mrr',
      (select coalesce(sum(pp.monthly), 0) from subscriptions s join plan_prices pp using (plan)
        where s.provider <> 'cortesia' and s.created_at < ds.day + interval '1 day' and s.status in ('trial', 'ativa', 'cancelada', 'atrasada')
          and (s.current_period_end is null or s.current_period_end > ds.day)),
      'paying', (select count(*) from subscriptions s where s.provider <> 'cortesia' and s.created_at < ds.day + interval '1 day' and s.status in ('ativa', 'cancelada', 'atrasada')
          and (s.current_period_end is null or s.current_period_end > ds.day))) order by ds.day) as v from days_s ds)
  select jsonb_build_object('days', d, 'from', to_char(t0, 'YYYY-MM-DD'), 'generated_at', now(), 'kpi', kpi.v, 'daily', daily.v, 'sports', sports.v, 'funnel', funnel.v,
    'sources', sources.v, 'retention', retention.v, 'plans', plans.v, 'events', events_top.v, 'versions', versions.v, 'hours', hours.v,
    'cities', cities.v, 'errors_top', errors_top.v, 'mrr_daily', mrr_daily.v, 'role', admin_role(), 'mfa_age_min', admin_mfa_age_min())
  into out from kpi, daily, sports, funnel, sources, retention, plans, events_top, versions, hours, cities, errors_top, mrr_daily;
  return out;
end $$;
revoke execute on function public.admin_metrics(int) from public, anon;
grant execute on function public.admin_metrics(int) to authenticated;

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
grant execute on function public.admin_hello(), public.admin_access(int), public.admin_team(), public.admin_note_export(text) to authenticated;
