-- Fotos da partida, "não mostrar na timeline" e blocos escondidos de quem não jogou (schema.sql + storage.sql).
-- Rodar: supabase-stub.sql, schema.sql, tests/storage-stub.sql, storage.sql e este arquivo. Cada linha sai "ok" ou "ERRO".
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', '{"name":"Ana Dona"}'), ('00000000-0000-0000-0000-0000000000b1', '{"name":"Bia Parceira"}'),
 ('00000000-0000-0000-0000-0000000000c1', '{"name":"Caio Segue"}'), ('00000000-0000-0000-0000-0000000000d1', '{"name":"Davi Estranho"}');
create function pg_temp.u(c text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false) $$;
create function pg_temp.id(c text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || c)::uuid $$;
create function pg_temp.ok(cond boolean, label text) returns text language sql as $$ select case when coalesce(cond, false) then 'ok   ' else 'ERRO ' end || label $$;
create function pg_temp.err(q text, want text, label text) returns text language plpgsql as $$
begin execute q; return 'ERRO ' || label || ': passou sem erro';
exception when others then if sqlerrm like '%' || want || '%' then return 'ok   ' || label || ' (' || sqlerrm || ')'; else return 'ERRO ' || label || ': ' || sqlerrm; end if; end $$;
-- quantas linhas um comando mexeu (delete/update que a regra de linha esconde não dá erro: mexe em 0)
create function pg_temp.rows(q text) returns integer language plpgsql as $$ declare n integer; begin execute q; get diagnostics n = row_count; return n; end $$;
grant execute on all functions in schema pg_temp to authenticated;
\set ana '00000000-0000-0000-0000-0000000000a1'
set role authenticated;
\o /dev/null
select pg_temp.u('a1');
\o
-- ---------- partida com fotos, fora da timeline e golpes escondidos ----------
\o /dev/null
select public.save_match(jsonb_build_object('id', 'm1', 'sport', 'beach', 'played_at', now() - interval '1 hour', 'visibility', 'seguidores',
  'result', '{"sets":[[6,3]],"winner":0}'::jsonb, 'summary', '{"pts":[24,15],"aces":[2,1],"timeline":[0,1,2,1,2,3]}'::jsonb,
  'photos', '[{"id":"fabc1234","w":1280,"h":960},{"id":"fdef5678","w":960,"h":1280}]'::jsonb, 'in_feed', false, 'hide_shots', true),
  jsonb_build_array(jsonb_build_object('team', 0, 'slot', 0, 'user_id', auth.uid()), jsonb_build_object('team', 0, 'slot', 1, 'user_id', pg_temp.id('b1')),
                    jsonb_build_object('team', 1, 'slot', 0, 'guest_name', 'Rival')));
select public.save_match(jsonb_build_object('id', 'm2', 'sport', 'beach', 'played_at', now() - interval '2 hours', 'result', '{"sets":[[4,6]],"winner":1}'::jsonb,
  'summary', '{"pts":[10,14],"timeline":[0,-1,-2]}'::jsonb), jsonb_build_array(jsonb_build_object('team', 0, 'slot', 0, 'user_id', auth.uid()), jsonb_build_object('team', 1, 'slot', 0, 'guest_name', 'Outro')));
