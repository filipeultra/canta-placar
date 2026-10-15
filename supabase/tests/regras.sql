\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', '{"name":"Ana Org"}'), ('00000000-0000-0000-0000-00000000000b', '{"name":"Bia Autorizou"}'),
 ('00000000-0000-0000-0000-00000000000c', '{"name":"Caio Nao"}'), ('00000000-0000-0000-0000-00000000000d', '{"name":"Davi Fora"}'),
 ('00000000-0000-0000-0000-00000000000e', '{"name":"Eva Privada"}');
update public.profiles set privacy_level = 'privado' where name = 'Eva Privada';
create or replace function pg_temp.u(c char) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || c, false) $$;
set role authenticated;
\o /dev/null
select pg_temp.u('a');
\o
insert into public.groups (name, sport, created_by) values ('Beach todo domingo', 'beach', auth.uid());
select code as gcode, id as gid from public.groups limit 1 \gset
select '1. A no grupo: ' || role || '/' || status from public.group_members where user_id = auth.uid();
\o /dev/null
select pg_temp.u('b');
\o
insert into public.group_members (group_id, user_id) select id, auth.uid() from public.group_by_code(:'gcode');
select '2. B ao pedir (grupo fechado): ' || role || '/' || status from public.group_members where user_id = auth.uid();
\o /dev/null
select pg_temp.u('c');
\o
insert into public.group_members (group_id, user_id, role) select id, auth.uid(), 'admin' from public.group_by_code(:'gcode');
select '3. C tentou entrar como admin: ' || role || '/' || status from public.group_members where user_id = auth.uid();
\o /dev/null
select pg_temp.u('a');
\o
select '4. A recebeu pedidos: ' || count(*) from public.notifications where kind = 'group_request';
update public.group_members set status = 'ativo' where status = 'pendente';
select '5. membros ativos: ' || count(*) from public.group_members where status = 'ativo';
\o /dev/null
select pg_temp.u('d');
\o
select '6. D (de fora) vê grupos fechados: ' || count(*) from public.groups;
\o /dev/null
select public.join_group_by_code(:'gcode');
\o
select '7. D pelo convite: ' || status from public.group_members where user_id = auth.uid();
-- (a autorização ao organizador saiu: no grupo, qualquer membro marca outro, e a marcação ainda precisa ser aceita)
select '8. estar no grupo basta para ser marcado na partida do grupo (ver tests/partidas.sql)';
select '9. a marcação continua indo para aceitar nas notificações';
-- A lança partida do grupo com B, C e um convidado
\o /dev/null
select pg_temp.u('a');
\o
insert into public.matches (id, owner_id, group_id, sport, played_at, result) values ('m1', auth.uid(), :'gid', 'beach', now(), '{"sets":[[6,3]],"winner":0}');
insert into public.match_players (match_id, team, slot, user_id, guest_name) values ('m1', 0, 0, auth.uid(), null), ('m1', 0, 1, '00000000-0000-0000-0000-00000000000b', null), ('m1', 1, 0, '00000000-0000-0000-0000-00000000000c', null), ('m1', 1, 1, null, 'Zeca');
select '10. marcação ' || coalesce(p.name, mp.guest_name) || ': ' || coalesce(mp.tag_status, '-') from public.match_players mp left join public.profiles p on p.id = mp.user_id where match_id = 'm1' order by team, slot;
\o /dev/null
select pg_temp.u('b');
\o
select '11. B notificações: ' || string_agg(kind, ',') from public.notifications where user_id = auth.uid();
\o /dev/null
select pg_temp.u('c');
\o
select '12. C notificações: ' || string_agg(kind, ',') from public.notifications where user_id = auth.uid();
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'm1' and user_id = auth.uid();
update public.match_players set tag_status = 'recusado' where match_id = 'm1' and user_id = '00000000-0000-0000-0000-00000000000b';
select '13. C aceitou a dele; tentou mexer na de B → B segue: ' || tag_status from public.match_players where match_id = 'm1' and user_id = '00000000-0000-0000-0000-00000000000b';
-- ranking do grupo
select '14. ranking: ' || string_agg(p.name || ' ' || wins || '/' || played, ' · ' order by wins desc, p.name) from public.group_ranking(:'gid') r join public.profiles p on p.id = r.user_id;
-- visibilidade
\o /dev/null
select pg_temp.u('e');
\o
begin;   -- partida e jogadores na mesma transação (fora do grupo, quem lança joga)
insert into public.matches (id, owner_id, sport, played_at, result) values ('e1', auth.uid(), 'beach', now(), '{"winner":1}');
insert into public.match_players (match_id, team, slot, user_id) values ('e1', 0, 0, auth.uid());
commit;
\o /dev/null
select pg_temp.u('d');
\o
select '15. D vê a partida pública de A (no grupo dele): ' || count(*) from public.matches where id = 'm1';
select '16. D vê partida de perfil privado (E): ' || count(*) from public.matches where id = 'e1';
insert into public.follows (follower_id, followee_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000e');
select '17. D pediu para seguir E: ' || status from public.follows where follower_id = auth.uid();
\o /dev/null
select pg_temp.u('e');
\o
update public.follows set status = 'ativo' where followee_id = auth.uid();
\o /dev/null
select pg_temp.u('d');
\o
select '18. D aprovado vê a partida de E: ' || count(*) from public.matches where id = 'e1';
\o /dev/null
select pg_temp.u('e');
\o
insert into public.blocks (user_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000d');
\o /dev/null
select pg_temp.u('d');
\o
select '19. depois do bloqueio, D vê E: partida ' || (select count(*) from public.matches where id = 'e1') || ', perfil ' || (select count(*) from public.profiles where name = 'Eva Privada') || ', segue ' || (select count(*) from public.follows where followee_id = '00000000-0000-0000-0000-00000000000e');
do $$ begin insert into public.zaps (match_id, user_id) values ('e1', auth.uid()); raise notice '20. ERRO: zap passou'; exception when insufficient_privilege then raise notice '20. D bloqueado não dá zap em E'; end $$;
-- resenha e zap
insert into public.group_posts (group_id, user_id, text) values (:'gid', auth.uid(), 'Domingo tem!');
insert into public.zaps (match_id, user_id) values ('m1', auth.uid());
\o /dev/null
select pg_temp.u('a');
\o
select '21. A vê resenha: ' || count(*) || ' · notificação de zap: ' || (select count(*) from public.notifications where user_id = auth.uid() and kind = 'zap') from public.group_posts;
\o /dev/null
select pg_temp.u('d');
\o
do $$ begin insert into public.zaps (match_id, user_id) values ('m1', '00000000-0000-0000-0000-00000000000b'); raise notice '22. ERRO: zap em nome de outro'; exception when insufficient_privilege then raise notice '22. ninguém dá zap em nome de outro'; end $$;
set role authenticated;
\o /dev/null
select pg_temp.u('b');
\o
do $$ begin update public.profiles set pro_until = now() + interval '10 years' where id = auth.uid(); raise notice '24. ERRO: B se deu Pro'; exception when insufficient_privilege then raise notice '24. ninguém se dá Pro (pro_until só pelo servidor)'; end $$;
update public.profiles set bio = 'Beach todo dia' where id = auth.uid();
select '25. B edita a própria bio: ' || bio from public.profiles where id = auth.uid();
do $$ begin update public.match_players set team = 1 where match_id = 'm1' and user_id = auth.uid(); raise notice '26. ERRO: B trocou de time'; exception when insufficient_privilege then raise notice '26. marcado não troca de time nem de lugar'; end $$;
do $$ begin insert into public.notifications (user_id, kind) values (auth.uid(), 'zap'); raise notice '27. ERRO: notificação falsa'; exception when insufficient_privilege then raise notice '27. ninguém cria notificação falsa'; end $$;
select '28. (autorização ao organizador removida)';
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
select '29. anônimo vê partidas públicas: ' || count(*) || ' · grupos fechados: ' || (select count(*) from public.groups) from public.matches;
