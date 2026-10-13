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
  created_at  timestamptz not null default now()
);
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from admins where user_id = uid) $$;

-- preço mensal de cada plano, para o MRR (ajuste quando os preços forem decididos; ver docs/PRECOS.md)
create table public.plan_prices (
  plan     text primary key,
  monthly  numeric(10, 2) not null
);
insert into public.plan_prices (plan, monthly) values
  ('pro_mensal', 24.90), ('pro_anual', 14.99), ('fundador', 9.99), ('professor', 59.90), ('arena', 149.90)
on conflict (plan) do nothing;

alter table public.app_events enable row level security;
alter table public.admins enable row level security;
alter table public.plan_prices enable row level security;
-- qualquer um manda evento (o app sem login também); ninguém lê, só admin
create policy events_insert on public.app_events for insert to anon, authenticated
  with check ((user_id is null or user_id = auth.uid()) and created_at > now() - interval '2 days' and created_at < now() + interval '5 minutes'
              and (session = false or name in ('visit', 'app_open')));
create policy events_admin on public.app_events for select using (public.is_admin(auth.uid()));
create policy admins_self on public.admins for select using (user_id = auth.uid());
create policy prices_read on public.plan_prices for select using (true);
grant insert on public.app_events to anon, authenticated;
grant usage on sequence public.app_events_id_seq to anon, authenticated;
revoke update, delete on public.app_events from anon, authenticated;
revoke insert, update, delete on public.admins, public.plan_prices from anon, authenticated;

-- ---------- números do painel (uma chamada só; só admin) ----------
create or replace function public.admin_metrics(days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d int := greatest(1, least(days, 365));
  t0 timestamptz := date_trunc('day', now()) - make_interval(days => d - 1);
  p0 timestamptz := t0 - make_interval(days => d);
  out jsonb;
begin
  if not is_admin(auth.uid()) then raise exception 'acesso só para administradores' using errcode = '42501'; end if;
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
      'ai_tokens_out', (select coalesce(sum(output_tokens), 0) from ai_usage where created_at >= t0)
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
  events_top as (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc), '[]') as v from (select name, count(*) n from cur group by name order by count(*) desc limit 15) e)
  select jsonb_build_object('days', d, 'from', to_char(t0, 'YYYY-MM-DD'), 'generated_at', now(), 'kpi', kpi.v, 'daily', daily.v, 'sports', sports.v, 'funnel', funnel.v,
    'sources', sources.v, 'retention', retention.v, 'plans', plans.v, 'events', events_top.v)
  into out from kpi, daily, sports, funnel, sources, retention, plans, events_top;
  return out;
end $$;
revoke execute on function public.admin_metrics(int) from anon;
grant execute on function public.admin_metrics(int) to authenticated;
