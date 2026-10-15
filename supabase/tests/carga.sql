-- Teste de carga: volume de um app com alguns milhares de atletas, para medir as telas e ações mais usadas.
-- 5.000 pessoas, 200.000 "seguir", 200 grupos, 100.000 partidas, 400.000 marcações (85% aceitas, 10% pendentes, 5% recusadas).
-- Rodar depois do schema.sql, num banco vazio: psql -f tests/supabase-stub.sql -f schema.sql -f tests/carga.sql
\set QUIET on
\pset footer off
\pset tuples_only on
select setseed(0.42);
-- carga em massa sem os gatilhos (como uma importação); as medições depois usam as regras normais
set session_replication_role = replica;
insert into auth.users (id, raw_user_meta_data)
  select ('00000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid, jsonb_build_object('name', 'Atleta ' || i) from generate_series(1, 5000) i;
insert into public.profiles (id, public_id, name, tag_policy, privacy_level)
  select id, 'UP-T' || substr(id::text, 25), raw_user_meta_data->>'name',
         (array['todos','todos','todos','conexoes','sigo'])[1 + floor(random() * 5)::int],
         (array['aberto','aberto','aberto','personalizado','privado'])[1 + floor(random() * 5)::int]
  from auth.users;
create temp table u as select row_number() over (order by id) as n, id from public.profiles;
create index on u (n);
insert into public.follows (follower_id, followee_id, status)
  select a.id, b.id, 'ativo' from u a join generate_series(1, 40) g on true join u b on b.n = 1 + ((a.n * 7919 + g * 104729) % 5000)
  where a.id <> b.id on conflict do nothing;
insert into public.groups (id, code, name, sport, created_by, open)
  select ('00000000-0000-0000-0002-' || lpad(to_hex(g), 12, '0'))::uuid, 'G-T' || g, 'Grupo ' || g, (array['beach','padel','tenis','peteca','volei'])[1 + g % 5], (select id from u where n = g), g % 3 = 0
  from generate_series(1, 200) g;
insert into public.group_members (group_id, user_id, role, status)
  select ('00000000-0000-0000-0002-' || lpad(to_hex(g), 12, '0'))::uuid, (select id from u where n = 1 + ((g * 31 + k * 977) % 5000)), case when k = 0 then 'admin' else 'membro' end, 'ativo'
  from generate_series(1, 200) g, generate_series(0, 14) k on conflict do nothing;
insert into public.matches (id, code, owner_id, group_id, sport, played_at, result, status, visibility, created_at)
  select 'm' || i, 'P-T' || i, (select id from u where n = 1 + (i * 13 % 5000)),
         case when i % 3 = 0 then ('00000000-0000-0000-0002-' || lpad(to_hex(1 + i % 200), 12, '0'))::uuid end,
         (array['beach','padel','tenis','peteca','volei'])[1 + i % 5],
         now() - (i * interval '10 minutes'), jsonb_build_object('sets', '[[6,3]]'::jsonb, 'winner', i % 2), 'publicada',
         (array['todos','todos','seguidores','so-eu'])[1 + i % 4], now() - (i * interval '10 minutes')
  from generate_series(1, 100000) i;
insert into public.match_players (match_id, team, slot, user_id, tag_status, display_name, created_at, responded_at, left_at)
  select 'm' || i, s / 2, s % 2, (select id from u where n = 1 + ((i * 13 + s * 1777) % 5000)),
         case when s = 0 then 'aceito' else (array['aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','aceito','pendente','pendente','recusado'])[1 + floor(random() * 20)::int] end,
         'Atleta', now() - (i * interval '10 minutes'), now() - (i * interval '10 minutes'), case when random() < 0.03 then now() end
  from generate_series(1, 100000) i, generate_series(0, 3) s;
set session_replication_role = origin;
analyze;
select 'volume: ' || (select count(*) from public.profiles) || ' pessoas · ' || (select count(*) from public.follows) || ' seguir · ' || (select count(*) from public.matches) || ' partidas · ' || (select count(*) from public.match_players) || ' marcações';

-- quem mede: o dono da partida m13 (atleta com muitas partidas)
select owner_id as me from public.matches where id = 'm13' \gset
select user_id as partner from public.match_players where match_id = 'm13' and slot = 1 and team = 0 \gset
-- partidas em que ele jogou com outras pessoas confirmadas (para sair, pedir exclusão e corrigir)
select string_agg(match_id, ',' order by match_id) as mine from (select p.match_id from public.match_players p join public.matches m on m.id = p.match_id
  where p.user_id = :'me' and p.tag_status = 'aceito' and p.left_at is null and public.match_has_others(p.match_id, :'me') order by p.match_id limit 3) x \gset
select split_part(:'mine', ',', 1) as m_leave, split_part(:'mine', ',', 2) as m_del, split_part(:'mine', ',', 3) as m_fix \gset
create function pg_temp.t(label text, q text) returns text language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); n bigint; ms numeric;
begin execute 'select count(*) from (' || q || ') x' into n; ms := round(extract(epoch from clock_timestamp() - t0)::numeric * 1000, 1);
  return rpad(label, 46) || lpad(ms::text, 8) || ' ms  (' || n || ' linhas)' || case when ms > 300 then '  << LENTO' else '' end; end $$;
