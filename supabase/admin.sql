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
