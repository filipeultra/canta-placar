-- Regras de arquivos (storage.sql): foto só na própria pasta, vídeo na nuvem só para Pro. Rodar: supabase-stub.sql, schema.sql, tests/storage-stub.sql, storage.sql e este arquivo.
\set QUIET on
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e1', '{"name":"Eva"}'), ('00000000-0000-0000-0000-0000000000e2', '{"name":"Rui"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false) \g /dev/null
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000e1/foto.jpg');
do $$ begin update storage.objects set name = '00000000-0000-0000-0000-0000000000e2/foto.jpg' where bucket_id = 'avatars'; exception when others then raise notice 'recusado: %', sqlerrm; end $$;
select case when count(*) = 1 then 'ok   foto não vai para a pasta de outra pessoa' else 'ERRO moveu' end from storage.objects where bucket_id = 'avatars' and name like '00000000-0000-0000-0000-0000000000e1/%';
update storage.objects set name = '00000000-0000-0000-0000-0000000000e1/nova.jpg' where bucket_id = 'avatars';
select case when count(*) = 1 then 'ok   troca a própria foto' else 'ERRO não trocou' end from storage.objects where name = '00000000-0000-0000-0000-0000000000e1/nova.jpg';
do $$ begin insert into storage.objects (bucket_id, name) values ('videos', '00000000-0000-0000-0000-0000000000e1/m1/1.webm'); raise notice 'ERRO: subiu vídeo sem Pro'; exception when others then raise notice 'ok   sem Pro não sobe vídeo (%)', sqlerrm; end $$;
reset role;
update public.profiles set pro_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
insert into storage.objects (bucket_id, name) values ('videos', '00000000-0000-0000-0000-0000000000e1/m1/1.webm');
select case when count(*) = 1 then 'ok   com Pro sobe vídeo' else 'ERRO com Pro não subiu' end from storage.objects where bucket_id = 'videos';
reset role;
update public.profiles set pro_until = null where id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select case when count(*) = 1 then 'ok   sem Pro, ainda vê o vídeo que já subiu' else 'ERRO sumiu' end from storage.objects where bucket_id = 'videos';
delete from storage.objects where bucket_id = 'videos';
select case when count(*) = 0 then 'ok   e consegue apagar' else 'ERRO não apagou' end from storage.objects where bucket_id = 'videos';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false) \g /dev/null
select case when count(*) = 0 then 'ok   outra pessoa não vê os vídeos de ninguém' else 'ERRO vazou' end from storage.objects where bucket_id = 'videos';
reset role;
select 'tipos de vídeo: ' || array_to_string(allowed_mime_types, ', ') from storage.buckets where id = 'videos';
