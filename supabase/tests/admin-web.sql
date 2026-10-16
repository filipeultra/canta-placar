-- Painel do site e do app (admin_web) e mapa de calor (admin_heatmap): números com dados conhecidos, permissões e entrada inválida.
-- Rodar numa base nova: supabase-stub.sql, schema.sql, admin.sql e este arquivo. Cada linha sai "ok" ou "ERRO".
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000f0', 'dona@x.com', '{"name":"Dona"}'), ('00000000-0000-0000-0000-0000000000f3', 'a@x.com', '{"name":"Comum"}');
insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-0000000000f0', 'leitor');
create function pg_temp.as_user(c text, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false),
         set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000' || c, 'aal', aal,
           'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, false) $$;
create function pg_temp.ok(cond boolean, label text) returns text language sql as $$ select case when coalesce(cond, false) then 'ok   ' else 'ERRO ' end || label $$;
create function pg_temp.err(q text, want text, label text) returns text language plpgsql as $$
begin execute q; return 'ERRO ' || label || ': passou sem erro';
exception when others then if sqlerrm like '%' || want || '%' then return 'ok   ' || label; else return 'ERRO ' || label || ': ' || sqlerrm; end if; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- o que o site e o app mandam, como anônimo (o app sem login)
set role anon;
-- visita A (sem consentimento, celular): chegou pela bio do Instagram, viu a inicial e a ajuda
insert into public.app_events (device_id, session, sid, name, props, source, medium, campaign, created_at) values
 ('sesa00000001', true, 'sesa00000001', 'visit', '{"page":"index","dv":"m","br":"chrome","os":"android","lg":"pt-BR","tz":"America/Sao_Paulo","sw":"390"}', 'instagram', 'bio', 'lancamento', now() - interval '30 hours'),
 ('sesa00000001', true, 'sesa00000001', 'visit_end', '{"a":"site","pg":"index","ms":30000,"sc":80,"dv":"m"}', 'instagram', 'bio', 'lancamento', now() - interval '30 hours' + interval '30 seconds'),
 ('sesa00000001', true, 'sesa00000001', 'visit', '{"page":"ajuda","dv":"m"}', 'instagram', 'bio', 'lancamento', now() - interval '30 hours' + interval '31 seconds'),
 ('sesa00000001', true, 'sesa00000001', 'visit_end', '{"a":"site","pg":"ajuda","ms":15000,"sc":50,"dv":"m"}', 'instagram', 'bio', 'lancamento', now() - interval '30 hours' + interval '46 seconds');
-- visita B (celular): veio do Google, ficou 4 s e saiu (rejeição)
insert into public.app_events (device_id, session, sid, name, props, referrer, created_at) values
 ('sesb00000001', true, 'sesb00000001', 'visit', '{"page":"index","dv":"m","br":"safari","os":"ios","lg":"pt-BR","tz":"America/Recife","sw":"390"}', 'www.google.com', now() - interval '1 day'),
 ('sesb00000001', true, 'sesb00000001', 'visit_end', '{"a":"site","pg":"index","ms":4000,"sc":20,"dv":"m"}', 'www.google.com', now() - interval '1 day' + interval '4 seconds');
-- visita C (com consentimento, computador): veio de um link no Instagram para a página do padel
insert into public.app_events (device_id, session, sid, name, props, referrer, created_at) values
 ('devc00000001', false, 'sesc00000001', 'visit', '{"page":"placar-padel","dv":"d","br":"chrome","os":"windows","lg":"pt-BR","tz":"America/Sao_Paulo","sw":"1440"}', 'l.instagram.com', now() - interval '3 hours'),
 ('devc00000001', false, 'sesc00000001', 'visit_end', '{"a":"site","pg":"placar-padel","ms":60000,"sc":100,"dv":"d"}', 'l.instagram.com', now() - interval '3 hours' + interval '1 minute');