\o
insert into public.match_events (match_id, seq, event) values ('m1', 1, '{"type":"point","team":0,"shot":"smash"}'), ('m1', 2, '{"type":"point","team":1}'), ('m2', 1, '{"type":"point","team":1}');
select pg_temp.ok((select jsonb_array_length(photos) = 2 and not in_feed and hide_shots and not hide_moment from public.matches where id = 'm1'), '1. save_match guarda as fotos, "fora da timeline" e o bloco escondido');
select pg_temp.err($$update public.matches set photos = (select jsonb_agg(jsonb_build_object('id', 'fphoto00' || g, 'w', 800, 'h', 600)) from generate_series(1, 7) g) where id = 'm2'$$, 'photos_check', '2. no máximo 6 fotos por partida');
select pg_temp.err($$update public.matches set photos = '[{"id":"../x","w":800,"h":600}]' where id = 'm2'$$, 'photos_check', '3. id de foto fora do formato é recusado');
select pg_temp.err($$update public.matches set photos = '[{"id":"fabc1234","w":800,"h":600,"src":"https://outro.site/x.jpg"}]' where id = 'm2'$$, 'photos_check', '4. foto não carrega link de fora (só id, w, h)');
select pg_temp.err($$update public.matches set photos = '{"id":"fabc1234"}' where id = 'm2'$$, 'photos_check', '5. fotos precisam ser uma lista');
update public.matches set photos = '[{"id":"fzzz9999","w":800,"h":600}]' where id = 'm2';
select pg_temp.ok((select photos -> 0 ->> 'id' = 'fzzz9999' from public.matches where id = 'm2'), '6. o dono troca as fotos da própria partida');
-- ---------- timeline e perfil ----------
\o /dev/null
select pg_temp.u('c1');
\o
insert into public.follows (follower_id, followee_id) values (auth.uid(), pg_temp.id('a1'));
select pg_temp.ok((select not bool_or(id = 'm1') and bool_or(id = 'm2') from public.feed_following()), '7. quem segue não vê na timeline a partida "fora da timeline" (vê as outras)');
select pg_temp.ok(public.can_see_match('m1', auth.uid()), '8. mas ela continua no perfil da dona para quem segue');
select pg_temp.ok((select count(*) = 0 from public.match_events where match_id = 'm1'), '9. com golpes escondidos, quem não jogou não lê o ponto a ponto');
select pg_temp.ok((select count(*) = 1 from public.match_events where match_id = 'm2'), '10. sem nada escondido, quem segue lê o ponto a ponto');
select pg_temp.ok((select summary ? 'pts' from public.matches where id = 'm1'), '11. o resumo (pontos e aces) continua aberto para quem pode ver a partida');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.ok((select bool_or(id = 'm1') from public.feed_following()), '12. na timeline da própria dona ela aparece');
\o /dev/null
select pg_temp.u('b1');
\o
update public.match_players set tag_status = 'aceito', responded_at = now() where match_id = 'm1' and user_id = auth.uid();
select pg_temp.ok((select count(*) = 2 from public.match_events where match_id = 'm1'), '13. quem jogou (marcação aceita) lê o ponto a ponto mesmo com bloco escondido');
select pg_temp.ok(public.played_match('m1', auth.uid()) and not public.played_match('m1', pg_temp.id('a1')), '14. played_match: a parceira jogou; e pelo app não dá para perguntar de outra pessoa (nem da dona)');
-- ---------- esconder o momento a momento numa partida já confirmada ----------
\o /dev/null
select pg_temp.u('a1');
\o
update public.matches set hide_moment = true where id = 'm1';
select pg_temp.ok((select hide_moment and not (summary ? 'timeline') and summary ? 'pts' from public.matches where id = 'm1'), '15. esconder o momento a momento tira a linha do jogo do resumo, mesmo com o placar travado');
select pg_temp.err($$update public.matches set summary = '{"pts":[30,15]}' where id = 'm1'$$, 'placar_travado', '16. o resto do resumo segue travado depois que a parceira confirmou');
update public.matches set hide_moment = false, hide_shots = false, summary = '{"pts":[24,15],"aces":[2,1],"timeline":[0,1,2,1,2,3]}' where id = 'm1';
select pg_temp.ok((select summary ? 'timeline' from public.matches where id = 'm1'), '17. mostrar de novo devolve a linha do jogo');
update public.matches set hide_shots = true where id = 'm1';
-- ---------- arquivos no bucket photos ----------
insert into storage.objects (bucket_id, name) values ('photos', :'ana' || '/m1/fabc1234-sm.webp'), ('photos', :'ana' || '/m1/fabc1234-lg.webp');
select pg_temp.ok((select count(*) = 2 from storage.objects where bucket_id = 'photos'), '18. a dona sobe as duas versões da foto na própria partida');
select pg_temp.err(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ana' || '/m1/foto.png'), 'row-level security', '19. nome fora do padrão (ou PNG) é recusado');
select pg_temp.err(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ana' || '/m1/../m2/fabc1234-sm.webp'), 'row-level security', '20. caminho com ".." é recusado');
select pg_temp.err(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, '00000000-0000-0000-0000-0000000000c1/m1/fabc1234-sm.webp'), 'row-level security', '21. ninguém sobe na pasta de outra pessoa');
\o /dev/null
select pg_temp.u('c1');
\o
\o /dev/null
select public.save_match(jsonb_build_object('id', 'm3', 'sport', 'padel', 'played_at', now() - interval '3 hours', 'result', '{"sets":[[6,2]],"winner":0}'::jsonb),
  jsonb_build_array(jsonb_build_object('team', 0, 'slot', 0, 'user_id', auth.uid()), jsonb_build_object('team', 1, 'slot', 0, 'guest_name', 'Zé')));
\o
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ana' || '/m3/fabc1234-sm.webp'), 'row-level security', '22. nem na partida de outra pessoa dentro da própria pasta');
insert into storage.objects (bucket_id, name) select 'photos', :'ana' || '/m1/fphoto' || lpad(g::text, 3, '0') || '-sm.webp' from generate_series(1, 10) g;
select pg_temp.err(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ana' || '/m1/fextra123-sm.webp'), 'row-level security', '23. no máximo 12 arquivos (6 fotos) por partida');
-- ---------- quem vê ----------
\o /dev/null
select pg_temp.u('c1');
\o
select pg_temp.ok((select count(*) = 12 from storage.objects where bucket_id = 'photos'), '24. quem segue (partida só para seguidores) vê as fotos');
select pg_temp.ok(pg_temp.rows($$delete from storage.objects where bucket_id = 'photos'$$) = 0, '25. e não apaga as fotos de ninguém');
\o /dev/null
select pg_temp.u('d1');
\o
select pg_temp.ok((select count(*) = 0 from storage.objects where bucket_id = 'photos'), '26. quem não segue não vê as fotos da partida só para seguidores');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.ok(pg_temp.rows($$delete from storage.objects where bucket_id = 'photos' and name like '%fphoto0%'$$) = 10, '27. a dona apaga as próprias fotos');
-- ---------- limite do dia ----------
reset role;
insert into storage.objects (bucket_id, name, owner, created_at) select 'photos', :'ana' || '/m9/fday' || lpad(g::text, 4, '0') || '-sm.webp', :'ana', now() - interval '1 hour' from generate_series(1, 120) g;
set role authenticated;
select pg_temp.err(format($$insert into storage.objects (bucket_id, name) values ('photos', %L)$$, :'ana' || '/m1/fnovo123-sm.webp'), 'row-level security', '28. até 120 arquivos por dia por pessoa (barra quem tentar encher o servidor)');
reset role;
select pg_temp.ok((select not public and file_size_limit <= 524288 and allowed_mime_types = array['image/webp', 'image/jpeg'] from storage.buckets where id = 'photos'), '29. bucket photos: privado, até 512 KB por arquivo, só WebP e JPEG');
select pg_temp.ok(not has_function_privilege('anon', 'public.photo_room(text)', 'execute'), '30. a conta do limite não é chamada por quem não entrou');
