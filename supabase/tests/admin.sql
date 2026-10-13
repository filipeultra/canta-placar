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
-- funções novas do painel
select '9. extras: live=' || (k->>'live_now') || ' dau=' || (k->>'dau') || ' mau=' || (k->>'mau') || ' voz=' || (k->>'voice_pct') || ' subs_new=' || (k->>'subs_new') from (select public.admin_metrics(30)->'kpi' k) z;
select '10. versões/horas: ' || jsonb_array_length(public.admin_metrics(30)->'versions') || '/' || jsonb_array_length(public.admin_metrics(30)->'hours');
select '11. busca "bia": ' || jsonb_array_length(public.admin_users('bia', 10)) || ' · tudo: ' || jsonb_array_length(public.admin_users('', 10)) || ' · curinga "%": ' || jsonb_array_length(public.admin_users('%', 10));
select '12. cortesia até amanhã+30d? ' || (public.admin_grant_pro((select public_id from public.profiles where name = 'Bia'), 30) > now() + interval '29 days')::text;
reset role;
insert into public.groups (id, name, sport, created_by) values ('00000000-0000-0000-0000-0000000000c1', 'Turma', 'beach', '00000000-0000-0000-0000-00000000000b');
insert into public.group_posts (id, group_id, user_id, text) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'post ruim');
insert into public.reports (id, reporter_id, target_post_id, reason) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'ofensivo'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'spam');
insert into public.reports (reporter_id, target_match_id, reason) values ('00000000-0000-0000-0000-00000000000a', 'm1', 'placar falso');
set role authenticated;
select '13. fila: ' || jsonb_array_length(public.admin_reports('abertas')) || ' abertas · mesmo alvo: ' || (public.admin_reports('abertas')->0->>'same_target' )
  || ' · tipos: ' || (select string_agg(x->>'kind', ',' order by x->>'kind') from jsonb_array_elements(public.admin_reports('abertas')) x);
select '14. resolver e tirar do ar: ' || public.admin_handle_report('00000000-0000-0000-0000-0000000000e1', 'resolvida', true);
reset role;
select '15. post removido? ' || (deleted_at is not null)::text from public.group_posts where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
select '16. abertas agora: ' || jsonb_array_length(public.admin_reports('abertas')) || ' · grupos: ' || (public.admin_groups(30)->0->>'name') || ' membros=' || (public.admin_groups(30)->0->>'members');
do $$ begin perform public.admin_handle_report('00000000-0000-0000-0000-0000000000e2', 'apagar'); raise notice 'ERRO: situação inválida passou'; exception when invalid_parameter_value then raise notice '17. situação inválida recusada'; end $$;
select '18. registro: ' || (select string_agg(action, ',' order by id) from public.admin_log);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
do $$ begin perform public.admin_users(''); raise notice '19. ERRO: não-admin buscou contas'; exception when insufficient_privilege then raise notice '19. quem não é admin não busca contas'; end $$;
do $$ begin perform public.admin_grant_pro('UP-AAAAAA', 30); raise notice '20. ERRO: não-admin deu Pro'; exception when insufficient_privilege then raise notice '20. quem não é admin não dá Pro'; end $$;
do $$ declare n int; begin select count(*) into n from public.admin_log; raise notice '21. não-admin vê % linhas do registro', n; end $$;
reset role;