-- visita D: no período anterior (40 dias atrás não entra pelo app: o banco recusa evento velho; entra direto abaixo)
reset role;
insert into public.app_events (device_id, session, sid, name, props, created_at) values
 ('sesd00000001', true, 'sesd00000001', 'visit', '{"page":"index","dv":"m"}', now() - interval '40 days');
set role anon;
-- app: E com consentimento (instalado), abriu, foi do Início para o Jogar e ficou 2 min; F sem consentimento, saiu em 3 s
insert into public.app_events (device_id, session, sid, name, props, created_at) values
 ('deve00000001', false, 'sese00000001', 'app_open', '{"standalone":true,"dv":"m","br":"safari","os":"ios","lg":"pt-BR","tz":"America/Sao_Paulo","sw":"390"}', now() - interval '5 hours'),
 ('deve00000001', false, 'sese00000001', 'screen', '{"v":"inicio","ms":5000,"sc":40,"dv":"m"}', now() - interval '5 hours' + interval '5 seconds'),
 ('deve00000001', false, 'sese00000001', 'screen', '{"v":"jogar","from":"inicio","ms":120000,"sc":0,"dv":"m"}', now() - interval '5 hours' + interval '125 seconds'),
 ('deve00000001', false, 'sese00000001', 'visit_end', '{"a":"app","ms":125000,"dv":"m"}', now() - interval '5 hours' + interval '126 seconds'),
 ('sesf00000001', true, 'sesf00000001', 'app_open', '{"standalone":false,"dv":"m"}', now() - interval '1 hour'),
 ('sesf00000001', true, 'sesf00000001', 'visit_end', '{"a":"app","ms":3000,"dv":"m"}', now() - interval '1 hour' + interval '3 seconds');
-- alguém no site agora
insert into public.app_events (device_id, session, sid, name, props) values ('sesg00000001', true, 'sesg00000001', 'visit_end', '{"a":"site","pg":"ajuda","ms":1000,"dv":"m"}');
-- cliques do mapa de calor: 9 no botão principal da inicial no celular (3 com raiva), 2 mortos num texto, 1 no computador
insert into public.heat_clicks (device_id, area, page, dev, x, y, vw, sel, rage, dead)
 select 'devc00000001', 'site', 'index', 'm', 480 + g, 600 + g, 390, 'a#cta', g <= 3, false from generate_series(1, 9) g;
insert into public.heat_clicks (device_id, area, page, dev, x, y, vw, sel, dead) values
 ('devc00000001', 'site', 'index', 'm', 100, 1500, 390, 'p', true), ('devc00000001', 'site', 'index', 'm', 120, 1510, 390, 'p', true),
 ('devc00000001', 'site', 'index', 'd', 500, 300, 1440, 'a#cta', false);
-- o que o anônimo não pode
select pg_temp.err($$insert into public.app_events (device_id, session, name, props) values ('sesx00000001', true, 'screen', '{"v":"inicio"}')$$, 'row-level security', '1. sem consentimento, a tela do app não entra (só visita, abertura e saída)');
select pg_temp.err($$insert into public.heat_clicks (device_id, area, page, dev, x, y) values ('devx00000001', 'site', '../admin', 'm', 1, 1)$$, 'heat_clicks_page_check', '2. clique com página fora do formato');
select pg_temp.err($$insert into public.heat_clicks (device_id, area, page, dev, x, y, sel) values ('devx00000001', 'site', 'index', 'm', 1, 1, 'Olá Bia')$$, 'heat_clicks_sel_check', '3. clique com texto da página no elemento');
select pg_temp.err($$insert into public.heat_clicks (device_id, area, page, dev, x, y) values ('devx00000001', 'site', 'index', 'm', 5000, 1)$$, 'heat_clicks_x_check', '4. clique fora da largura');
select pg_temp.err($$insert into public.heat_clicks (device_id, area, page, dev, x, y, created_at) values ('devx00000001', 'site', 'index', 'm', 1, 1, now() - interval '9 days')$$, 'row-level security', '5. clique com data antiga (inflar o passado)');
select pg_temp.err($$insert into public.app_events (device_id, name, referrer) values ('devx00000001', 'visit', 'https://evil.com/<x>')$$, 'app_events_referrer_check', '6. origem com endereço inteiro ou HTML');
select pg_temp.err($$select count(*) from public.heat_clicks$$, 'permission denied', '7. anônimo não lê os cliques');
select pg_temp.err($$select public.admin_web('site', 30)$$, 'permission denied', '8. anônimo não chama o painel do site');
reset role;
set role authenticated;
select pg_temp.as_user('f3') \g /dev/null
select pg_temp.err($$select public.admin_web('site', 30)$$, 'acesso só para administradores', '9. quem não é admin não lê o painel do site');
select pg_temp.err($$select public.admin_heatmap('site', 'index', 'm', 30)$$, 'acesso só para administradores', '10. nem o mapa de calor');
select pg_temp.ok((select count(*) from public.heat_clicks) = 0, '11. quem não é admin lê 0 cliques');
select pg_temp.err($$select public.prune_heat_clicks()$$, 'permission denied', '12. só o servidor apaga cliques antigos');
select pg_temp.as_user('f0', 'aal1') \g /dev/null
select pg_temp.err($$select public.admin_web('site', 30)$$, 'acesso só para administradores', '13. admin sem a 2ª etapa não lê');
select pg_temp.as_user('f0') \g /dev/null

