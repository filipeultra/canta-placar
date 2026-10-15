-- Regras da partida entre várias pessoas (docs/REGRAS-PARTIDAS.md). Cada linha sai "ok" ou "ERRO".
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', '{"name":"Ana Dona"}'), ('00000000-0000-0000-0000-0000000000b1', '{"name":"Bia Parceira"}'),
 ('00000000-0000-0000-0000-0000000000c1', '{"name":"Caio Rival"}'), ('00000000-0000-0000-0000-0000000000d1', '{"name":"Davi Flood"}'),
 ('00000000-0000-0000-0000-0000000000e1', '{"name":"Eva Sigo"}'), ('00000000-0000-0000-0000-0000000000f1', '{"name":"Fabi Conexoes"}'),
 ('00000000-0000-0000-0000-0000000000a2', '{"name":"Hugo Grupo"}');
update public.profiles set tag_policy = 'sigo' where name in ('Eva Sigo', 'Hugo Grupo');
update public.profiles set tag_policy = 'conexoes' where name = 'Fabi Conexoes';
create function pg_temp.u(c text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false) $$;
create function pg_temp.id(c text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || c)::uuid $$;
create function pg_temp.ok(cond boolean, label text) returns text language sql as $$ select case when coalesce(cond, false) then 'ok   ' else 'ERRO ' end || label $$;
create function pg_temp.err(q text, want text, label text) returns text language plpgsql as $$
begin execute q; return 'ERRO ' || label || ': passou sem erro';
exception when others then if sqlerrm like '%' || want || '%' then return 'ok   ' || label || ' (' || sqlerrm || ')'; else return 'ERRO ' || label || ': ' || sqlerrm; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
set role authenticated;
\o /dev/null
select pg_temp.u('a1');
\o
-- ---------- quem pode me marcar ----------
-- partida e jogadores na mesma transação (fora do grupo, quem lança joga: a regra é conferida no fim da transação)
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p1', auth.uid(), 'beach', now(), '{"sets":[[6,3]],"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('p1', 0, 0, auth.uid());
commit;
select pg_temp.err($$insert into public.match_players (match_id, team, slot, user_id) values ('p1', 1, 0, '00000000-0000-0000-0000-0000000000e1')$$, 'convite_nao_permitido', '1. Eva (só quem ela segue) não pode ser marcada por Ana');
select pg_temp.err($$insert into public.match_players (match_id, team, slot, user_id) values ('p1', 1, 1, '00000000-0000-0000-0000-0000000000f1')$$, 'convite_nao_permitido', '2. Fabi (conexões) sem nenhuma ligação com Ana: recusado');
insert into public.follows (follower_id, followee_id) values (auth.uid(), pg_temp.id('f1'));
insert into public.match_players (match_id, team, slot, user_id) values ('p1', 1, 1, pg_temp.id('f1'));
select pg_temp.ok((select tag_status from public.match_players where match_id = 'p1' and user_id = pg_temp.id('f1')) = 'pendente', '3. Ana segue Fabi (conexões): marcação vai como pendente');
\o /dev/null
select pg_temp.u('e1');
\o
insert into public.follows (follower_id, followee_id) values (auth.uid(), pg_temp.id('a1'));
\o /dev/null
select pg_temp.u('a1');
\o
insert into public.match_players (match_id, team, slot, user_id) values ('p1', 1, 0, pg_temp.id('e1'));
reset role;
select pg_temp.ok((select display_name from public.match_players where match_id = 'p1' and user_id = pg_temp.id('e1')) = 'Eva Sigo', '4. Eva passou a seguir Ana: pode ser marcada (e o nome fica gravado na partida)');
set role authenticated;
-- ---------- grupo: estar no grupo libera a marcação na partida do grupo ----------
insert into public.groups (name, sport, created_by, open) values ('Beach de domingo', 'beach', auth.uid(), true);
select id as gid from public.groups limit 1 \gset
\o /dev/null
select pg_temp.u('a2');
\o
insert into public.group_members (group_id, user_id) values (:'gid', auth.uid());
\o /dev/null
select pg_temp.u('a1');
\o
insert into public.matches (id, owner_id, group_id, sport, played_at, result) values ('g1', auth.uid(), :'gid', 'beach', now(), '{"winner":1}');
insert into public.match_players (match_id, team, slot, user_id) values ('g1', 0, 0, pg_temp.id('a2'));
select pg_temp.ok((select tag_status from public.match_players where match_id = 'g1' and user_id = pg_temp.id('a2')) = 'pendente', '5. Hugo (só quem ele segue) é do grupo: marcado na partida do grupo, ainda pendente (precisa aceitar)');
select pg_temp.ok(not exists (select 1 from public.match_players where match_id = 'g1' and user_id = auth.uid()), '6. organizadora registrou a partida do grupo sem jogar');
select pg_temp.err($$insert into public.match_players (match_id, team, slot, user_id) values ('p1', 0, 1, '00000000-0000-0000-0000-0000000000a2')$$, 'convite_nao_permitido', '7. fora da partida do grupo, vale o ajuste do Hugo');
-- ---------- placar travado depois de outra pessoa confirmar ----------
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p2', auth.uid(), 'beach', now(), '{"sets":[[6,4]],"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('p2', 0, 0, auth.uid()), ('p2', 0, 1, pg_temp.id('b1')), ('p2', 1, 0, pg_temp.id('c1'));
insert into public.match_players (match_id, team, slot, guest_name) values ('p2', 1, 1, 'Zeca');
insert into public.match_events (match_id, seq, event) values ('p2', 0, '{"type":"point","team":0}');
commit;
update public.matches set result = '{"sets":[[6,2]],"winner":0}' where id = 'p2';
select pg_temp.ok((select result->'sets'->0->>1 from public.matches where id = 'p2') = '2', '8. antes de alguém confirmar, Ana ainda corrige o placar');
\o /dev/null
select pg_temp.u('b1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p2' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('c1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p2' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$update public.matches set result = '{"sets":[[6,0]],"winner":0}' where id = 'p2'$$, 'placar_travado', '9. depois que Bia confirmou, Ana não muda o placar');
select pg_temp.err($$insert into public.match_events (match_id, seq, event) values ('p2', 1, '{"type":"point","team":0}')$$, 'placar_travado', '10. nem os lances');
update public.matches set title = 'Final de domingo' where id = 'p2';
select pg_temp.ok((select title from public.matches where id = 'p2') = 'Final de domingo', '11. título e legenda continuam editáveis');
select pg_temp.err($$delete from public.match_players where match_id = 'p2' and user_id = '00000000-0000-0000-0000-0000000000b1'$$, 'jogador_confirmado', '12. Ana não tira da partida quem já confirmou');
delete from public.matches where id = 'p2';
select pg_temp.ok(exists (select 1 from public.matches where id = 'p2' and deleted_at is null), '13. Ana não apaga de vez uma partida que outros confirmaram');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.err($$update public.match_players set tag_status = 'recusado' where match_id = 'p2' and user_id = auth.uid()$$, 'ja_confirmada', '14. Bia não "desconfirma" (para sair, usa Excluir para mim)');
-- ---------- excluir para mim ----------
select pg_temp.ok(public.leave_match('p2') = 'saiu', '15. Bia: Excluir para mim');
select pg_temp.ok(not exists (select 1 from public.my_stats_matches() where id = 'p2'), '16. a partida sai das estatísticas da Bia');
reset role;
select pg_temp.ok((select display_name from public.match_players where match_id = 'p2' and user_id = pg_temp.id('b1')) = 'Bia Parceira', '17. o nome da Bia continua na partida');
set role authenticated;
\o /dev/null
select pg_temp.u('c1');
\o
select pg_temp.ok(exists (select 1 from public.my_stats_matches() where id = 'p2'), '18. para o Caio, a partida continua nas estatísticas gerais');
select pg_temp.ok(not exists (select 1 from public.head_to_head(pg_temp.id('b1')) where match_id = 'p2'), '19. mas sai do confronto Caio × Bia');
select pg_temp.ok(exists (select 1 from public.head_to_head(pg_temp.id('a1')) where match_id = 'p2' and relation = 'contra'), '20. o confronto Caio × Ana continua (os dois seguem na partida)');
select pg_temp.ok(exists (select 1 from public.matches where id = 'p2'), '21. Caio ainda vê a partida (e o nome da Bia nela)');
select pg_temp.ok(not exists (select 1 from public.head_to_head(pg_temp.id('f1')) where match_id = 'p1'), '22. confronto com quem ainda não aceitou (Fabi) não aparece');
-- ---------- pedir exclusão para todos ----------
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p3', auth.uid(), 'padel', now(), '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('p3', 0, 0, auth.uid()), ('p3', 0, 1, pg_temp.id('b1')), ('p3', 1, 0, pg_temp.id('c1'));
commit;
\o /dev/null
select pg_temp.u('b1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p3' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('c1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p3' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok(public.request_match_deletion('p3', 'placar errado') = 'aberto', '23. Bia pede a exclusão para todos: fica aberto até todos responderem');
\o /dev/null
select pg_temp.u('c1');
\o
select pg_temp.ok((select count(*) from public.notifications where user_id = auth.uid() and kind = 'delete_request') = 1, '24. Caio recebe o pedido nas notificações');
select pg_temp.ok(public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'p3'), false) = 'recusado', '25. Caio recusa: o pedido acaba e a partida fica');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok((select count(*) from public.notifications where user_id = auth.uid() and kind = 'delete_refused') = 1, '26. Bia fica sabendo que foi recusado');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.ok(public.request_match_deletion('p3', 'duplicada') = 'aberto', '27. Ana pede de novo');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok(public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'p3' and status = 'aberto'), true) = 'aberto', '28. Bia aceita; falta o Caio');
\o /dev/null
select pg_temp.u('c1');
\o
select pg_temp.ok(public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'p3' and status = 'aberto'), true) = 'aprovado', '29. Caio aceita: todos aceitaram');
select pg_temp.ok(not exists (select 1 from public.matches where id = 'p3'), '30. a partida some para todos');
select pg_temp.err($$select public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'p3' limit 1), true)$$, 'sem voto pendente', '31. não dá para votar duas vezes');
\o /dev/null
select pg_temp.u('d1');
\o
select pg_temp.err($$select public.request_match_deletion('p2')$$, 'só quem está na partida', '32. quem é de fora não pede exclusão');
select pg_temp.err($$insert into public.match_delete_votes (request_id, user_id, vote) select id, auth.uid(), 'sim' from public.match_delete_requests limit 1$$, 'permission denied', '33. ninguém grava voto direto na tabela');
-- quem sai no meio do pedido não trava a votação
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p4', auth.uid(), 'padel', now(), '{"winner":1}');
insert into public.match_players (match_id, team, slot, user_id) values ('p4', 0, 0, auth.uid()), ('p4', 1, 0, pg_temp.id('b1')), ('p4', 1, 1, pg_temp.id('c1'));
commit;
\o /dev/null
select pg_temp.u('b1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p4' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('c1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p4' and user_id = auth.uid();
\o /dev/null
select public.request_match_deletion('p4');
select pg_temp.u('b1');
select public.leave_match('p4');
select pg_temp.u('a1');
\o
select pg_temp.ok(public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'p4' and status = 'aberto'), true) = 'aprovado', '34. Bia saiu no meio do pedido: com o sim da Ana, os que restaram aceitaram');
-- ---------- convites recusados e flood ----------
do $$ declare i int; begin
  for i in 1..3 loop
    insert into public.matches (id, owner_id, sport, played_at, result) values ('r' || i, auth.uid(), 'beach', now(), '{"winner":0}');
    insert into public.match_players (match_id, team, slot, user_id) values ('r' || i, 0, 0, auth.uid()), ('r' || i, 1, 0, '00000000-0000-0000-0000-0000000000c1');
  end loop; end $$;
