\set QUIET on
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000a', '{"name":"Filipe"}'), ('00000000-0000-0000-0000-00000000000b', '{"name":"Bia"}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.subscriptions (user_id, plan, status, provider, current_period_end) values ('00000000-0000-0000-0000-00000000000b', 'pro_mensal', 'ativa', 'web', now() + interval '20 days');
-- eventos de 3 aparelhos
set role anon;
insert into public.app_events (device_id, session, name, source) values ('sess0000aa', true, 'visit', 'instagram');
do $$ begin insert into public.app_events (device_id, session, name) values ('sess0000aa', true, 'match_end'); raise notice 'ERRO: evento sem consentimento passou'; exception when others then raise notice '1. sem consentimento, só visita e abertura'; end $$;
insert into public.app_events (device_id, name, source, medium) values ('dev00000a1', 'app_open', 'instagram', 'bio'), ('dev00000a1', 'signup', 'instagram', 'bio'), ('dev00000a1', 'match_start', null, null), ('dev00000a1', 'match_end', null, null), ('dev00000a2', 'app_open', null, null);
do $$ declare n int; begin select count(*) into n from public.app_events; raise notice '2. anônimo lê eventos: % linhas', n; exception when insufficient_privilege then raise notice '2. anônimo não lê os eventos'; end $$;
reset role;
insert into public.matches (id, owner_id, sport, played_at) values ('m1', '00000000-0000-0000-0000-00000000000b', 'beach', now()), ('m2', '00000000-0000-0000-0000-00000000000b', 'padel', now());
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
do $$ begin perform public.admin_metrics(30); raise notice '3. ERRO: não-admin leu'; exception when insufficient_privilege then raise notice '3. quem não é admin não lê o painel'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \g /dev/null
select '4. kpi: ' || (public.admin_metrics(30)->'kpi')::text;
select '5. funil: ' || (public.admin_metrics(30)->'funnel')::text;
select '6. origem: ' || (public.admin_metrics(30)->'sources')::text;
select '7. esportes: ' || (public.admin_metrics(7)->'sports')::text || ' · dias: ' || jsonb_array_length(public.admin_metrics(7)->'daily');
select '8. retenção: ' || (public.admin_metrics(30)->'retention')::text;