-- site
create temp table w as select public.admin_web('site', 30) as j;
select pg_temp.ok((j->'kpi'->>'visitors')::int = 3 and (j->'kpi'->>'visitors_prev')::int = 1, '14. site: 3 visitantes no período e 1 no anterior (' || (j->'kpi'->>'visitors') || '/' || (j->'kpi'->>'visitors_prev') || ')') from w;
select pg_temp.ok((j->'kpi'->>'sessions')::int = 3 and (j->'kpi'->>'pageviews')::int = 4, '15. 3 visitas e 4 páginas vistas') from w;
select pg_temp.ok((j->'kpi'->>'avg_ms')::int = 36333, '16. tempo médio por visita: (45 s + 4 s + 60 s) / 3 = 36,3 s (' || (j->'kpi'->>'avg_ms') || ')') from w;
select pg_temp.ok((j->'kpi'->>'bounce')::numeric = 33.3, '17. rejeição: 1 de 3 visitas (uma página e menos de 10 s)') from w;
select pg_temp.ok((j->'kpi'->>'consent_pct')::int = 33, '18. 1 de 3 visitas com estatísticas ligadas (33%)') from w;
select pg_temp.ok((select (p->>'views')::int = 2 and (p->>'entries')::int = 2 and (p->>'avg_ms')::int = 17000 and (p->>'exits')::int = 1 and (p->>'bounce')::numeric = 50
  from jsonb_array_elements(j->'pages') p where p->>'page' = 'index'), '19. inicial: 2 vistas, 2 entradas, 17 s em média, 1 saída, 50% de rejeição') from w;
select pg_temp.ok((select (p->>'exits')::int = 1 and (p->>'entries')::int = 0 from jsonb_array_elements(j->'pages') p where p->>'page' = 'ajuda'), '20. ajuda: 1 saída e nenhuma entrada') from w;
select pg_temp.ok((select (c->>'sessions')::int from jsonb_array_elements(j->'channels') c where c->>'channel' = 'social') = 2
  and (select (c->>'sessions')::int from jsonb_array_elements(j->'channels') c where c->>'channel' = 'busca') = 1, '21. canais: 2 social (bio e link do Instagram) e 1 busca') from w;
select pg_temp.ok((select count(*) from jsonb_array_elements(j->'referrers')) = 2, '22. sites que mandaram gente: google e instagram') from w;
select pg_temp.ok((select (c->>'sessions')::int from jsonb_array_elements(j->'campaigns') c where c->>'campaign' = 'lancamento') = 1, '23. campanha "lancamento": 1 visita') from w;
select pg_temp.ok((select (x->>'n')::int from jsonb_array_elements(j->'audience'->'dv') x where x->>'k' = 'm') = 2
  and (select (x->>'n')::int from jsonb_array_elements(j->'audience'->'dv') x where x->>'k' = 'd') = 1, '24. público: 2 no celular, 1 no computador') from w;
