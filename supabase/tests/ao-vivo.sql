-- ULTRA PLAY · testes do "jogando agora" (presença e placar ao vivo) e da análise do dia.
-- Rodar depois de supabase-stub.sql e schema.sql numa base vazia (ver supabase/README.md). Cada linha diz o que
-- foi testado; uma linha com "ERRO" quer dizer que a regra falhou.
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', '{"name":"Ana Dona"}'), ('00000000-0000-0000-0000-0000000000b1', '{"name":"Bia Parceira"}'),
 ('00000000-0000-0000-0000-0000000000c1', '{"name":"Caio Segue"}'), ('00000000-0000-0000-0000-0000000000d1', '{"name":"Davi Fora"}'),
 ('00000000-0000-0000-0000-0000000000e1', '{"name":"Eva Fechada"}');
create or replace function pg_temp.u(c text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c || '1', false) $$;
set role authenticated;

-- Ana começa a partida e publica o placar; Bia é a parceira; Kaká (sem conta) é adversário
\o /dev/null
select pg_temp.u('a');
\o
insert into public.live_matches (match_id, sport, place_name, score, guests) values ('lv1', 'beach', 'Arena', '{"sets":[],"games":[3,2],"points":["30","15"],"server":0}', '[{"team":1,"slot":0,"name":"Kaká"}]');
insert into public.live_players (match_id, user_id, team, slot) values ('lv1', '00000000-0000-0000-0000-0000000000a1', 0, 0), ('lv1', '00000000-0000-0000-0000-0000000000b1', 0, 1);
\o /dev/null
select pg_temp.u('c');
\o
insert into public.follows (follower_id, followee_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000a1');
select '1. quem segue vê: ' || mode || ' · placar ' || (score->'games')::text || ' · nomes ' || (select string_agg(coalesce(x->>'name', '?'), ', ') from jsonb_array_elements(players) x) from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');
select '2. direto na tabela, quem segue vê: ' || (select count(*) from public.live_matches) || ' partidas, ' || (select count(*) from public.live_players) || ' jogadores';
do $$ begin insert into public.live_players (match_id, user_id, team, slot) values ('lv1', auth.uid(), 1, 1); raise notice '3. ERRO: entrou sozinho na partida de outro'; exception when insufficient_privilege then raise notice '3. ninguém se coloca na partida de outro'; end $$;
update public.live_matches set score = '{"games":[0,6]}' where match_id = 'lv1';
\o /dev/null
select pg_temp.u('a');
\o
select '4. placar não muda por quem não é dono: ' || (score->'games')::text from public.live_matches where match_id = 'lv1';
do $$ begin update public.live_matches set owner_id = '00000000-0000-0000-0000-0000000000c1' where match_id = 'lv1'; raise notice '5. ERRO: trocou o dono'; exception when insufficient_privilege then raise notice '5. dono não passa a partida para outro'; end $$;
\o /dev/null
select pg_temp.u('d');
\o
select '6. quem não segue vê: ' || count(*) from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');
\o /dev/null
select pg_temp.u('c');
\o
select '7. quem segue a Ana não vê a Bia (não segue): ' || count(*) from public.live_for_viewer('00000000-0000-0000-0000-0000000000b1');

-- Eva entra na partida e não deixa ver o placar ao vivo: os nomes dos outros somem
\o /dev/null
select pg_temp.u('e');
\o
update public.profiles set live_view = false where id = auth.uid();
\o /dev/null
select pg_temp.u('a');
\o
insert into public.live_players (match_id, user_id, team, slot) values ('lv1', '00000000-0000-0000-0000-0000000000e1', 1, 1);
\o /dev/null
select pg_temp.u('c');
\o
select '8. com alguém fechado: ' || mode || ' · placar ' || (score->'games')::text || ' · nomes ' || (select string_agg(coalesce(x->>'name', '?'), ', ' order by (x->>'team')::int, (x->>'slot')::int) from jsonb_array_elements(players) x) || ' · ids ' || (select count(*) from jsonb_array_elements(players) x where x->>'user_id' is not null) from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');

-- Ana desliga o placar ao vivo: só aparece que está jogando
\o /dev/null
select pg_temp.u('a');
\o
update public.profiles set live_view = false where id = auth.uid();
\o /dev/null
select pg_temp.u('c');
\o
select '9. dona fechou o placar: ' || mode || ' · placar ' || coalesce(score::text, 'nenhum') || ' · nomes ' || coalesce(players::text, 'nenhum') || ' · esporte ' || sport from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');

-- Ana desliga "mostrar quando estou jogando": some para todo mundo
\o /dev/null
select pg_temp.u('a');
\o
update public.profiles set show_online = false, live_view = true where id = auth.uid();
\o /dev/null
select pg_temp.u('c');
\o
select '10. dona escondida: ' || count(*) from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');

-- partida parada há mais de 30 min sai do "jogando agora"
\o /dev/null
select pg_temp.u('a');
\o
update public.profiles set show_online = true where id = auth.uid();
update public.live_matches set last_point_at = now() - interval '40 minutes' where match_id = 'lv1';
\o /dev/null
select pg_temp.u('c');
\o
select '11. parada há 40 min: ' || count(*) from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');

-- bloqueio corta o acesso
\o /dev/null
select pg_temp.u('a');
\o
update public.live_matches set last_point_at = now() where match_id = 'lv1';
insert into public.blocks (user_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c1');
\o /dev/null
select pg_temp.u('c');
\o
select '12. bloqueado pela dona: ' || count(*) from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1');
do $$ begin perform public.live_cleanup(); raise notice '13. ERRO: usuário rodou a limpeza'; exception when insufficient_privilege then raise notice '13. só o servidor roda a limpeza'; end $$;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin perform * from public.live_for_viewer('00000000-0000-0000-0000-0000000000a1'); raise notice '14. ERRO: anônimo consultou'; exception when insufficient_privilege then raise notice '14. anônimo não consulta o ao vivo'; end $$;
do $$ begin perform 1 from public.live_matches; raise notice '15. ERRO: anônimo leu a tabela'; exception when insufficient_privilege then raise notice '15. anônimo não lê as tabelas do ao vivo'; end $$;

-- análise do dia
set role authenticated;
\o /dev/null
select pg_temp.u('c');
\o
insert into public.daily_analyses (sport, last_match_at, items) values ('beach', '2026-10-01 10:00+00', '[{"kind":"evo"}]');
select '16. 1ª análise do dia gravada: ' || count(*) from public.daily_analyses where user_id = auth.uid();
do $$ begin insert into public.daily_analyses (sport, last_match_at, items) values ('beach', now(), '[]'); raise notice '17. ERRO: duas no mesmo dia'; exception when unique_violation then raise notice '17. só uma análise por dia e esporte'; end $$;
do $$ begin insert into public.daily_analyses (sport, day, last_match_at, items) values ('beach', current_date + 1, '2026-10-01 10:00+00', '[]'); raise notice '18. ERRO: análise sem partida nova'; exception when check_violation then raise notice '18. sem partida nova, não sai análise nova'; end $$;
insert into public.daily_analyses (sport, day, last_match_at, items) values ('beach', current_date + 1, '2026-10-02 10:00+00', '[]');
select '19. no dia seguinte, com partida nova: ' || count(*) from public.daily_analyses where user_id = auth.uid();
do $$ begin insert into public.daily_analyses (sport, day, last_match_at, items, source) values ('padel', current_date, now(), '[]', 'ia'); raise notice '20. ERRO: app gravou como IA'; exception when insufficient_privilege then raise notice '20. análise por IA só pelo servidor'; end $$;
do $$ begin insert into public.daily_analyses (user_id, sport, last_match_at, items) values ('00000000-0000-0000-0000-0000000000d1', 'padel', now(), '[]'); raise notice '21. ERRO: gravou para outro'; exception when insufficient_privilege then raise notice '21. ninguém grava análise de outro'; end $$;
do $$ begin update public.daily_analyses set items = '[]' where user_id = auth.uid(); raise notice '22. ERRO: editou a análise'; exception when insufficient_privilege then raise notice '22. análise não é editada depois'; end $$;
\o /dev/null
select pg_temp.u('d');
\o
select '23. outra pessoa lê as análises de Caio: ' || count(*) from public.daily_analyses;
update public.profiles set show_online = false where id = '00000000-0000-0000-0000-0000000000a1';
\o /dev/null
select pg_temp.u('a');
\o
select '24. ninguém muda o "jogando agora" de outro: show_online da Ana = ' || show_online from public.profiles where id = auth.uid();