grant execute on function pg_temp.t(text, text) to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', :'me', false) \g /dev/null
select pg_temp.t('timeline (30 mais recentes que posso ver)', 'select id from public.matches where status = ''publicada'' and deleted_at is null order by played_at desc limit 30');
select pg_temp.t('timeline Seguindo (de quem eu sigo)', 'select id from public.matches where owner_id in (select followee_id from public.follows where follower_id = auth.uid() and status = ''ativo'') and status = ''publicada'' and deleted_at is null order by played_at desc limit 30');
select pg_temp.t('timeline Seguindo pela função feed_following', 'select id from public.feed_following()');
select case when (select array_agg(id order by played_at desc, id) from public.feed_following(null, 50)) = (select array_agg(id order by played_at desc, id) from (select id, played_at from public.matches where (owner_id = auth.uid() or owner_id in (select followee_id from public.follows where follower_id = auth.uid() and status = 'ativo')) and status = 'publicada' and deleted_at is null order by played_at desc limit 50) x)
  then 'ok   a função devolve as mesmas partidas que a regra de linha' else 'ERRO a função e a regra de linha discordam' end;
select pg_temp.t('busca de pessoas por nome', 'select id from public.profiles where name ilike ''%atleta 12%'' limit 20');
select pg_temp.t('minhas partidas (perfil)', 'select id from public.matches where owner_id = auth.uid() order by played_at desc limit 50');
select pg_temp.t('minhas estatísticas (partidas confirmadas)', 'select * from public.my_stats_matches()');
select pg_temp.t('confronto com um jogador', 'select * from public.head_to_head(''' || :'partner' || '''::uuid)');
select pg_temp.t('contadores do perfil', 'select * from public.profile_counts(auth.uid())');
select pg_temp.t('notificações (50)', 'select id from public.notifications where user_id = auth.uid() order by created_at desc limit 50');
select pg_temp.t('ranking do grupo', 'select * from public.group_ranking(''00000000-0000-0000-0002-00000000000d''::uuid)');
select pg_temp.t('marcações de uma partida', 'select team, slot, user_id, guest_name, tag_status from public.match_players where match_id = ''m13''');
-- quem acabou de chegar (não segue ninguém): a timeline Geral precisa achar 30 partidas visíveis
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0001-000000000fff', false) \g /dev/null
select pg_temp.t('timeline Geral de quem acabou de chegar', 'select id from public.matches where status = ''publicada'' and deleted_at is null order by played_at desc limit 30');
select set_config('request.jwt.claim.sub', :'me', false) \g /dev/null
-- ações (com as regras e gatilhos ligados)
create function pg_temp.a(label text, q text) returns text language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); ms numeric; r text;
begin execute q into r; ms := round(extract(epoch from clock_timestamp() - t0)::numeric * 1000, 1);
  return rpad(label, 46) || lpad(ms::text, 8) || ' ms  (' || coalesce(r, 'ok') || ')' || case when ms > 300 then '  << LENTO' else '' end;
exception when others then return rpad(label, 46) || '  recusado: ' || sqlerrm; end $$;
grant execute on function pg_temp.a(text, text) to authenticated;
select pg_temp.a('criar partida (save_match: partida e dona juntas)', 'select public.save_match(jsonb_build_object(''id'', ''novo1'', ''sport'', ''beach'', ''played_at'', now(), ''result'', ''{"winner":0}''::jsonb), jsonb_build_array(jsonb_build_object(''team'', 0, ''slot'', 0, ''user_id'', auth.uid())))');
select pg_temp.a('marcar 3 pessoas (com política e limites)', 'with x as (insert into public.match_players (match_id, team, slot, user_id) select ''novo1'', 1, s, (select id from public.profiles where tag_policy = ''todos'' and id <> auth.uid() order by id offset s limit 1) from generate_series(0, 2) s returning 1) select count(*)::text from x');
select pg_temp.a('marcar mais 1 (conta os convites do dia)', 'with x as (insert into public.match_players (match_id, team, slot, user_id) select ''novo1'', 1, 3, (select id from public.profiles where tag_policy = ''todos'' and id <> auth.uid() order by id offset 9 limit 1) returning 1) select count(*)::text from x');
select pg_temp.a('excluir para mim (partida com 4 pessoas)', 'select public.leave_match(''' || :'m_leave' || ''')');
select pg_temp.a('pedir exclusão para todos', 'select public.request_match_deletion(''' || :'m_del' || ''', ''teste'')');
select pg_temp.a('pedir correção de placar', 'select public.request_score_correction(''' || :'m_fix' || ''', ''{"sets":[[6,4]],"winner":0}'')');
reset role;
select pg_temp.a('limpeza de prazos (servidor)', 'select public.expire_open_requests()::text');
select pg_temp.a('apagar conta com centenas de partidas', 'delete from auth.users where id = ''' || :'partner' || ''' returning 1');