select pg_temp.ok((select count(*) from jsonb_array_elements(j->'audience'->'tz')) = 2, '25. fusos: São Paulo e Recife') from w;
select pg_temp.ok(jsonb_array_length(j->'daily') = 30 and (select sum((x->>'pageviews')::int) from jsonb_array_elements(j->'daily') x) = 4, '26. 30 dias na série, somando 4 páginas') from w;
select pg_temp.ok((select sum((x->>'n')::int) from jsonb_array_elements(j->'hours') x) = 3, '27. horários: 3 visitas') from w;
select pg_temp.ok((j->'live'->>'now')::int = 1 and j->'live'->'pages'->0->>'page' = 'ajuda', '28. agora: 1 pessoa, na ajuda') from w;
select pg_temp.ok(not exists (select 1 from jsonb_array_elements(j->'pages') p where p->>'page' in ('inicio', 'jogar')), '29. site não mistura as telas do app') from w;

-- app
create temp table wa as select public.admin_web('app', 30) as j;
select pg_temp.ok((j->'kpi'->>'visitors')::int = 2 and (j->'kpi'->>'avg_ms')::int = 64000 and (j->'kpi'->>'bounce')::numeric = 50, '30. app: 2 aparelhos, 64 s por uso e 50% saíram em menos de 10 s') from wa;
select pg_temp.ok((j->'kpi'->>'standalone_pct')::int = 50, '31. metade abriu pelo app instalado') from wa;
select pg_temp.ok((select (s->>'avg_ms')::int = 120000 and (s->>'views')::int = 1 from jsonb_array_elements(j->'pages') s where s->>'page' = 'jogar'), '32. tela Jogar: 1 vista, 2 min em média') from wa;
select pg_temp.ok(j->'flows'->0->>'from' = 'inicio' and j->'flows'->0->>'to' = 'jogar', '33. caminho mais comum: Início → Jogar') from wa;
select pg_temp.ok((j->'live'->>'now')::int = 0, '34. ninguém no app agora (a visita ao site não conta)') from wa;
select pg_temp.ok((select (j->'kpi'->>'visitors')::int from w) + (j->'kpi'->>'visitors')::int = 5, '35. site e app separados: 3 + 2') from wa;

-- mapa de calor
create temp table h as select public.admin_heatmap('site', 'index', 'm', 30) as j;
select pg_temp.ok((j->>'clicks')::int = 11 and (j->>'rage')::int = 3 and (j->>'dead')::int = 2, '36. inicial no celular: 11 cliques, 3 com raiva, 2 mortos') from h;
select pg_temp.ok(j->'sels'->0->>'sel' = 'a#cta' and (j->'sels'->0->>'n')::int = 9, '37. elemento mais clicado: o botão principal (9)') from h;
select pg_temp.ok((j->>'vw')::int = 390 and jsonb_array_length(j->'cells') > 0, '38. desenha em 390 px de largura') from h;
select pg_temp.ok((j->>'views')::int = 2 and (select (x->>'n')::int from jsonb_array_elements(j->'depth') x where (x->>'pct')::int = 50) = 1
  and (select (x->>'n')::int from jsonb_array_elements(j->'depth') x where (x->>'pct')::int = 0) = 2, '39. rolagem: 2 visitas na inicial pelo celular, 1 passou da metade') from h;
select pg_temp.ok((public.admin_heatmap('site', 'index', 'd', 30)->>'clicks')::int = 1, '40. no computador, 1 clique (aparelhos separados)');
select pg_temp.ok((public.admin_heatmap('app', 'jogar', 'm', 30)->>'views')::int = 1, '41. app: rolagem da tela Jogar vem das telas vistas');
select pg_temp.err($$select public.admin_heatmap('site', '../admin', 'm', 30)$$, 'inválido', '42. página fora do formato');
select pg_temp.err($$select public.admin_heatmap('blog', 'index', 'm', 30)$$, 'inválido', '43. área que não existe');
select pg_temp.err($$select public.admin_web('outro', 30)$$, 'area: site ou app', '44. painel com área que não existe');

