-- Links rastreáveis, tráfego por origem, taxas (cancelamento, teste → pago, ativação, retenção) e período por datas.
-- Rodar numa base nova: supabase-stub.sql, schema.sql, admin.sql e este arquivo. Cada linha sai "ok" ou "ERRO".
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000f0', 'dona@x.com', '{"name":"Dona"}'), ('00000000-0000-0000-0000-0000000000f1', 'mod@x.com', '{"name":"Mod"}'),
 ('00000000-0000-0000-0000-0000000000f2', 'leitor@x.com', '{"name":"Leitor"}'), ('00000000-0000-0000-0000-0000000000f3', 'a@x.com', '{"name":"Assinante"}'),
 ('00000000-0000-0000-0000-0000000000f4', 'b@x.com', '{"name":"Cancelou"}'), ('00000000-0000-0000-0000-0000000000f5', 'c@x.com', '{"name":"Testando"}');
insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-0000000000f0', 'dono'), ('00000000-0000-0000-0000-0000000000f1', 'moderador'), ('00000000-0000-0000-0000-0000000000f2', 'leitor');
create function pg_temp.as_admin(c text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false),
         set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000' || c, 'aal', 'aal2',
           'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, false) $$;
create function pg_temp.ok(cond boolean, label text) returns text language sql as $$ select case when coalesce(cond, false) then 'ok   ' else 'ERRO ' end || label $$;
create function pg_temp.err(q text, want text, label text) returns text language plpgsql as $$
begin execute q; return 'ERRO ' || label || ': passou sem erro';
exception when others then if sqlerrm like '%' || want || '%' then return 'ok   ' || label || ' (' || sqlerrm || ')'; else return 'ERRO ' || label || ': ' || sqlerrm; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
-- tráfego: o aparelho 1 chegou pelo link da bio, criou conta, jogou e assinou; o 2 veio direto; o 3 veio pelo TikTok
insert into public.app_events (device_id, session, name, source, medium, campaign, content, created_at) values
 ('dev0000001', false, 'app_open', 'instagram', 'bio', 'lancamento', 'bio-insta', now() - interval '3 days'),
 ('dev0000001', false, 'signup', 'instagram', 'bio', 'lancamento', 'bio-insta', now() - interval '3 days' + interval '5 minutes'),
 ('dev0000001', false, 'match_end', 'instagram', 'bio', 'lancamento', 'bio-insta', now() - interval '2 days'),
 ('dev0000001', false, 'pro_start', 'instagram', 'bio', 'lancamento', 'bio-insta', now() - interval '1 day'),
 ('dev0000002', false, 'app_open', null, null, null, null, now() - interval '2 days'),
 ('dev0000003', false, 'app_open', 'tiktok', 'video', 'lancamento', null, now() - interval '1 day'),
 ('dev0000003', false, 'signup', 'tiktok', 'video', 'lancamento', null, now() - interval '1 day'),
 -- retenção: chegou há 40 dias e voltou no dia seguinte, na semana e no mês
 ('dev0000009', false, 'app_open', null, null, null, null, now() - interval '40 days'),
 ('dev0000009', false, 'app_open', null, null, null, null, now() - interval '39 days' + interval '1 hour'),
 ('dev0000009', false, 'app_open', null, null, null, null, now() - interval '33 days' + interval '1 hour'),
 ('dev0000009', false, 'app_open', null, null, null, null, now() - interval '10 days' + interval '1 hour');
-- assinaturas: uma pagando desde antes do período, uma que cancelou no período, uma em teste grátis há 20 dias que pagou
insert into public.subscriptions (user_id, plan, status, provider, current_period_end, created_at, updated_at) values
 ('00000000-0000-0000-0000-0000000000f3', 'pro_mensal', 'ativa', 'web', now() + interval '20 days', now() - interval '60 days', now() - interval '60 days'),
 ('00000000-0000-0000-0000-0000000000f4', 'pro_mensal', 'cancelada', 'web', now() + interval '5 days', now() - interval '50 days', now() - interval '3 days'),
 ('00000000-0000-0000-0000-0000000000f5', 'pro_anual', 'ativa', 'web', now() + interval '300 days', now() - interval '20 days', now() - interval '6 days');
