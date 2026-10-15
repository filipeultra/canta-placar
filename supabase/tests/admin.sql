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
with m as (insert into public.matches (id, owner_id, sport, played_at) values ('m1', '00000000-0000-0000-0000-00000000000b', 'beach', now()), ('m2', '00000000-0000-0000-0000-00000000000b', 'padel', now()) returning id, owner_id)
insert into public.match_players (match_id, team, slot, user_id) select id, 0, 0, owner_id from m;   -- quem lança joga
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal2"}', false) \g /dev/null
do $$ begin perform public.admin_metrics(30); raise notice '3. ERRO: não-admin leu'; exception when insufficient_privilege then raise notice '3. quem não é admin não lê o painel'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \g /dev/null
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}', false) \g /dev/null
do $$ begin perform public.admin_metrics(30); raise notice '3b. ERRO: admin sem a 2ª etapa leu'; exception when insufficient_privilege then raise notice '3b. admin que só entrou pelo link do e-mail (sem o código do autenticador) não lê'; end $$;
select '3c. am_i_admin sem a 2ª etapa: ' || public.am_i_admin()::text;
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'aal', 'aal2', 'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, false) \g /dev/null
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
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal2"}', false) \g /dev/null
do $$ begin perform public.admin_users(''); raise notice '19. ERRO: não-admin buscou contas'; exception when insufficient_privilege then raise notice '19. quem não é admin não busca contas'; end $$;
do $$ begin perform public.admin_grant_pro('UP-AAAAAA', 30); raise notice '20. ERRO: não-admin deu Pro'; exception when insufficient_privilege then raise notice '20. quem não é admin não dá Pro'; end $$;
do $$ declare n int; begin select count(*) into n from public.admin_log; raise notice '21. não-admin vê % linhas do registro', n; end $$;
reset role;

-- ===== tentativas de invasão (quem não é admin, com e sem login) =====
\echo '--- invasão ---'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal2"}', false) \g /dev/null
do $$ begin insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000b'); raise notice 'S1. ERRO: virou admin sozinho'; exception when insufficient_privilege then raise notice 'S1. ninguém se coloca na tabela admins'; end $$;
do $$ begin update public.admins set user_id = '00000000-0000-0000-0000-00000000000b'; raise notice 'S2. ERRO: trocou o admin'; exception when insufficient_privilege then raise notice 'S2. ninguém troca o admin'; end $$;
do $$ declare n int; begin select count(*) into n from public.admins; raise notice 'S3. não-admin vê % admins', n; end $$;
do $$ begin perform public.is_admin('00000000-0000-0000-0000-00000000000a'); raise notice 'S4. ERRO: dá para perguntar se outra pessoa é admin'; exception when undefined_function then raise notice 'S4. não dá para perguntar se outra pessoa é admin'; end $$;
do $$ begin update public.profiles set pro_until = now() + interval '10 years' where id = '00000000-0000-0000-0000-00000000000b'; raise notice 'S5. ERRO: deu Pro para si'; exception when insufficient_privilege then raise notice 'S5. ninguém se dá Pro pelo perfil'; end $$;
do $$ begin insert into public.subscriptions (user_id, plan, status, provider) values ('00000000-0000-0000-0000-00000000000a', 'arena', 'ativa', 'web'); raise notice 'S6. ERRO: criou assinatura'; exception when insufficient_privilege then raise notice 'S6. ninguém cria assinatura'; end $$;
do $$ begin perform public.admin_grant_pro((select public_id from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 365); raise notice 'S7. ERRO: deu cortesia para si'; exception when insufficient_privilege then raise notice 'S7. ninguém se dá cortesia pela função do painel'; end $$;
do $$ begin insert into public.admin_log (action) values ('falso'); raise notice 'S8. ERRO: escreveu no registro'; exception when insufficient_privilege then raise notice 'S8. ninguém escreve no registro de ações'; end $$;
do $$ begin delete from public.admin_log; raise notice 'S9. ERRO: apagou o registro'; exception when insufficient_privilege then raise notice 'S9. ninguém apaga o registro de ações'; end $$;
do $$ declare n int; begin select count(*) into n from public.app_events; raise notice 'S10. não-admin lê % eventos', n; end $$;
do $$ begin delete from public.app_events; raise notice 'S11. ERRO: apagou eventos'; exception when insufficient_privilege then raise notice 'S11. ninguém apaga eventos'; end $$;
do $$ begin update public.plan_prices set monthly = 0; raise notice 'S12. ERRO: mudou preço'; exception when insufficient_privilege then raise notice 'S12. ninguém muda o preço dos planos'; end $$;
do $$ begin perform public.admin_handle_report('00000000-0000-0000-0000-0000000000e2', 'descartada'); raise notice 'S13. ERRO: descartou denúncia'; exception when insufficient_privilege then raise notice 'S13. ninguém responde denúncia sem ser admin'; end $$;
do $$ begin update public.reports set status = 'descartada'; raise notice 'S14. ERRO: mexeu na denúncia'; exception when insufficient_privilege then raise notice 'S14. ninguém mexe nas denúncias direto'; end $$;
do $$ begin insert into public.app_events (device_id, name, user_id) values ('dev0000zz', 'app_open', '00000000-0000-0000-0000-00000000000a'); raise notice 'S15. ERRO: mandou evento em nome de outro'; exception when insufficient_privilege then raise notice 'S15. ninguém manda evento em nome de outra pessoa'; end $$;
do $$ begin insert into public.app_events (id, device_id, name) values (999999, 'dev0000zz', 'app_open'); raise notice 'S16. ERRO: escolheu o id do evento'; exception when insufficient_privilege then raise notice 'S16. evento não escolhe o próprio id'; end $$;
-- token falso de "aal2" não basta: precisa estar na tabela
select 'S17. não-admin com aal2 é admin? ' || public.is_admin()::text;
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
select set_config('request.jwt.claims', '{"aal":"aal2"}', false) \g /dev/null
do $$ begin perform public.admin_users(''); raise notice 'S18. ERRO: anônimo buscou contas'; exception when insufficient_privilege then raise notice 'S18. anônimo não chama as funções do painel'; end $$;
do $$ begin perform public.admin_metrics(30); raise notice 'S19. ERRO: anônimo leu o painel'; exception when insufficient_privilege then raise notice 'S19. anônimo não lê o painel'; end $$;
do $$ begin insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000b'); raise notice 'S20. ERRO: anônimo virou admin'; exception when insufficient_privilege then raise notice 'S20. anônimo não mexe em admins'; end $$;
do $$ declare n int; begin select count(*) into n from public.admin_log; raise notice 'S21. ERRO: anônimo leu % linhas do registro', n; exception when insufficient_privilege then raise notice 'S21. anônimo não lê o registro'; end $$;
reset role;