-- canais
select pg_temp.ok(public.web_channel('google', 'cpc', null, null) = 'anúncio' and public.web_channel(null, null, null, 'UP-ABC123') = 'convite'
  and public.web_channel(null, null, null, null) = 'direto' and public.web_channel('newsletter', 'email', null, null) = 'e-mail'
  and public.web_channel(null, null, 'blog.exemplo.com', null) = 'outros sites' and public.web_channel(null, null, 't.co', null) = 'social', '45. canais: anúncio, convite, direto, e-mail, outros sites e social');
reset role;
-- o banco preenche área, página, aparelho, tempo e rolagem a partir do que o app mandou
select pg_temp.ok((select area = 'site' and page = 'index' and dev = 'm' and ms = 30000 and sc = 80 from public.app_events where sid = 'sesa00000001' and name = 'visit_end' order by id limit 1), '46. colunas do evento preenchidas pelo banco');
select pg_temp.ok((select pages = 2 and entry = 'index' and exit = 'ajuda' and ms = 45000 and sc = 80 and channel = 'social' and timed from public.web_sessions where sid = 'sesa00000001'), '47. visita A em uma linha: 2 páginas, entrou na inicial, saiu na ajuda, 45 s');
select pg_temp.ok((select count(*) from public.web_sessions) = 6, '48. uma linha por visita (4 no site, 2 no app; a saída sozinha não cria visita)');
-- resumo por dia: com os dias fechados vindo do resumo, os números são os mesmos de calcular tudo na hora
create function pg_temp.norm(j jsonb) returns jsonb language sql as $$
  select jsonb_build_object('kpi', (j->'kpi') - 'rollup_until', 'daily', j->'daily', 'hours', j->'hours',
    'pages', (select jsonb_agg(x order by x::text) from jsonb_array_elements(j->'pages') x), 'channels', (select jsonb_agg(x order by x::text) from jsonb_array_elements(j->'channels') x),
    'referrers', (select jsonb_agg(x order by x::text) from jsonb_array_elements(j->'referrers') x), 'campaigns', (select jsonb_agg(x order by x::text) from jsonb_array_elements(j->'campaigns') x),
    'audience', (select jsonb_object_agg(key, (select jsonb_agg(y order by y::text) from jsonb_array_elements(value) y)) from jsonb_each(j->'audience')),
    'flows', (select jsonb_agg(x order by x::text) from jsonb_array_elements(j->'flows') x)) $$;
grant execute on all functions in schema pg_temp to authenticated;
select pg_temp.ok(public.web_rollup() = (current_date - 2) - (now() - interval '40 days')::date + 1, '49. resumo: do dia da 1ª visita do site até anteontem (o app só tem visitas de hoje)');
select pg_temp.ok((select count(*) from public.web_daily where dim = 'all') >= 1, '50. resumo tem as visitas do dia antigo');
set role authenticated;
select pg_temp.as_user('f0') \g /dev/null
select pg_temp.ok(pg_temp.norm(public.admin_web('site', 30)) = (select pg_temp.norm(j) from w), '51. site: mesmos números com o resumo') ;
select pg_temp.ok(pg_temp.norm(public.admin_web('app', 30)) = (select pg_temp.norm(j) from wa), '52. app: mesmos números com o resumo');
select pg_temp.ok((public.admin_web('site', 30)->'kpi'->>'rollup_until')::date = current_date - 2, '53. o resumo vai até anteontem; ontem e hoje são calculados na hora');
select pg_temp.ok(public.admin_web_rollup() = 0, '54. o painel pede o resumo: os dias desde a 1ª visita já estão fechados');
select pg_temp.ok(public.admin_web_rollup() = 0, '55. pedir o resumo de novo não refaz nada');
reset role;