set role authenticated;
\o /dev/null
select pg_temp.as_admin('f1');
\o
select pg_temp.ok((public.admin_link_save('Bio-Insta', 'Bio do Instagram', 'app', 'Instagram', 'bio', 'lancamento') ->> 'slug') = 'bio-insta', '1. moderador cria um link (código em minúsculas)');
select pg_temp.err($$select public.admin_link_save('x', 'curto', 'app', 'a', 'b', 'c')$$, 'violates check', '2. código de link muito curto é recusado');
select pg_temp.err($$select public.admin_link_save('ok-link', 'Link', 'app', 'insta gram', 'bio', 'c')$$, 'violates check', '3. origem com espaço é recusada (o UTM precisa ser limpo)');
\o /dev/null
select pg_temp.as_admin('f2');
\o
select pg_temp.err($$select public.admin_link_save('outro', 'Outro', 'app', 'a', 'b', 'c')$$, 'sem_permissao', '4. leitor não cria link');
select pg_temp.ok((public.admin_links(30) -> 'links' -> 0 ->> 'visits')::int = 1, '5. leitor vê os números do link');
\o /dev/null
select pg_temp.as_admin('f0');
\o
select pg_temp.ok((select (l ->> 'visits')::int = 1 and (l ->> 'signups')::int = 1 and (l ->> 'played')::int = 1 and (l ->> 'pro')::int = 1 from (select public.admin_links(30) -> 'links' -> 0 as l) x), '6. o link mostra visita, conta, 1ª partida e Pro do mesmo aparelho');
select pg_temp.ok((select count(*) from jsonb_array_elements(public.admin_links(30) -> 'sources') e where e ->> 'source' in ('instagram', 'tiktok', 'direto')) >= 3, '7. tráfego por origem inclui instagram, tiktok e direto');
select pg_temp.ok((select (e ->> 'visits')::int = 2 from jsonb_array_elements(public.admin_links(30) -> 'campaigns') e where e ->> 'campaign' = 'lancamento'), '8. a campanha soma as duas origens');
select pg_temp.ok((public.admin_links(30) -> 'totals' ->> 'tagged')::int = 2, '9. dos 4 aparelhos do período, 2 vieram com origem marcada');
select pg_temp.ok((public.admin_link_save('bio-insta', 'Bio do Instagram', 'app', 'instagram', 'bio', 'lancamento', true) ->> 'archived_at') is not null, '10. arquivar o link');
select pg_temp.ok((public.admin_links(30) -> 'links' -> 0 ->> 'archived')::boolean, '11. arquivado continua com os números');
-- taxas
select pg_temp.ok((public.admin_metrics(30) -> 'rates' ->> 'paying_start')::int = 2, '12. pagantes no começo do período: 2');
select pg_temp.ok((public.admin_metrics(30) -> 'rates' ->> 'canceled')::int = 1 and (public.admin_metrics(30) -> 'rates' ->> 'mrr_lost')::numeric = 24.90, '13. 1 cancelou no período, R$ 24,90 de receita perdida');
select pg_temp.ok((public.admin_metrics(30) -> 'rates' ->> 'trial_total')::int >= 1 and (public.admin_metrics(30) -> 'rates' ->> 'trial_paid')::int >= 1, '14. teste grátis que virou pagamento conta na conversão');
select pg_temp.ok((public.admin_metrics(30) -> 'rates' ->> 'act_signups')::int = 2 and (public.admin_metrics(30) -> 'rates' ->> 'act_done')::int = 1, '15. ativação: 1 de 2 contas novas terminou uma partida em 7 dias');
select pg_temp.ok((select (r ->> 'ret_base1')::int >= 2 and (r ->> 'ret_d1')::int = 1 and (r ->> 'ret_base7')::int = 1 and (r ->> 'ret_d7')::int = 1 and (r ->> 'ret_base30')::int = 1 and (r ->> 'ret_d30')::int = 1 from (select public.admin_metrics(60) -> 'rates' as r) x), '16. retenção: D1 conta quem chegou há 2+ dias (2 aparelhos, 1 voltou); D7 e D30 de quem chegou há 40 dias');
-- período por datas
select pg_temp.ok((public.admin_metrics(7, current_date - 30) ->> 'to') = to_char(current_date - 30, 'YYYY-MM-DD'), '17. período que termina numa data escolhida');
select pg_temp.ok((public.admin_metrics(7, current_date - 20) -> 'kpi' ->> 'visits')::int = 0 and (public.admin_metrics(5, current_date - 37) -> 'kpi' ->> 'visits')::int = 1, '18. só conta o que aconteceu dentro das datas');
select pg_temp.ok(jsonb_array_length(public.admin_metrics(365) -> 'daily') = 365, '19. 1 ano: 365 dias no gráfico');
