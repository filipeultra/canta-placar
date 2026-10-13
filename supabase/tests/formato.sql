-- ULTRA PLAY · testes das predefinições de formato e do apelido na partida.
-- Rodar numa base nova depois de supabase-stub.sql e schema.sql. Linha com "ERRO" = regra falhou.
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000f1', '{"name":"Fabi Gratis"}'), ('00000000-0000-0000-0000-0000000000f2', '{"name":"Gabi Pro"}');
update public.profiles set pro_until = now() + interval '30 days' where name = 'Gabi Pro';
create or replace function pg_temp.u(c text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f' || c, false) $$;
set role authenticated;
\o /dev/null
select pg_temp.u('1');
\o
insert into public.format_presets (sport, n, name, cfg) values ('beach', 1, 'BT1-Amigos de Segunda', '{"setsToWin":2,"gamesPerSet":4}');
select '1. grátis salvou a 1ª: ' || count(*) from public.format_presets;
do $$ begin insert into public.format_presets (sport, n, name, cfg) values ('beach', 2, 'BT2-Outra', '{}'); raise notice '2. ERRO: grátis salvou a 2ª'; exception when check_violation then raise notice '2. grátis: só 1 por esporte'; end $$;
insert into public.format_presets (sport, n, name, cfg) values ('peteca', 1, 'PET1-Domingo', '{"pointsToWin":21}');
select '3. outro esporte, outra vaga: ' || count(*) from public.format_presets;
do $$ begin insert into public.format_presets (sport, n, name, cfg) values ('padel', 1, 'BT1-Errado', '{}'); raise notice '4. ERRO: prefixo de outro esporte'; exception when check_violation then raise notice '4. prefixo tem que ser do esporte'; end $$;
do $$ begin insert into public.format_presets (sport, n, name, cfg) values ('padel', 1, 'PAD1-Nome muito comprido demais aqui', '{}'); raise notice '5. ERRO: nome longo'; exception when check_violation then raise notice '5. nome com até 18 letras'; end $$;
do $$ begin insert into public.format_presets (user_id, sport, n, name, cfg) values ('00000000-0000-0000-0000-0000000000f2', 'tenis', 1, 'TEN1-Invasor', '{}'); raise notice '6. ERRO: gravou para outro'; exception when insufficient_privilege then raise notice '6. ninguém grava predefinição de outro'; end $$;
\o /dev/null
select pg_temp.u('2');
\o
insert into public.format_presets (sport, n, name, cfg) values ('beach', 1, 'BT1-Um', '{}'), ('beach', 2, 'BT2-Dois', '{}'), ('beach', 3, 'BT3-Tres', '{}');
select '7. Pro salvou 3: ' || count(*) from public.format_presets;
do $$ begin insert into public.format_presets (sport, n, name, cfg) values ('beach', 4, 'BT4-Quatro', '{}'); raise notice '8. ERRO: 4ª predefinição'; exception when check_violation then raise notice '8. no máximo 3 por esporte'; end $$;
select '9. Gabi vê as de Fabi: ' || count(*) from public.format_presets where user_id = '00000000-0000-0000-0000-0000000000f1';
update public.profiles set full_name = 'Gabriela Souza Pro' where id = auth.uid();
select '10. edita o nome completo: ' || full_name from public.profiles where id = auth.uid();
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin perform 1 from public.format_presets; raise notice '11. ERRO: anônimo leu'; exception when insufficient_privilege then raise notice '11. anônimo não lê predefinições'; end $$;