\o /dev/null
select pg_temp.u('c1');
\o
update public.match_players set tag_status = 'recusado', responded_at = now() where match_id like 'r%' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('r4', auth.uid(), 'beach', now(), '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('r4', 0, 0, auth.uid());
commit;
select pg_temp.err($$insert into public.match_players (match_id, team, slot, user_id) values ('r4', 1, 0, '00000000-0000-0000-0000-0000000000c1')$$, 'convite_recusado_demais', '35. Caio recusou 3 convites da Ana em 30 dias: para de receber dela');
\o /dev/null
select pg_temp.u('d1');
\o
select pg_temp.err($q$do $x$ declare i int; begin for i in 1..61 loop
    insert into public.matches (id, owner_id, sport, played_at, result) values ('f' || i, auth.uid(), 'beach', now(), '{"winner":0}');
    insert into public.match_players (match_id, team, slot, user_id) values ('f' || i, 1, 0, '00000000-0000-0000-0000-0000000000b1');
  end loop; end $x$$q$, 'limite_de_convites', '36. flood: o 61º convite no mesmo dia é barrado');
-- ---------- denúncias ----------
insert into public.reports (reporter_id, target_user_id, category, reason) values (auth.uid(), pg_temp.id('a1'), 'flood_convites', 'convites de partida que não aconteceram');
select pg_temp.ok((select category from public.reports where reporter_id = auth.uid()) = 'flood_convites', '37. Davi denuncia a Ana por flood de convites');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, category, reason) values (auth.uid(), '00000000-0000-0000-0000-0000000000a1', 'ofensivo', 'de novo')$$, 'duplicate key', '38. uma denúncia aberta por alvo');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, category, reason) values (auth.uid(), auth.uid(), 'outro', 'eu mesmo')$$, 'a si mesmo', '39. ninguém se denuncia');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, category, reason) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'outro', 'em nome dela')$$, 'row-level security', '40. ninguém denuncia em nome de outra pessoa');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, category, reason) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1', 'xingou', 'motivo fora da lista')$$, 'check', '41. motivo precisa ser da lista');
select pg_temp.err($$select count(*) from public.report_hotlist$$, 'permission denied', '42. a lista de prioridade é só da equipe');
\o /dev/null
select pg_temp.u('b1');
\o
insert into public.reports (reporter_id, target_group_id, category, reason) values (auth.uid(), :'gid', 'spam', 'grupo de propaganda');
\o /dev/null
select pg_temp.u('c1');
\o
insert into public.reports (reporter_id, target_group_id, category, reason) values (auth.uid(), :'gid', 'ofensivo', 'nome ofensivo');
\o /dev/null
select pg_temp.u('e1');
\o
insert into public.reports (reporter_id, target_group_id, category, reason) values (auth.uid(), :'gid', 'spam', 'spam');
reset role;
select pg_temp.ok((select people from public.report_hotlist where kind = 'grupo') = 3, '43. grupo denunciado por 3 pessoas vai para o topo da fila da equipe');
set role authenticated;
-- ---------- bloqueio: quem foi bloqueado não vê o nome de quem bloqueou ----------
\o /dev/null
select pg_temp.u('c1');
\o
insert into public.blocks (user_id, blocked_id) values (auth.uid(), pg_temp.id('b1'));
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok(not exists (select 1 from public.profiles where id = pg_temp.id('c1')), '43b. Caio bloqueou a Bia: ela não acha o perfil dele');
select pg_temp.err($$select display_name from public.match_players limit 1$$, 'permission denied', '43c. o nome guardado na marcação não sai para os apps');
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('q1', auth.uid(), 'beach', now(), '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('q1', 0, 0, auth.uid());
commit;
select pg_temp.err($$insert into public.match_players (match_id, team, slot, user_id) values ('q1', 1, 0, '00000000-0000-0000-0000-0000000000c1')$$, 'bloqueado', '43d. e ela não marca quem a bloqueou');
-- ---------- foto do grupo e ajuste de marcação ----------
\o /dev/null
select pg_temp.u('a1');
\o
update public.groups set avatar_url = 'avatars/' || auth.uid() || '/g.jpg' where id = :'gid';
select pg_temp.ok((select avatar_url from public.groups where id = :'gid') like 'avatars/%', '44. organizadora põe foto no grupo');
\o /dev/null
select pg_temp.u('a2');
\o
update public.groups set avatar_url = 'avatars/' || auth.uid() || '/minha.jpg' where id = :'gid';
select pg_temp.ok((select avatar_url from public.groups where id = :'gid') like 'avatars/%', '45. membro comum não troca a foto do grupo');
update public.profiles set tag_policy = 'conexoes' where id = auth.uid();
select pg_temp.ok((select tag_policy from public.profiles where id = auth.uid()) = 'conexoes', '46. cada um muda quem pode marcar');
-- ---------- correção de placar e prazos ----------
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p6', auth.uid(), 'beach', now(), '{"sets":[[6,2]],"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('p6', 0, 0, auth.uid()), ('p6', 0, 1, pg_temp.id('b1')), ('p6', 1, 0, pg_temp.id('e1'));
commit;
\o /dev/null
select pg_temp.u('b1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p6' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('e1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p6' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok(public.request_score_correction('p6', '{"sets":[[6,4]],"winner":0}', 'foi 6-4') = 'aberto', '51. Bia sugere a correção do placar: fica aberta até todos responderem');
\o /dev/null
select pg_temp.u('e1');
\o
select pg_temp.ok((select count(*) from public.notifications where user_id = auth.uid() and kind = 'fix_request') = 1, '52. Eva recebe o pedido de correção');
select pg_temp.ok(public.vote_score_correction((select id from public.match_corrections where match_id = 'p6' and status = 'aberto'), false) = 'recusado', '53. Eva recusa: o placar fica');
select pg_temp.ok((select result->'sets'->0->>1 from public.matches where id = 'p6') = '2', '54. placar continua 6-2');
\o /dev/null
select pg_temp.u('b1');
select public.request_score_correction('p6', '{"sets":[[6,4]],"winner":0}', 'foi 6-4 mesmo');
select pg_temp.u('a1');
select public.vote_score_correction((select id from public.match_corrections where match_id = 'p6' and status = 'aberto'), true);
select pg_temp.u('e1');
\o
select pg_temp.ok(public.vote_score_correction((select id from public.match_corrections where match_id = 'p6' and status = 'aberto'), true) = 'aprovado', '55. todos aceitaram a correção');
select pg_temp.ok((select result->'sets'->0->>1 from public.matches where id = 'p6') = '4' and (select corrected_at from public.matches where id = 'p6') is not null, '56. o placar mudou (mesmo travado) e a partida ganhou o selo de corrigida');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$update public.matches set result = '{"sets":[[6,0]],"winner":0}' where id = 'p6'$$, 'placar_travado', '57. fora da correção, o placar continua travado');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok(public.request_score_correction('p6', '{"sets":[[6,3]],"winner":0}') = 'aberto', '58. nova sugestão de correção');
select pg_temp.ok(public.request_match_deletion('p6', 'duplicada') = 'aberto', '59. e um pedido de exclusão');
reset role;
update public.match_corrections set created_at = now() - interval '15 days' where match_id = 'p6' and status = 'aberto';
update public.match_delete_requests set created_at = now() - interval '15 days' where match_id = 'p6' and status = 'aberto';
set role authenticated;
\o /dev/null
select pg_temp.u('e1');
\o
select pg_temp.ok(public.vote_score_correction((select id from public.match_corrections where match_id = 'p6' and status = 'aberto'), true) = 'expirado' and (select result->'sets'->0->>1 from public.matches where id = 'p6') = '4', '60. passou 14 dias sem resposta: a correção expira e o placar fica');
select pg_temp.err($$select public.expire_open_requests()$$, 'permission denied', '61. só o servidor roda a limpeza de prazos');
reset role;
select pg_temp.ok(public.expire_open_requests() = 1, '62. a limpeza agendada fecha o pedido de exclusão vencido');
select pg_temp.ok((select status from public.match_delete_requests where match_id = 'p6' order by created_at desc limit 1) = 'expirado' and exists (select 1 from public.matches where id = 'p6' and deleted_at is null), '63. pedido expirado: a partida fica');
select pg_temp.ok((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind in ('fix_expired', 'delete_expired')) = 2, '64. Bia fica sabendo que os dois pedidos expiraram');
set role authenticated;
-- ---------- conta apagada ----------
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p5', auth.uid(), 'tenis', now(), '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('p5', 0, 0, auth.uid()), ('p5', 1, 0, pg_temp.id('e1'));
commit;
\o /dev/null
select pg_temp.u('e1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'p5' and user_id = auth.uid();
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
\o /dev/null
select pg_temp.u('e1');
\o
select pg_temp.ok(exists (select 1 from public.my_stats_matches() where id = 'p5'), '47. Ana apagou a conta: a partida continua nas estatísticas da Eva');
select pg_temp.ok((select guest_name from public.match_players where match_id = 'p5' and team = 0) = 'Ana Dona' and (select user_id from public.match_players where match_id = 'p5' and team = 0) is null, '48. o nome dela fica na partida, sem link para a conta');
select pg_temp.ok((select owner_id from public.matches where id = 'p5') is null, '49. a partida não foi junto com a conta da dona');
select pg_temp.ok(public.leave_match('p5') = 'apagada', '50. Eva também exclui: sem ninguém com conta, a partida some de vez');
-- ---------- o servidor manda nas respostas, e ninguém trava pedidos ao apagar a conta ----------
reset role;
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a3', '{"name":"Gil Dono"}'), ('00000000-0000-0000-0000-0000000000a4', '{"name":"Iara Marcada"}'),
 ('00000000-0000-0000-0000-0000000000a5', '{"name":"Juca Recusa"}');
set role authenticated;
\o /dev/null
select pg_temp.u('a3');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p7', auth.uid(), 'padel', now(), '{"sets":[[6,2]],"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('p7', 0, 0, auth.uid()), ('p7', 1, 0, pg_temp.id('a4')), ('p7', 1, 1, pg_temp.id('a5'));
commit;
\o /dev/null
select pg_temp.u('a4');
\o
select pg_temp.err($$delete from public.match_players where match_id = 'p7' and user_id = auth.uid()$$, 'use_sair_da_partida', '65. quem foi marcado não apaga a própria linha (recusa ou sai pela partida)');
update public.match_players set tag_status = 'aceito', responded_at = '2020-01-01' where match_id = 'p7' and user_id = auth.uid();
select pg_temp.ok((select responded_at from public.match_players where match_id = 'p7' and user_id = auth.uid()) > now() - interval '1 minute', '66. a hora do aceite é a do servidor, não a que o aparelho mandou');
\o /dev/null
select pg_temp.u('a5');
\o
update public.match_players set tag_status = 'recusado' where match_id = 'p7' and user_id = auth.uid();
select pg_temp.err($$update public.match_players set tag_status = 'pendente' where match_id = 'p7' and user_id = auth.uid()$$, 'ja_respondida', '67. recusou: não volta para pendente (zerar a contagem de recusas)');
\o /dev/null
select pg_temp.u('a3');
\o
select pg_temp.ok(public.request_score_correction('p7', '{"sets":[[6,3]],"winner":0}') = 'aberto', '68. Gil pede correção; Iara precisa aceitar');
\o /dev/null
select pg_temp.u('a4');
\o
update public.profiles set deleted_at = now() where id = auth.uid();
\o /dev/null
select pg_temp.u('a3');
\o
select pg_temp.ok((select status from public.match_corrections where match_id = 'p7') = 'aprovado', '69. Iara apagou a conta: o pedido não fica preso esperando por ela');
select pg_temp.ok((select result->'sets'->0->>1 from public.matches where id = 'p7') = '3', '70. e a correção de Gil vale');
select pg_temp.ok(public.request_match_deletion('p7', 'dup') = 'aprovado', '71. só sobrou o Gil confirmado: o pedido de exclusão dele já vale');
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('p8', auth.uid(), 'padel', now(), '{"winner":1}');
insert into public.match_players (match_id, team, slot, user_id) values ('p8', 0, 0, auth.uid()), ('p8', 1, 0, pg_temp.id('a5'));
commit;
\o /dev/null
select pg_temp.u('a5');
\o
select pg_temp.err($$select public.request_match_deletion('p8', 'antes de aceitar')$$, 'só quem está', '72. quem ainda não aceitou a marcação não pede exclusão');
update public.match_players set tag_status = 'aceito' where match_id = 'p8' and user_id = auth.uid();
select pg_temp.ok(public.request_match_deletion('p8', 'duplicada') = 'aberto', '73. Juca aceitou e pede exclusão; falta o Gil');
\o /dev/null
select pg_temp.u('a3');
\o
select pg_temp.err($$select public.request_match_deletion('p8', 'de novo')$$, 'pedido_em_andamento', '74. dois pedidos de exclusão na mesma partida: o segundo recebe um aviso claro');
select pg_temp.ok(exists (select 1 from public.feed_following() where id = 'p8') and not exists (select 1 from public.feed_following() where id = 'p7'), '75. a timeline Seguindo mostra a partida aberta e não mostra a apagada');
-- ---------- foto só do próprio armazenamento ----------
\o /dev/null
select pg_temp.u('a3');
\o
select pg_temp.err($$update public.profiles set avatar_url = 'https://rastreador.exemplo.com/pixel.gif' where id = auth.uid()$$, 'violates check constraint', '76. foto de perfil de fora do app é recusada (evita rastrear quem abre o perfil)');
update public.profiles set avatar_url = 'avatars/' || auth.uid() || '/foto.jpg' where id = auth.uid();
select pg_temp.ok((select avatar_url from public.profiles where id = auth.uid()) like 'avatars/%', '77. foto no armazenamento do app vale');
-- ---------- vídeo na nuvem só para Pro ----------
select pg_temp.err($$insert into public.video_segments (match_id, owner_id, storage_path, start_at, end_at, bytes, mime) values ('p8', auth.uid(), auth.uid() || '/p8/1.webm', now() - interval '5 minutes', now(), 1000, 'video/webm')$$, 'row-level security', '78. sem Pro, não sobe trecho de vídeo para a nuvem');
reset role;
update public.profiles set pro_until = now() + interval '30 days' where id = '00000000-0000-0000-0000-0000000000a3';
set role authenticated;
insert into public.video_segments (match_id, owner_id, storage_path, start_at, end_at, bytes, mime) values ('p8', auth.uid(), auth.uid() || '/p8/1.webm', now() - interval '5 minutes', now(), 1000, 'video/webm');
select pg_temp.ok(exists (select 1 from public.video_segments where match_id = 'p8'), '79. com Pro, sobe');
reset role;
update public.profiles set pro_until = null where id = '00000000-0000-0000-0000-0000000000a3';
set role authenticated;
select pg_temp.ok(exists (select 1 from public.video_segments where match_id = 'p8'), '80. o Pro acabou: o vídeo que já subiu continua visível para o dono');
