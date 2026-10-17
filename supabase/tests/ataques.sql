-- Ataques (pentest do banco): fraude no Pro, abuso do grátis, virar admin, ver ou mexer no que é dos outros,
-- duplo clique e corrida entre sessões, entrada absurda, funções security definer e arquivos.
-- Cada linha sai "ok" (o ataque foi barrado ou o comportamento é seguro) ou "ERRO" (o ataque passou).
-- Linhas "aviso:" são limites conhecidos, sem correção no banco (ver o relatório).
-- Rodar numa base nova: supabase-stub.sql, schema.sql, tests/storage-stub.sql, storage.sql, admin.sql e este arquivo
-- (o rodar.sh já faz isso). As corridas usam psql em segundo plano (\!) na mesma base.
\set QUIET on
\pset footer off
\pset tuples_only on
\setenv DB :DBNAME
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'ana@x.com', '{"name":"Ana Atacante"}'), ('00000000-0000-0000-0000-0000000000b1', 'bia@x.com', '{"name":"Bia Vitima"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'caio@x.com', '{"name":"Caio Organiza"}'), ('00000000-0000-0000-0000-0000000000d1', 'davi@x.com', '{"name":"Davi Bloqueado"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'eva@x.com', '{"name":"Eva Privada"}'),
 ('00000000-0000-0000-0000-0000000000f0', 'fabio@x.com', '{"name":"Fabio Amigos"}'), ('00000000-0000-0000-0000-0000000000f8', 'gil@x.com', '{"name":"Gil Amigos"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'm1@x.com', '{"name":"Membro 1"}'), ('00000000-0000-0000-0000-0000000000f2', 'm2@x.com', '{"name":"Membro 2"}'),
 ('00000000-0000-0000-0000-0000000000f3', 'm3@x.com', '{"name":"Membro 3"}'), ('00000000-0000-0000-0000-0000000000f4', 'm4@x.com', '{"name":"Membro 4"}'),
 ('00000000-0000-0000-0000-0000000000f5', 'm5@x.com', '{"name":"Membro 5"}'), ('00000000-0000-0000-0000-0000000000f6', 'm6@x.com', '{"name":"Membro 6"}'),
 ('00000000-0000-0000-0000-0000000000f7', 'm7@x.com', '{"name":"Membro 7"}'),
 ('00000000-0000-0000-0000-0000000000d0', 'dona@x.com', '{"name":"Dona"}'), ('00000000-0000-0000-0000-0000000000d2', 'mod@x.com', '{"name":"Moderador"}'),
 ('00000000-0000-0000-0000-0000000000d3', 'leitor@x.com', '{"name":"Leitor"}'), ('00000000-0000-0000-0000-0000000000d4', 'suspensa@x.com', '{"name":"Suspensa"}');
insert into public.admins (user_id, role, disabled_at) values ('00000000-0000-0000-0000-0000000000d0', 'dono', null), ('00000000-0000-0000-0000-0000000000d2', 'moderador', null),
 ('00000000-0000-0000-0000-0000000000d3', 'leitor', null), ('00000000-0000-0000-0000-0000000000d4', 'dono', now());
update public.profiles set privacy_level = 'privado' where name = 'Eva Privada';
update public.profiles set birth_date = '2012-05-01' where name = 'Bia Vitima';
insert into public.subscriptions (user_id, plan, status, provider, current_period_end) values
 ('00000000-0000-0000-0000-0000000000f0', 'amigos_anual', 'ativa', 'web', now() + interval '1 year'),
 ('00000000-0000-0000-0000-0000000000f8', 'amigos_anual', 'ativa', 'web', now() + interval '1 year'),
 ('00000000-0000-0000-0000-0000000000a1', 'pro_mensal', 'encerrada', 'web', now() - interval '1 day');

-- u: entra como a pessoa (token comum, aal1); adm: admin com a 2ª etapa (aal2) e o código digitado há "min" minutos
create function pg_temp.id(c text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || c)::uuid $$;
create function pg_temp.u(c text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false),
         set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000' || c, 'role', 'authenticated', 'aal', 'aal1')::text, false) $$;
create function pg_temp.adm(c text, aal text default 'aal2', min int default 1) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false),
         set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000' || c, 'role', 'authenticated', 'aal', aal,
           'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', (extract(epoch from now()) - min * 60)::bigint)))::text, false) $$;
create function pg_temp.anon() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{"role":"anon"}', false) $$;
create function pg_temp.ok(cond boolean, label text) returns text language sql as $$ select case when coalesce(cond, false) then 'ok   ' else 'ERRO ' end || label $$;
-- err: tem que dar erro com este trecho na mensagem (as regras adiadas da partida são conferidas na hora)
create function pg_temp.err(q text, want text, label text) returns text language plpgsql as $$
begin execute q; set constraints all immediate; return 'ERRO ' || label || ': passou sem erro';
exception when others then if sqlerrm like '%' || want || '%' then return 'ok   ' || label || ' (' || sqlerrm || ')'; else return 'ERRO ' || label || ': ' || sqlerrm; end if; end $$;
-- none: a escrita não pode mudar nenhuma linha (erro de permissão também serve)
create function pg_temp.none(q text, label text) returns text language plpgsql as $$
declare n bigint;
begin execute q; get diagnostics n = row_count; set constraints all immediate;
  return case when n = 0 then 'ok   ' || label || ' (0 linhas)' else 'ERRO ' || label || ': mudou ' || n || ' linha(s)' end;
exception when others then return 'ok   ' || label || ' (' || sqlerrm || ')'; end $$;
-- works: tem que funcionar
create function pg_temp.works(q text, label text) returns text language plpgsql as $$
begin execute q; set constraints all immediate; return 'ok   ' || label;
exception when others then return 'ERRO ' || label || ': ' || sqlerrm; end $$;
-- mj: a partida em json para save_match (uma hora atrás, beach, vitória do time 0), com os campos de "extra" por cima
create function pg_temp.mj(id text, extra jsonb default '{}') returns text language sql as $$
  select (jsonb_build_object('id', id, 'sport', 'beach', 'played_at', now() - interval '1 hour', 'result', '{"winner":0}'::jsonb) || extra)::text $$;
create function pg_temp.n(q text) returns bigint language plpgsql as $$ declare r bigint; begin execute 'select count(*) from (' || q || ') x' into r; return r; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------- dados: grupos, partidas, seguir e bloqueio ----------
set role authenticated;
\o /dev/null
select pg_temp.u('c1');
\o
insert into public.groups (name, sport, created_by, open) values ('Fechado', 'beach', auth.uid(), false), ('Aberto', 'beach', auth.uid(), true);
select id as gfech, code as gcode from public.groups where name = 'Fechado' \gset
select id as gab from public.groups where name = 'Aberto' \gset
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('c_pub', auth.uid(), 'beach', now() - interval '1 hour', '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('c_pub', 0, 0, auth.uid());
commit;
\o /dev/null
select pg_temp.u('b1');
select public.join_group_by_code(:'gcode');
\o
insert into public.group_members (group_id, user_id) values (:'gab', auth.uid());
insert into public.group_posts (group_id, user_id, text) values (:'gfech', auth.uid(), 'segredo do grupo fechado'), (:'gab', auth.uid(), 'post da Bia');
begin;
insert into public.matches (id, owner_id, sport, played_at, result, visibility, status) values
 ('b_pub', auth.uid(), 'beach', now() - interval '2 hours', '{"winner":0}', 'todos', 'publicada'),
 ('b_so', auth.uid(), 'beach', now() - interval '2 hours', '{"winner":0}', 'so-eu', 'publicada'),
 ('b_rasc', auth.uid(), 'beach', now() - interval '2 hours', '{"winner":0}', 'todos', 'rascunho');
insert into public.match_players (match_id, team, slot, user_id) select id, 0, 0, auth.uid() from public.matches where owner_id = auth.uid();
commit;
insert into public.zaps (match_id, user_id) values ('c_pub', auth.uid());
insert into public.live_matches (match_id, sport) values ('vivo_b', 'beach');
insert into public.blocks (user_id, blocked_id) values (auth.uid(), pg_temp.id('d1'));
insert into public.follows (follower_id, followee_id) values (auth.uid(), pg_temp.id('e1'));
insert into public.reports (reporter_id, target_user_id, reason) values (auth.uid(), pg_temp.id('d1'), 'ofensivo');
\o /dev/null
select pg_temp.u('e1');
\o
update public.follows set status = 'ativo' where followee_id = auth.uid();
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('e_pub', auth.uid(), 'beach', now() - interval '3 hours', '{"winner":1}');
insert into public.match_players (match_id, team, slot, user_id) values ('e_pub', 0, 0, auth.uid());
commit;
\o /dev/null
select pg_temp.u('a1');
\o
insert into public.group_members (group_id, user_id) values (:'gab', auth.uid());
\o /dev/null
select pg_temp.u('c1');
\o
update public.group_members set role = 'mod' where group_id = :'gab' and user_id = pg_temp.id('a1');
insert into public.follows (follower_id, followee_id) values (auth.uid(), pg_temp.id('b1'));

-- ============================================================
-- Pro: ninguém se dá Pro nem abusa do plano Amigos
-- ============================================================
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$update public.profiles set pro_until = now() + interval '10 years' where id = auth.uid()$$, 'permission denied', '1. dar Pro a si mesmo pelo perfil (pro_until)');
select pg_temp.err($$update public.profiles set name = 'Ana', pro_until = now() + interval '1 year', trial_used_at = null where id = auth.uid()$$, 'permission denied', '2. mass assignment: nome junto com pro_until e trial_used_at');
select pg_temp.err($$update public.profiles set public_id = 'UP-ADMIN1' where id = auth.uid()$$, 'permission denied', '3. trocar o código público UP-');
select pg_temp.err($$update public.profiles set guardian_consent_at = now() where id = auth.uid()$$, 'permission denied', '4. marcar sozinho o consentimento do responsável');
select pg_temp.err($$insert into public.subscriptions (user_id, plan, status, provider, current_period_end) values (auth.uid(), 'fundador', 'ativa', 'web', now() + interval '10 years')$$, 'permission denied', '5. criar assinatura para si');
select pg_temp.err($$update public.subscriptions set status = 'ativa', current_period_end = now() + interval '1 year' where user_id = auth.uid()$$, 'permission denied', '6. reativar a própria assinatura encerrada');
select pg_temp.err($$delete from public.subscriptions where user_id = auth.uid()$$, 'permission denied', '7. apagar a própria assinatura (para recomeçar o teste grátis)');
select pg_temp.err($$insert into public.payments (user_id, plan, amount, method, status) values (auth.uid(), 'pro_anual', 0, 'pix', 'pago')$$, 'permission denied', '8. criar recibo de pagamento');
select pg_temp.err($$insert into public.subscriptions (user_id, plan, status, provider, current_period_end) values (auth.uid(), 'pro_mensal', 'trial', 'web', now() + interval '14 days')$$, 'permission denied', '9. começar um 2º teste grátis criando assinatura "trial"');
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ~ '(pro_until|trial_used_at)\s*(=|:=)' and p.proname not in ('admin_grant_pro')),
  '10. nenhuma função do banco grava pro_until ou trial_used_at, fora a cortesia do admin');
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where id = auth.uid()), 365)$$, 'acesso só para administradores', '11. chamar a cortesia do admin sem ser admin');
\o /dev/null
select pg_temp.adm('a1');
\o
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where id = auth.uid()), 365)$$, 'acesso só para administradores', '12. mesmo com aal2 no token, quem não está em admins não dá cortesia');
select pg_temp.err($$insert into public.admins (user_id, role) values (auth.uid(), 'dono')$$, 'permission denied', '13. inserir-se na tabela admins');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.ok(not public.has_pro(auth.uid()), '14. depois de tudo isso, a atacante continua sem Pro');
select pg_temp.ok((select count(*) from public.payments) = 0 and (select status from public.subscriptions where user_id = auth.uid()) = 'encerrada', '15. nenhum recibo nem assinatura mudou');
-- plano Amigos
\o /dev/null
select pg_temp.u('f0');
\o
select pg_temp.err($$insert into public.subscription_members (owner_id, member_id) values (auth.uid(), auth.uid())$$, 'subscription_members_check', '16. dono do Amigos convida a si mesmo');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$insert into public.subscription_members (owner_id, member_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1')$$, 'Pro Amigos ativo', '17. sem Amigos, convidar alguém');
select pg_temp.err($$insert into public.subscription_members (owner_id, member_id) values ('00000000-0000-0000-0000-0000000000f0', auth.uid())$$, 'row-level security', '18. entrar sozinha no plano Amigos de outra pessoa');
\o /dev/null
select pg_temp.u('f0');
\o
insert into public.subscription_members (owner_id, member_id) values (auth.uid(), pg_temp.id('f1')), (auth.uid(), pg_temp.id('f2')), (auth.uid(), pg_temp.id('f3')), (auth.uid(), pg_temp.id('f4'));
-- corrida: duas sessões do dono convidam a 5ª e a 6ª pessoa no mesmo segundo
\! psql -X -q -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f0',true); insert into public.subscription_members (owner_id, member_id) values ('00000000-0000-0000-0000-0000000000f0','00000000-0000-0000-0000-0000000000f5'); select pg_sleep(1.5); commit;" >/dev/null 2>&1 & sleep 0.5; psql -X -q -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f0',true); insert into public.subscription_members (owner_id, member_id) values ('00000000-0000-0000-0000-0000000000f0','00000000-0000-0000-0000-0000000000f6'); commit;" >/dev/null 2>&1; wait
select pg_temp.ok((select count(*) from public.subscription_members where owner_id = auth.uid()) = 5, '19. corrida: dois convites no mesmo segundo não passam de 5 vagas (' || (select count(*) from public.subscription_members where owner_id = auth.uid()) || ')');
select pg_temp.err($$insert into public.subscription_members (owner_id, member_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000f7')$$, 'no máximo 5', '20. 6º convite recusado');
select pg_temp.none($$update public.subscription_members set status = 'ativo' where member_id = '00000000-0000-0000-0000-0000000000f1'$$, '21. o dono aceita o convite no lugar da pessoa');
\o /dev/null
select pg_temp.u('f2');
\o
select pg_temp.none($$update public.subscription_members set status = 'ativo' where member_id = '00000000-0000-0000-0000-0000000000f1'$$, '22. outra convidada aceita o convite no lugar da pessoa');
select pg_temp.err($$update public.subscription_members set owner_id = '00000000-0000-0000-0000-0000000000f8', status = 'ativo' where member_id = auth.uid()$$, 'permission denied', '23. convidada troca o dono do convite (pula para outro plano)');
\o /dev/null
select pg_temp.u('f1');
\o
update public.subscription_members set status = 'ativo' where member_id = auth.uid();
select pg_temp.ok(public.has_pro(auth.uid()), '24. (controle) convidada aceitou e tem Pro');
select pg_temp.err($$update public.subscription_members set status = 'pendente' where member_id = auth.uid()$$, 'só a pessoa convidada aceita', '25. "desaceitar" e aceitar de novo para mexer na data de entrada');
\o /dev/null
select pg_temp.u('f8');
\o
insert into public.subscription_members (owner_id, member_id) values (auth.uid(), pg_temp.id('f1'));
\o /dev/null
select pg_temp.u('f1');
\o
select pg_temp.err($$update public.subscription_members set status = 'ativo' where member_id = auth.uid() and owner_id = '00000000-0000-0000-0000-0000000000f8'$$, 'sub_members_one_plan', '26. estar em dois planos Amigos ao mesmo tempo');
reset role;
update public.subscriptions set status = 'encerrada' where user_id = pg_temp.id('f0');
insert into public.payments (user_id, plan, amount, method, status) values (pg_temp.id('f0'), 'amigos_anual', 549.90, 'cartao', 'estornado');
set role authenticated;
select pg_temp.ok(not public.has_pro(auth.uid()), '27. dono pediu estorno (assinatura encerrada): a convidada perde o Pro na hora');
reset role;
update public.subscriptions set status = 'atrasada' where user_id = pg_temp.id('f0');
set role authenticated;
select pg_temp.ok(not public.has_pro(auth.uid()), '28. pagamento atrasado: convidada sem Pro');
reset role;
update public.subscriptions set status = 'cancelada', current_period_end = now() - interval '1 minute' where user_id = pg_temp.id('f0');
set role authenticated;
select pg_temp.ok(not public.has_pro(auth.uid()), '29. cancelou e o período acabou: convidada sem Pro');
reset role;
update public.subscriptions set status = 'ativa', current_period_end = now() + interval '1 year' where user_id = pg_temp.id('f0');
set role authenticated;
delete from public.subscription_members where member_id = auth.uid() and owner_id = pg_temp.id('f0');
\o /dev/null
select pg_temp.u('f0');
\o
insert into public.subscription_members (owner_id, member_id) values (auth.uid(), pg_temp.id('f1'));
select pg_temp.ok((select status = 'pendente' and joined_at is null from public.subscription_members where member_id = pg_temp.id('f1') and owner_id = auth.uid()), '30. saiu e foi convidada de novo: volta como pendente, sem aproveitar nada da vaga antiga');
select pg_temp.ok(not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name ~ '(referr|indica|reward|recompensa|cupom|coupon)'), '31. não há indicação com recompensa nem cupom no banco para abusar (o ?ref= só conta a origem)');
-- vídeo na nuvem e IA
reset role;
update public.profiles set pro_until = now() + interval '1 hour' where id = pg_temp.id('a1');
set role authenticated;
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('a_vid', auth.uid(), 'beach', now() - interval '1 hour', '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('a_vid', 0, 0, auth.uid());
commit;
select pg_temp.works($$insert into public.video_segments (match_id, owner_id, storage_path, start_at, end_at, bytes, mime) values ('a_vid', auth.uid(), auth.uid() || '/a_vid/1.webm', now() - interval '5 minutes', now(), 1000, 'video/webm')$$, '32. (controle) com Pro, grava trecho de vídeo');
select pg_temp.err($$insert into public.video_segments (match_id, owner_id, storage_path, start_at, end_at, bytes, mime) values ('a_vid', auth.uid(), '00000000-0000-0000-0000-0000000000b1/b_pub/1.webm', now() - interval '5 minutes', now(), 1000, 'video/webm')$$, 'video_segments', '33. registrar trecho apontando para a pasta de vídeos de outra pessoa');
reset role;
update public.profiles set pro_until = now() - interval '1 minute' where id = pg_temp.id('a1');
set role authenticated;
select pg_temp.err($$insert into public.video_segments (match_id, owner_id, storage_path, start_at, end_at, bytes, mime) values ('a_vid', auth.uid(), auth.uid() || '/a_vid/2.webm', now() - interval '5 minutes', now(), 1000, 'video/webm')$$, 'row-level security', '34. Pro venceu: não grava trecho novo');
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('videos', auth.uid() || '/a_vid/2.webm')$$, 'row-level security', '35. Pro venceu: não sobe arquivo de vídeo');
select pg_temp.err($$insert into public.ai_usage (user_id, model) values (auth.uid(), 'x')$$, 'permission denied', '36. forjar linha de uso da IA');
select pg_temp.err($$delete from public.ai_usage where user_id = auth.uid()$$, 'permission denied', '37. apagar o próprio uso da IA para zerar a cota do mês');
select pg_temp.err($$update public.ai_usage set created_at = now() - interval '60 days' where user_id = auth.uid()$$, 'permission denied', '38. jogar o uso da IA para o mês passado');
select pg_temp.err($$insert into public.daily_analyses (sport, last_match_at, items, source) values ('beach', now(), '[]', 'ia')$$, 'row-level security', '39. gravar análise como se fosse da IA');
select pg_temp.works($$insert into public.format_presets (sport, n, name, cfg) values ('beach', 1, 'BT1-Segunda', '{}')$$, '40. (controle) grátis grava 1 predefinição');
select pg_temp.err($$insert into public.format_presets (sport, n, name, cfg) values ('beach', 2, 'BT2-Terça', '{}')$$, 'limite de predefinições', '41. grátis grava a 2ª predefinição do mesmo esporte');
-- corrida: duas predefinições de padel no mesmo segundo (conta grátis)
\! psql -X -q -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true); insert into public.format_presets (user_id, sport, n, name, cfg) values ('00000000-0000-0000-0000-0000000000a1','padel',1,'PAD1-A','{}'); select pg_sleep(1.5); commit;" >/dev/null 2>&1 & sleep 0.5; psql -X -q -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true); insert into public.format_presets (user_id, sport, n, name, cfg) values ('00000000-0000-0000-0000-0000000000a1','padel',2,'PAD2-B','{}'); commit;" >/dev/null 2>&1; wait
select pg_temp.ok((select count(*) from public.format_presets where sport = 'padel') = 1, '42. corrida: duas predefinições no mesmo segundo não furam o limite do grátis (' || (select count(*) from public.format_presets where sport = 'padel') || ')');
select pg_temp.err($$update public.format_presets set n = 3 where user_id = auth.uid()$$, 'permission denied', '43. editar predefinição para driblar o limite');

-- ============================================================
-- admin
-- ============================================================
\o /dev/null
select pg_temp.adm('d0', 'aal1');
\o
select pg_temp.err($$select public.admin_metrics(30)$$, 'acesso só para administradores', '44. dona só com o link do e-mail (aal1): sem painel');
\o /dev/null
select pg_temp.adm('d0', 'aal2', 9 * 60);
\o
select pg_temp.ok(public.admin_metrics(7) is not null, '45. (controle) dona com aal2 lê os números');
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where name = 'Ana Atacante'), 30)$$, 'codigo_recente', '46. código digitado há 9 h: cortesia pede o código de novo');
select pg_temp.err($$select public.admin_handle_report((select id from public.reports limit 1), 'resolvida', true)$$, 'codigo_recente', '47. código velho: tirar do ar também pede o código');
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('d0'), 'aal', 'aal2')::text, false) \g /dev/null
select pg_temp.err($$select public.admin_users('', 10, true)$$, 'codigo_recente', '48. token sem "amr": ver e-mails inteiros recusado');
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('d0'), 'aal', 'aal2', 'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', '9999999999; drop')))::text, false) \g /dev/null
select pg_temp.err($$select public.admin_note_export('contas')$$, 'codigo_recente', '49. "amr" com hora estranha conta como código velho');
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('d0'), 'aal', 'aal2', 'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)))::text, false) \g /dev/null
select pg_temp.err($$select public.admin_note_export('contas')$$, 'codigo_recente', '50. senha recente não vale como código do autenticador');
-- quem não é admin chama cada função do painel
\o /dev/null
select pg_temp.adm('a1');
\o
select pg_temp.ok((select bool_and(r like 'ok%') from (select pg_temp.err(q, 'acesso só para administradores', 'x') r from unnest(array[
  'select public.admin_metrics(30)', 'select public.admin_users()', 'select public.admin_grant_pro(''UP-XXXXXX'', 30)', 'select public.admin_reports()',
  'select public.admin_handle_report(gen_random_uuid(), ''resolvida'')', 'select public.admin_groups()', 'select public.admin_hello()', 'select public.admin_access()',
  'select public.admin_team()', 'select public.admin_note_export(''contas'')', 'select public.admin_link_save(''x1'', ''x'', ''app'', ''a'', ''b'', ''c'')',
  'select public.admin_links()', 'select public.admin_guard()']) q) x), '51. quem não é admin (mesmo com aal2) é recusado em todas as 13 funções do painel');
select pg_temp.ok(public.admin_role() is null and not public.is_admin() and not public.am_i_admin(), '52. is_admin, am_i_admin e admin_role não dizem nada para quem não é admin');
select pg_temp.ok((select count(*) from public.admins) = 0 and (select count(*) from public.admin_log) = 0 and (select count(*) from public.tracked_links) = 0 and (select count(*) from public.app_events) = 0,
  '53. quem não é admin não lê admins, registro, links nem eventos');
reset role;
select pg_temp.ok((select bool_and(not has_function_privilege('anon', p.oid, 'execute')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'admin\_%' or p.proname in ('is_admin', 'am_i_admin'))),
  '54. anon não executa nenhuma função admin_*, is_admin ou am_i_admin');
set role authenticated;
\o /dev/null
select pg_temp.adm('d2');
\o
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where name = 'Ana Atacante'), 30)$$, 'sem_permissao', '55. moderador não dá Pro');
select pg_temp.err($$select public.admin_users('', 10, true)$$, 'sem_permissao', '56. moderador não vê e-mails inteiros');
select pg_temp.err($$select public.admin_team()$$, 'sem_permissao', '57. moderador não vê a equipe');
select pg_temp.err($$select public.admin_note_export('contas')$$, 'sem_permissao', '58. moderador não baixa a planilha de contas');
select pg_temp.ok((public.admin_users('bia') -> 0 ->> 'email') = 'bi***@x.com', '59. moderador vê e-mail mascarado');
select pg_temp.err($$update public.admins set role = 'dono' where user_id = auth.uid()$$, 'permission denied', '60. moderador se promove a dono');
select pg_temp.err($$insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'moderador')$$, 'permission denied', '61. moderador põe outra conta na equipe');
select pg_temp.err($$delete from public.admins where user_id = '00000000-0000-0000-0000-0000000000d0'$$, 'permission denied', '62. moderador tira a dona da equipe');
select pg_temp.err($$insert into public.tracked_links (slug, label, source, medium, campaign) values ('x9', 'x', 'a', 'b', 'c')$$, 'permission denied', '63. criar link direto na tabela (sem a função e sem o registro)');
select pg_temp.err($$select public.admin_link_save('<script>', 'x', 'app', 'insta', 'bio', 'c')$$, 'tracked_links_slug_check', '64. código do link com HTML');
select pg_temp.err($$select public.admin_link_save('ok-1', repeat('x', 5000), 'app', 'insta', 'bio', 'c')$$, 'tracked_links_label_check', '65. nome do link gigante');
select pg_temp.err($$select public.admin_link_save('ok-2', 'Cartaz' || chr(10) || chr(27) || '[31m', 'app', 'insta', 'bio', 'c')$$, 'tracked_links_label_check', '66. nome do link com caractere de controle');
select pg_temp.err($$select public.admin_link_save('ok-3', 'Cartaz', 'javascript:alert(1)', 'insta', 'bio', 'c')$$, 'tracked_links_dest_check', '67. destino do link fora da lista (javascript:)');
select pg_temp.err($$select public.admin_link_save('ok-4', 'Cartaz', 'app', 'insta gram', 'bio', 'c')$$, 'tracked_links_source_check', '68. origem com espaço ou símbolo');
select pg_temp.ok(public.admin_link_save('ok-5', '<img src=x onerror=alert(1)>', 'app', ' INSTA ', 'Bio', 'C') ->> 'source' = 'insta', '69. nome com HTML fica como texto (o painel mostra com textContent) e origem é limpa');
select pg_temp.err($$insert into public.admin_log (admin_id, action) values (auth.uid(), 'login')$$, 'permission denied', '70. admin escreve no registro por fora das funções');
select pg_temp.none($$update public.admin_log set detail = '{}'$$, '71. admin altera o registro');
select pg_temp.none($$delete from public.admin_log$$, '72. admin apaga o registro');
reset role;
select pg_temp.err($$delete from public.admin_log$$, 'não pode ser alterado', '73. nem o dono do banco apaga o registro');
select pg_temp.err($$update public.admin_log set action = 'nada'$$, 'não pode ser alterado', '74. nem altera');
set role authenticated;
\o /dev/null
select pg_temp.adm('d3');
\o
select pg_temp.err($$select public.admin_handle_report((select id from public.reports limit 1), 'descartada')$$, 'sem_permissao', '75. leitor não mexe em denúncia');
select pg_temp.err($$select public.admin_link_save('ok-6', 'x', 'app', 'a', 'b', 'c')$$, 'sem_permissao', '76. leitor não cria link');
select pg_temp.err($$select public.admin_users()$$, 'sem_permissao', '77. leitor não lista contas');
\o /dev/null
select pg_temp.adm('d4');
\o
select pg_temp.err($$select public.admin_metrics(30)$$, 'acesso só para administradores', '78. dona suspensa perde o acesso na hora');
\o /dev/null
select pg_temp.adm('d0');
\o
select pg_temp.ok((public.admin_metrics(100000) ->> 'days')::int = 730, '79. período absurdo no painel fica limitado a 2 anos');

-- ============================================================
-- telemetria (app_events)
-- ============================================================
reset role;
set role anon;
\o /dev/null
select pg_temp.anon();
\o
select pg_temp.works($$insert into public.app_events (device_id, session, name) values ('visita00001', true, 'visit')$$, '80. (controle) visita anônima sem consentimento entra');
select pg_temp.err($$insert into public.app_events (device_id, session, name) values ('visita00001', true, 'match_end')$$, 'row-level security', '81. sem consentimento, evento que não é visita');
select pg_temp.err($$insert into public.app_events (device_id, name, user_id) values ('aparelho0001', 'signup', '00000000-0000-0000-0000-0000000000b1')$$, 'row-level security', '82. anônimo manda evento em nome de uma conta');
select pg_temp.err($$insert into public.app_events (device_id, name, created_at) values ('aparelho0001', 'app_open', now() - interval '30 days')$$, 'row-level security', '83. evento com data de 30 dias atrás (inflar o passado)');
select pg_temp.err($$insert into public.app_events (device_id, name, created_at) values ('aparelho0001', 'app_open', now() + interval '1 day')$$, 'row-level security', '84. evento com data no futuro');
select pg_temp.err($$insert into public.app_events (device_id, name, props) values ('aparelho0001', 'share', jsonb_build_object('x', repeat('a', 5000)))$$, 'app_events_props_check', '85. evento gigante');
select pg_temp.err($$insert into public.app_events (device_id, name) values ('aparelho0001', '<script>')$$, 'app_events_name_check', '86. nome de evento com HTML');
select pg_temp.err($$insert into public.app_events (device_id, name) values ('../../etc', 'visit')$$, 'app_events_device_id_check', '87. id de aparelho fora do formato');
select pg_temp.err($$insert into public.app_events (device_id, name, props) values ('aparelho0001', 'feedback', '{"contato":"bia.vitima@gmail.com"}')$$, 'app_events_props_check', '88. e-mail dentro do evento');
select pg_temp.err($$insert into public.app_events (device_id, name, path) values ('aparelho0001', 'visit', '/convite?email=bia@x.com')$$, 'app_events_path_check', '89. e-mail no caminho da página');
select pg_temp.err($$select * from public.app_events$$, 'permission denied', '90. anônimo não lê eventos');
select pg_temp.none($$update public.app_events set name = 'signup'$$, '91. anônimo altera eventos');
select pg_temp.none($$delete from public.app_events$$, '92. anônimo apaga eventos');
select pg_temp.err($$select public.admin_metrics(30)$$, 'permission denied', '93. anônimo chama o painel');
do $$ begin for i in 1..300 loop insert into public.app_events (device_id, name) values ('flood0000001', 'app_open'); end loop; end $$;
reset role;
select 'aviso: 300 eventos seguidos do mesmo aparelho entraram (' || count(*) || '): não há limite de taxa no banco; anônimo com consentimento falso manda qualquer evento' from public.app_events where device_id = 'flood0000001';
set role authenticated;
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$insert into public.app_events (device_id, name, user_id) values ('aparelho0002', 'signup', '00000000-0000-0000-0000-0000000000b1')$$, 'row-level security', '94. conta logada manda evento em nome de outra');

-- ============================================================
-- dados dos outros (ler, mudar, apagar, agir em nome)
-- ============================================================
select pg_temp.ok(pg_temp.n($$select 1 from public.matches where id in ('b_so', 'b_rasc')$$) = 0, '95. não vê partida "só eu" nem rascunho de outra pessoa');
select pg_temp.ok(pg_temp.n($$select 1 from public.matches where id = 'e_pub'$$) = 0, '96. não vê partida de perfil privado sem seguir');
select pg_temp.ok(pg_temp.n($$select 1 from public.match_events where match_id in ('b_so', 'e_pub')$$) = 0 and pg_temp.n($$select 1 from public.match_players where match_id in ('b_so', 'e_pub')$$) = 0, '97. nem os lances e jogadores delas');
select pg_temp.ok(pg_temp.n($$select 1 from public.notifications where user_id <> auth.uid()$$) = 0, '98. não lê notificação de ninguém');
select pg_temp.ok(pg_temp.n($$select 1 from public.groups where id = '$$ || :'gfech' || $$'$$) = 0 and pg_temp.n($$select 1 from public.group_posts where group_id = '$$ || :'gfech' || $$'$$) = 0
  and pg_temp.n($$select 1 from public.group_members where group_id = '$$ || :'gfech' || $$'$$) = 0, '99. de fora, não vê grupo fechado, resenha nem membros');
select pg_temp.ok(pg_temp.n('select 1 from public.group_ranking(''' || :'gfech' || ''')') = 0, '100. nem o ranking do grupo fechado');
select pg_temp.ok(pg_temp.n($$select 1 from public.follows where follower_id = '00000000-0000-0000-0000-0000000000b1'$$) = 0 and pg_temp.n($$select 1 from public.blocks where user_id = '00000000-0000-0000-0000-0000000000b1'$$) = 0,
  '101. não lê quem a Bia segue nem quem ela bloqueou');
select pg_temp.ok(public.follows_active(pg_temp.id('b1'), pg_temp.id('e1')) = public.follows_active(pg_temp.id('b1'), pg_temp.id('c1')), '102. follows_active não revela que a Bia segue a Eva (perfil privado)');
select pg_temp.ok(public.is_blocked_between(pg_temp.id('b1'), pg_temp.id('d1')) = public.is_blocked_between(pg_temp.id('b1'), pg_temp.id('c1')), '103. is_blocked_between não revela quem a Bia bloqueou');
select pg_temp.ok(public.group_role(:'gfech', pg_temp.id('b1')) is null and not public.is_group_member(:'gfech', pg_temp.id('b1')), '104. group_role não revela quem é do grupo fechado');
select pg_temp.ok(not public.can_see_match('e_pub', pg_temp.id('b1')), '105. can_see_match não deixa perguntar "a Bia vê esta partida?"');
select pg_temp.ok(pg_temp.n($$select 1 from public.subscriptions where user_id <> auth.uid()$$) = 0 and pg_temp.n($$select 1 from public.payments where user_id <> auth.uid()$$) = 0
  and pg_temp.n($$select 1 from public.subscription_members$$) = 0 and pg_temp.n($$select 1 from public.ai_usage where user_id <> auth.uid()$$) = 0, '106. não lê assinatura, recibo, plano Amigos nem uso da IA dos outros');
select pg_temp.ok(pg_temp.n($$select 1 from public.video_segments where owner_id <> auth.uid()$$) = 0 and pg_temp.n($$select 1 from public.reports where reporter_id <> auth.uid()$$) = 0
  and pg_temp.n($$select 1 from public.daily_analyses where user_id <> auth.uid()$$) = 0 and pg_temp.n($$select 1 from public.format_presets where user_id <> auth.uid()$$) = 0, '107. nem vídeos, denúncias, análises e predefinições dos outros');
select pg_temp.err($$select email from auth.users$$, 'permission denied', '108. e-mails de auth.users');
select pg_temp.err($$select birth_date from public.profiles where name = 'Bia Vitima'$$, 'permission denied', '109. data de nascimento de outra pessoa (menor de idade)');
reset role;
set role anon;
select pg_temp.err($$select birth_date, guardian_consent_at from public.profiles$$, 'permission denied', '110. anônimo lê data de nascimento e consentimento do responsável');
select pg_temp.ok(pg_temp.n('select name, avatar_url from public.profiles') > 0, '111. (controle) anônimo ainda vê nome e foto públicos');
reset role;
set role authenticated;
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok((select birth_date = '2012-05-01' from public.my_private_profile()), '112. a própria pessoa lê a data de nascimento dela (my_private_profile)');
select pg_temp.err($$select * from public.report_hotlist$$, 'permission denied', '113. lista de denunciados da equipe');
\o /dev/null
select pg_temp.u('d1');
\o
select pg_temp.ok(pg_temp.n($$select 1 from public.profiles where name = 'Bia Vitima'$$) = 0 and pg_temp.n($$select 1 from public.matches where owner_id = '00000000-0000-0000-0000-0000000000b1'$$) = 0,
  '114. bloqueado não vê perfil nem partidas de quem bloqueou');
select pg_temp.ok(pg_temp.n('select 1 from public.head_to_head(''00000000-0000-0000-0000-0000000000b1'')') = 0 and pg_temp.n('select 1 from public.live_for_viewer(''00000000-0000-0000-0000-0000000000b1'')') = 0, '115. nem confronto nem "jogando agora"');
select pg_temp.err($$insert into public.follows (follower_id, followee_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1')$$, 'bloqueado', '116. bloqueado volta a seguir');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.none($$update public.matches set result = '{"winner":1}', caption = 'perdi' where id = 'b_pub'$$, '117. mudar a partida de outra pessoa');
select pg_temp.none($$delete from public.matches where id = 'b_pub'$$, '118. apagar a partida de outra pessoa');
select pg_temp.none($$delete from public.match_players where match_id = 'b_pub'$$, '119. tirar jogador da partida de outra pessoa');
select pg_temp.err($$insert into public.match_players (match_id, team, slot, user_id) values ('b_pub', 1, 0, auth.uid())$$, 'row-level security', '120. entrar sozinha na partida de outra pessoa');
select pg_temp.err($$insert into public.match_events (match_id, seq, event) values ('b_pub', 1, '{}')$$, 'row-level security', '121. lance na partida de outra pessoa');
select pg_temp.none($$delete from public.zaps where user_id = '00000000-0000-0000-0000-0000000000b1'$$, '122. tirar o zap de outra pessoa');
select pg_temp.err($$insert into public.zaps (match_id, user_id) values ('c_pub', '00000000-0000-0000-0000-0000000000d1')$$, 'row-level security', '123. zap em nome de outra pessoa');
select pg_temp.err($$insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-0000000000b1', auth.uid())$$, 'row-level security', '124. fazer a Bia "seguir" a atacante');
select pg_temp.err($$insert into public.notifications (user_id, kind, actor_id) values ('00000000-0000-0000-0000-0000000000b1', 'follow', auth.uid())$$, 'permission denied', '125. criar notificação falsa');
select pg_temp.none($$update public.notifications set read_at = now() where user_id = '00000000-0000-0000-0000-0000000000b1'$$, '126. marcar como lidas as notificações da Bia');
select pg_temp.err($$update public.notifications set kind = 'accepted' where user_id = auth.uid()$$, 'permission denied', '127. trocar o tipo da própria notificação');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, reason) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'falso')$$, 'row-level security', '128. denúncia em nome de outra pessoa');
select pg_temp.err($$update public.reports set status = 'descartada'$$, 'permission denied', '129. mexer na situação de denúncia');
select pg_temp.none($$update public.group_posts set text = 'editado' where user_id = '00000000-0000-0000-0000-0000000000b1' and group_id = '$$ || :'gfech' || $$'$$, '130. de fora, editar post do grupo fechado');
select pg_temp.none($$update public.group_posts set text = 'Bia disse besteira', user_id = auth.uid() where user_id = '00000000-0000-0000-0000-0000000000b1' and group_id = '$$ || :'gab' || $$'$$, '131. moderadora reescreve o post da Bia');
select pg_temp.ok((select text from public.group_posts where user_id = pg_temp.id('b1') and group_id = :'gab') = 'post da Bia', '132. o post da Bia continua como ela escreveu');
select pg_temp.works($$select public.remove_group_post((select id from public.group_posts where user_id = '00000000-0000-0000-0000-0000000000b1' and group_id = '$$ || :'gab' || $$'))$$, '133. (controle) moderadora ainda tira o post do ar (remove_group_post)');
select pg_temp.err($$select public.remove_group_post((select id from public.group_posts where text = 'segredo do grupo fechado'))$$, 'post não encontrado', '133a. de fora, apagar post do grupo fechado');
select pg_temp.none($$update public.group_members set role = 'admin' where user_id = auth.uid() and group_id = '$$ || :'gab' || $$'$$, '134. moderadora se promove a organizadora');
select pg_temp.err($$insert into public.group_members (group_id, user_id, status) values ('$$ || :'gfech' || $$', '00000000-0000-0000-0000-0000000000d1', 'ativo')$$, 'row-level security', '135. pôr outra pessoa num grupo que não organiza');
select pg_temp.works($$insert into public.group_members (group_id, user_id, role, status) values ('$$ || :'gfech' || $$', auth.uid(), 'admin', 'ativo')$$, '136a. (pedido de entrada no fechado)');
select pg_temp.ok((select role = 'membro' and status = 'pendente' from public.group_members where group_id = :'gfech' and user_id = auth.uid()), '136. pedir para entrar no fechado como organizadora ativa: entra pendente e membro');
select pg_temp.ok(pg_temp.n($$select 1 from public.group_posts where group_id = '$$ || :'gfech' || $$'$$) = 0, '137. pendente não lê a resenha do grupo fechado');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.err($$update public.follows set follower_id = '00000000-0000-0000-0000-0000000000f1' where followee_id = auth.uid()$$, 'permission denied', '138. quem é seguido forja um seguidor (troca follower_id)');
-- grupo e post tirados do ar pela equipe não voltam (update sem where também)
\o /dev/null
select pg_temp.u('c1');
\o
insert into public.groups (name, sport, created_by) values ('Tirado do ar', 'beach', auth.uid());
insert into public.group_posts (group_id, user_id, text) select id, auth.uid(), 'post ofensivo' from public.groups where name = 'Tirado do ar';
reset role;
update public.groups set deleted_at = now() where name = 'Tirado do ar';
update public.group_posts set deleted_at = now() where text = 'post ofensivo';
set role authenticated;
select pg_temp.none($$update public.groups set deleted_at = null$$, '139a. organizador manda devolver tudo ao ar (update sem where)');
select pg_temp.none($$update public.group_posts set deleted_at = null$$, '139b. e os posts');
reset role;
select pg_temp.ok((select deleted_at is not null from public.groups where name = 'Tirado do ar'), '139. grupo tirado do ar pela equipe não volta com update sem where');
select pg_temp.ok((select deleted_at is not null from public.group_posts where text = 'post ofensivo') and (select deleted_at is not null from public.group_posts where text = 'post da Bia'),
  '140. nem os posts tirados do ar (pela equipe e pela moderadora)');
set role authenticated;
select pg_temp.none($$update public.group_posts set deleted_at = null where text = 'post ofensivo'$$, '141. o mesmo com where');
-- partida levada para um grupo de que a pessoa não é
\o /dev/null
select pg_temp.u('a1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('a_mov', auth.uid(), 'beach', now() - interval '1 hour', '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('a_mov', 0, 0, auth.uid());
commit;
select pg_temp.err($$update public.matches set group_id = '$$ || :'gfech' || $$' where id = 'a_mov'$$, 'grupo', '142. levar a própria partida para dentro de um grupo fechado alheio');
select pg_temp.err($$insert into public.match_claims (match_id, user_id, guest_name) values ('b_so', auth.uid(), 'Zeca')$$, 'row-level security', '143. pedir para ser o convidado de uma partida que não vê');
select pg_temp.err($$insert into public.match_claims (match_id, user_id, guest_name) values ('b_pub', auth.uid(), repeat('Z', 100000))$$, 'match_claims_guest_name_check', '144. pedido de convidado com nome gigante');
select pg_temp.works($$insert into public.match_claims (match_id, user_id, guest_name) values ('b_pub', auth.uid(), 'Zeca')$$, '145. (controle) pede para ser o convidado de uma partida que vê');
select pg_temp.err($$insert into public.match_claims (match_id, user_id, guest_name) values ('b_pub', auth.uid(), 'Zeca')$$, 'match_claims_one_pending', '146. duplo clique no pedido de convidado');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.err($$update public.match_claims set user_id = '00000000-0000-0000-0000-0000000000c1' where match_id = 'b_pub'$$, 'permission denied', '147. dono troca quem pediu o convidado');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$insert into public.live_players (match_id, user_id, team, slot) select 'vivo_b', auth.uid(), 1, 0$$, 'row-level security', '148. entrar sozinha no placar ao vivo de outra pessoa');

-- ============================================================
-- partida: quem lança joga (fora da partida do grupo)
-- ============================================================
select pg_temp.err($$insert into public.matches (id, owner_id, sport, played_at, result) values ('t_terc', auth.uid(), 'beach', now(), '{"winner":0}')$$, 'dono_precisa_jogar', '149. lançar partida sem estar nela (fora de grupo)');
select pg_temp.err($$insert into public.matches (id, owner_id, sport, played_at, result) values ('t_terc2', auth.uid(), 'beach', now(), '{"winner":0}');
  insert into public.match_players (match_id, team, slot, guest_name) select 't_terc2', s / 2, s % 2, 'Convidado ' || s from generate_series(0, 3) s$$, 'dono_precisa_jogar', '150. lançar partida de terceiros (só convidados, sem a dona)');
select pg_temp.err($$select public.save_match(pg_temp.mj('t_terc3')::jsonb, '[{"team":0,"slot":0,"guest_name":"A"},{"team":1,"slot":0,"guest_name":"B"}]')$$, 'dono_precisa_jogar', '151. save_match de terceiros também é recusado');
select pg_temp.works($$select public.save_match(pg_temp.mj('t_ok', '{"result":{"sets":[[6,4]],"winner":0}}')::jsonb, '[{"team":0,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000a1"},{"team":1,"slot":0,"guest_name":"Rival"}]')$$, '152. (controle) save_match com a dona jogando grava partida e jogadores juntos');
select pg_temp.ok(pg_temp.n($$select 1 from public.match_players where match_id = 't_ok'$$) = 2 and (select visibility = 'todos' and source = 'live' and code like 'P-%' from public.matches where id = 't_ok'), '153. save_match usa os padrões (visibilidade, origem, código)');
select pg_temp.ok(public.save_match(pg_temp.mj('t_ok')::jsonb, '[{"team":0,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000a1"}]') = 't_ok'
  and pg_temp.n($$select 1 from public.match_players where match_id = 't_ok'$$) = 2, '154. fila offline manda de novo (duplo envio): save_match não duplica nada');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.err($$select public.save_match(pg_temp.mj('t_ok')::jsonb, '[{"team":0,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000b1"}]')$$, 'partida_ja_existe', '155. save_match com o id da partida de outra pessoa');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$delete from public.match_players where match_id = 't_ok' and user_id = auth.uid()$$, 'dono_precisa_jogar', '156. dona tira a própria linha da partida (sem "Excluir para mim")');
select pg_temp.err($$update public.match_players set user_id = null, guest_name = 'X' where match_id = 't_ok' and user_id = auth.uid()$$, 'permission denied', '157. dona troca a própria linha por convidado');
select pg_temp.ok(public.leave_match('t_ok') = 'apagada' or exists (select 1 from public.matches where id = 't_ok'), '158. (controle) "Excluir para mim" continua funcionando para a dona');
\o /dev/null
select pg_temp.u('c1');
\o
select pg_temp.works($$select public.save_match(pg_temp.mj('t_grp', '{"group_id":"$$ || :'gab' || $$","result":{"winner":1}}')::jsonb, '[{"team":0,"slot":0,"guest_name":"A"},{"team":1,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000b1"}]')$$, '159. partida do grupo lançada pelo organizador que não joga');
select pg_temp.err($$update public.matches set group_id = null where id = 't_grp'$$, 'dono_precisa_jogar', '160. tirar do grupo a partida em que o dono não joga');
insert into public.groups (name, sport, created_by) values ('Vai sumir', 'beach', auth.uid());
select pg_temp.works($$select public.save_match(pg_temp.mj('t_grp2', jsonb_build_object('group_id', (select id from public.groups where name = 'Vai sumir')))::jsonb, '[{"team":0,"slot":0,"guest_name":"A"}]')$$, '160a. (outra partida de grupo sem o dono jogando)');
reset role;
select pg_temp.works($$delete from public.groups where name = 'Vai sumir'$$, '160b. grupo apagado de vez (ou a conta de quem criou): a partida do grupo não trava a exclusão');
set role authenticated;
\o /dev/null
select pg_temp.u('f3');
\o
select pg_temp.works($$select public.save_match(pg_temp.mj('t_f3')::jsonb, '[{"team":0,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000f3"},{"team":1,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000f4"}]')$$, '161a. (Membro 3 lança com o Membro 4)');
\o /dev/null
select pg_temp.u('f4');
\o
update public.match_players set tag_status = 'aceito' where match_id = 't_f3' and user_id = auth.uid();
\o /dev/null
select pg_temp.u('f3');
\o
select pg_temp.ok(public.leave_match('t_f3') = 'saiu', '161b. (o dono usa "Excluir para mim" e a partida fica para o Membro 4)');
reset role;
select pg_temp.works($$delete from public.match_players where match_id = 't_f3' and user_id = '00000000-0000-0000-0000-0000000000f3'$$, '161. dono que já saiu (owner_left_at) sem linha na partida não esbarra na regra');
select pg_temp.works($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000f3'$$, '162. apagar a conta de quem lançou a partida (dono vira nulo) não esbarra na regra');
select pg_temp.works($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000f4'$$, '162a. nem apagar a conta do último jogador');
set role authenticated;

-- ============================================================
-- duplo clique e corrida
-- ============================================================
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$insert into public.matches (id, owner_id, sport, played_at) values ('a_mov', auth.uid(), 'beach', now())$$, 'matches_pkey', '163. mesma partida lançada duas vezes');
select pg_temp.works($$insert into public.zaps (match_id, user_id) values ('c_pub', auth.uid())$$, '164. (controle) zap');
select pg_temp.err($$insert into public.zaps (match_id, user_id) values ('c_pub', auth.uid())$$, 'zaps_pkey', '165. zap duas vezes');
do $$ begin for i in 1..20 loop delete from public.zaps where match_id = 'c_pub' and user_id = auth.uid(); insert into public.zaps (match_id, user_id) values ('c_pub', auth.uid()); end loop; end $$;
reset role;
select pg_temp.ok((select count(*) from public.notifications where user_id = pg_temp.id('c1') and kind = 'zap' and actor_id = pg_temp.id('a1')) = 1, '166. tirar e dar zap 20 vezes não manda 20 avisos (' || (select count(*) from public.notifications where user_id = pg_temp.id('c1') and kind = 'zap' and actor_id = pg_temp.id('a1')) || ')');
set role authenticated;
do $$ begin for i in 1..20 loop delete from public.follows where follower_id = auth.uid() and followee_id = '00000000-0000-0000-0000-0000000000c1'; insert into public.follows (follower_id, followee_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c1'); end loop; end $$;
reset role;
select pg_temp.ok((select count(*) from public.notifications where user_id = pg_temp.id('c1') and kind in ('follow', 'follow_request') and actor_id = pg_temp.id('a1')) = 1, '167. seguir e deixar de seguir 20 vezes não manda 20 avisos (' || (select count(*) from public.notifications where user_id = pg_temp.id('c1') and kind in ('follow', 'follow_request') and actor_id = pg_temp.id('a1')) || ')');
set role authenticated;
select set_config('t.gfech', :'gfech', false) \g /dev/null
do $$ begin for i in 1..20 loop delete from public.group_members where group_id = current_setting('t.gfech')::uuid and user_id = auth.uid(); insert into public.group_members (group_id, user_id) values (current_setting('t.gfech')::uuid, auth.uid()); end loop; end $$;
reset role;
select pg_temp.ok((select count(*) from public.notifications where user_id = pg_temp.id('c1') and kind = 'group_request' and actor_id = pg_temp.id('a1')) = 1, '168. pedir para entrar no grupo 20 vezes não manda 20 avisos (' || (select count(*) from public.notifications where user_id = pg_temp.id('c1') and kind = 'group_request' and actor_id = pg_temp.id('a1')) || ')');
set role authenticated;
select pg_temp.err($$insert into public.group_members (group_id, user_id) values ('$$ || :'gab' || $$', auth.uid())$$, 'group_members_pkey', '169. entrar duas vezes no mesmo grupo');
select pg_temp.ok(public.join_group_by_code(:'gcode') = public.join_group_by_code(lower(:'gcode')) and pg_temp.n($$select 1 from public.group_members where user_id = auth.uid() and group_id = '$$ || :'gfech' || $$'$$) = 1, '170. link de convite usado duas vezes: uma linha só');
\o /dev/null
select pg_temp.u('b1');
\o
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('b_tag', auth.uid(), 'beach', now() - interval '1 hour', '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('b_tag', 0, 0, auth.uid()), ('b_tag', 1, 0, pg_temp.id('c1'));
commit;
\o /dev/null
select pg_temp.u('c1');
\o
update public.match_players set tag_status = 'aceito' where match_id = 'b_tag' and user_id = auth.uid();
select responded_at as r1 from public.match_players where match_id = 'b_tag' and user_id = auth.uid() \gset
select pg_temp.works($$update public.match_players set tag_status = 'aceito', responded_at = '2020-01-01' where match_id = 'b_tag' and user_id = auth.uid()$$, '171a. aceitar de novo (duplo clique), mandando outra hora');
select pg_temp.ok((select responded_at = :'r1'::timestamptz from public.match_players where match_id = 'b_tag' and user_id = auth.uid()), '171. aceitar duas vezes não muda nada (nem a hora da resposta)');
select pg_temp.ok(public.request_match_deletion('b_tag', 'duplicada') = 'aberto', '172. (controle) pede exclusão');
select pg_temp.err($$select public.request_match_deletion('b_tag', 'de novo')$$, 'pedido_em_andamento', '173. pedir exclusão duas vezes');
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$select public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'b_tag'), true)$$, 'sem voto pendente', '174. votar num pedido de que não faz parte');
\o /dev/null
select pg_temp.u('b1');
\o
select pg_temp.ok(public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'b_tag'), false) = 'recusado', '175. (controle) a dona recusa');
select pg_temp.err($$select public.vote_match_deletion((select id from public.match_delete_requests where match_id = 'b_tag'), true)$$, 'sem voto pendente', '176. votar duas vezes');
-- corrida: dois cliques no zap ao mesmo tempo (duas abas)
reset role;
\! psql -X -q -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',true); insert into public.zaps (match_id, user_id) values ('b_pub','00000000-0000-0000-0000-0000000000e1'); select pg_sleep(1); commit;" >/dev/null 2>&1 & sleep 0.3; psql -X -q -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',true); insert into public.zaps (match_id, user_id) values ('b_pub','00000000-0000-0000-0000-0000000000e1'); commit;" >/dev/null 2>&1; wait
select pg_temp.ok((select count(*) from public.zaps where match_id = 'b_pub' and user_id = pg_temp.id('e1')) = 1 and (select count(*) from public.notifications where kind = 'zap' and actor_id = pg_temp.id('e1')) = 1, '177. corrida: dois zaps no mesmo segundo viram um zap e um aviso');
set role authenticated;

-- ============================================================
-- entrada absurda
-- ============================================================
\o /dev/null
select pg_temp.u('a1');
\o
create function pg_temp.sm(id text, extra text) returns text language sql as $$
  select format($q$select public.save_match(pg_temp.mj(%L, %s)::jsonb, '[{"team":0,"slot":0,"user_id":"00000000-0000-0000-0000-0000000000a1"}]')$q$, id, extra) $$;
grant execute on function pg_temp.sm(text, text) to authenticated;
select pg_temp.err(pg_temp.sm('x1', $$'{"result":{"sets":[[-6,4]],"winner":0}}'$$), 'matches_result_check', '178. placar negativo');
select pg_temp.err(pg_temp.sm('x2', $$'{"result":{"sets":[[600000,4]],"winner":0}}'$$), 'matches_result_check', '179. placar gigante');
select pg_temp.err(pg_temp.sm('x3', $$'{"result":{"winner":"x"}}'$$), 'matches_result_check', '180. vencedor inválido (quebraria o ranking do grupo)');
select pg_temp.err(pg_temp.sm('x4', $$'{"result":{"final":["a",1],"winner":1}}'$$), 'matches_result_check', '181. placar final com texto');
select pg_temp.err(pg_temp.sm('x5', $$'{"duration_ms":-5}'$$), 'matches_duration_ms_check', '182. duração negativa');
select pg_temp.err(pg_temp.sm('x6', $$'{"duration_ms":999999999}'$$), 'matches_duration_ms_check', '183. duração de 11 dias');
select pg_temp.err(pg_temp.sm('x7', $$'{"played_at":"2099-01-01T10:00:00Z"}'$$), 'data_da_partida', '184. partida em 2099 (ficaria no topo da timeline para sempre)');
select pg_temp.err(pg_temp.sm('x8', $$'{"played_at":"1900-01-01T10:00:00Z"}'$$), 'data_da_partida', '185. partida em 1900');
select pg_temp.err($$update public.matches set played_at = now() + interval '30 days' where id = 'a_mov'$$, 'data_da_partida', '186. jogar a data da partida para o futuro depois');
select pg_temp.err(pg_temp.sm('x9', $$jsonb_build_object('city', repeat('c', 100000))$$), 'matches_city_check', '187. cidade da partida gigante');
select pg_temp.err(pg_temp.sm('x10', $$jsonb_build_object('sport', repeat('s', 100000))$$), 'matches_sport_check', '188. esporte gigante');
select pg_temp.err(pg_temp.sm('x11', $$jsonb_build_object('cfg', jsonb_build_object('x', (select string_agg(md5(i::text), '') from generate_series(1, 1000) i)))$$), 'matches_cfg_check', '189. configuração gigante');
select pg_temp.err(pg_temp.sm('x12', $$jsonb_build_object('summary', jsonb_build_object('x', (select string_agg(md5(i::text), '') from generate_series(1, 100000) i)))$$), 'matches_summary_check', '190. resumo de 3 MB');
select pg_temp.err(pg_temp.sm('x13', $$jsonb_build_object('replay', jsonb_build_object('x', (select string_agg(md5(i::text), '') from generate_series(1, 100000) i)))$$), 'matches_replay_check', '191. replay de 3 MB');
select pg_temp.err($$insert into public.match_events (match_id, seq, event) values ('a_mov', 1, jsonb_build_object('x', (select string_agg(md5(i::text), '') from generate_series(1, 1000) i)))$$, 'match_events_event_check', '192. lance gigante');
select pg_temp.err($$insert into public.matches (id, owner_id, sport, played_at, corrected_at) values ('x14', auth.uid(), 'beach', now(), now())$$, 'permission denied', '193. lançar partida já com o selo "placar corrigido"');
select pg_temp.err($$insert into public.matches (id, owner_id, sport, played_at, code) values ('x15', auth.uid(), 'beach', now(), 'P-ADMIN')$$, 'permission denied', '194. escolher o código P- da partida');
select pg_temp.err($$insert into public.matches (id, owner_id, sport, played_at, created_at) values ('x16', auth.uid(), 'beach', now(), now() - interval '1 year')$$, 'permission denied', '195. data de criação forjada (bagunça os números do painel)');
select pg_temp.err($$insert into public.group_posts (group_id, user_id, text, created_at) values ('$$ || :'gab' || $$', auth.uid(), 'fixado no topo', '2099-01-01')$$, 'permission denied', '196. post com data no futuro (fixado no topo do mural)');
select pg_temp.err($$insert into public.groups (name, sport, created_by, code) values ('Copia', 'beach', auth.uid(), 'G-ABCDEF')$$, 'permission denied', '197. escolher o código de convite do grupo');
select pg_temp.err($$insert into public.groups (name, sport, created_by) values ('Grupo', repeat('s', 100000), auth.uid())$$, 'groups_sport_check', '198. esporte do grupo gigante');
select pg_temp.err($$insert into public.groups (name, sport, created_by, description) values ('Grupo', 'beach', auth.uid(), repeat('d', 161))$$, 'groups_description_check', '199. descrição do grupo com 161 letras');
select pg_temp.err($$insert into public.groups (name, sport, created_by, color) values ('Grupo', 'beach', auth.uid(), 'red;background:url(x)')$$, 'groups_color_check', '200. cor do grupo com CSS');
select pg_temp.err($$insert into public.group_posts (group_id, user_id, text) values ('$$ || :'gab' || $$', auth.uid(), repeat('p', 281))$$, 'group_posts_text_check', '201. post com 281 letras');
select pg_temp.err($$update public.profiles set bio = repeat('b', 161) where id = auth.uid()$$, 'profiles_bio_check', '202. bio com 161 letras');
select pg_temp.err($$update public.profiles set name = repeat('n', 61) where id = auth.uid()$$, 'profiles_name_check', '203. nome com 61 letras');
select pg_temp.err($$update public.profiles set name = 'Bia' || chr(8238) || 'aitiV' where id = auth.uid()$$, 'profiles_name_check', '204. nome com caractere invisível de inversão (U+202E)');
select pg_temp.err($$update public.profiles set name = 'Ana' || chr(10) || 'Admin' where id = auth.uid()$$, 'profiles_name_check', '205. nome com quebra de linha');
select pg_temp.err($$update public.profiles set name = '   ' where id = auth.uid()$$, 'profiles_name_check', '206. nome só com espaços');
select pg_temp.works($$update public.profiles set name = 'Ana <b>Ultra</b>' where id = auth.uid()$$, '207. (aceito) HTML no nome é guardado como texto: o app mostra com esc()');
select pg_temp.err($$update public.profiles set privacy_show = jsonb_build_object('x', repeat('a', 100000)) where id = auth.uid()$$, 'profiles_privacy_show_check', '208. ajustes de privacidade gigantes');
select pg_temp.err($$update public.profiles set sports = array_fill('beach'::text, array[10000]) where id = auth.uid()$$, 'profiles_sports_check', '209. lista de esportes com 10 mil itens');
select pg_temp.err($$update public.profiles set avatar_url = 'https://evil.example/rastreio.gif' where id = auth.uid()$$, 'profiles_avatar_url_check', '210. foto de perfil vinda de fora (rastreia quem abre)');
select pg_temp.err($$update public.profiles set handle = 'Ana Admin' where id = auth.uid()$$, 'profiles_handle_check', '211. @ com espaço e maiúscula');
select pg_temp.err($$update public.profiles set privacy_level = 'publico' where id = auth.uid()$$, 'profiles_privacy_level_check', '212. privacidade fora da lista');
select pg_temp.err($$update public.profiles set tag_policy = 'ninguem; drop table x' where id = auth.uid()$$, 'profiles_tag_policy_check', '213. quem pode me marcar fora da lista');
select pg_temp.err($$update public.matches set visibility = 'publico' where id = 'a_mov'$$, 'matches_visibility_check', '214. visibilidade fora da lista');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, reason, category) values (auth.uid(), '00000000-0000-0000-0000-0000000000c1', 'x x', 'qualquer')$$, 'reports_category_check', '215. motivo de denúncia fora da lista');
select pg_temp.err($$insert into public.reports (reporter_id, target_user_id, reason) values (auth.uid(), '00000000-0000-0000-0000-0000000000c1', repeat('r', 501))$$, 'reports_reason_check', '216. denúncia com 501 letras');
select pg_temp.err($$insert into public.places (name, city, created_by) values ('Arena', repeat('c', 100000), auth.uid())$$, 'places_city_check', '217. cidade do lugar gigante');
select pg_temp.err($$insert into public.places (name, lat, lng, created_by) values ('Arena', 999, 0, auth.uid())$$, 'places_lat_check', '218. latitude impossível');
select pg_temp.err($$insert into public.places (name, created_by, verified) values ('Arena Oficial', auth.uid(), true)$$, 'row-level security', '219. cadastrar lugar já "verificado"');
select pg_temp.err($$insert into public.live_matches (match_id, sport, score) values ('vivo_a', 'beach', jsonb_build_object('x', repeat('a', 10000)))$$, 'live_matches_check', '220. placar ao vivo gigante');
select pg_temp.works($$insert into public.live_matches (match_id, sport, last_point_at) values ('vivo_a', 'beach', '2099-01-01')$$, '221a. (controle) começa o placar ao vivo');
select pg_temp.ok((select last_point_at <= now() from public.live_matches where match_id = 'vivo_a'), '221. "jogando agora" com último ponto no futuro: o servidor usa a hora dele');
reset role;
select pg_temp.works($$insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000aa', jsonb_build_object('full_name', 'Maria Aparecida dos Santos Oliveira Pereira da Silva Costa Albuquerque' || chr(10)))$$, '222. conta nova com nome do Google de 70 letras não quebra o cadastro');
select pg_temp.ok((select char_length(name) <= 60 and name !~ '[[:cntrl:]]' from public.profiles where id = pg_temp.id('aa')), '223. o nome é cortado em 60 letras e sem caracteres de controle');
set role authenticated;

-- ============================================================
-- arquivos (storage)
-- ============================================================
\o /dev/null
select pg_temp.u('a1');
\o
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b1/foto.jpg')$$, 'row-level security', '224. subir foto na pasta de outra pessoa');
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000a1/../00000000-0000-0000-0000-0000000000b1/foto.jpg')$$, 'row-level security', '225. caminho com ../ para a pasta de outra pessoa');
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('avatars', 'foto.jpg')$$, 'row-level security', '226. foto na raiz do bucket (fora de qualquer pasta)');
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('outro', '00000000-0000-0000-0000-0000000000a1/x.html')$$, 'row-level security', '227. subir em bucket que não existe nas regras');
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000a1/foto.jpg');
select pg_temp.err($$update storage.objects set name = '00000000-0000-0000-0000-0000000000a1/./../00000000-0000-0000-0000-0000000000b1/foto.jpg' where bucket_id = 'avatars'$$, 'row-level security', '228. renomear a foto com ../ para outra pasta');
reset role;
insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-0000000000b1/foto.jpg', pg_temp.id('b1')), ('videos', '00000000-0000-0000-0000-0000000000b1/b_pub/1.webm', pg_temp.id('b1'));
set role authenticated;
select pg_temp.none($$delete from storage.objects where name like '00000000-0000-0000-0000-0000000000b1/%'$$, '229. apagar foto e vídeo de outra pessoa');
select pg_temp.ok(pg_temp.n($$select 1 from storage.objects where bucket_id = 'videos'$$) = 0, '230. não lista vídeos de ninguém');
reset role;
select pg_temp.ok((select not public and file_size_limit <= 209715200 and allowed_mime_types <@ array['video/webm', 'video/mp4'] from storage.buckets where id = 'videos')
  and (select file_size_limit <= 524288 and not (allowed_mime_types && array['image/svg+xml', 'text/html']) from storage.buckets where id = 'avatars'), '231. vídeos privados e só webm/mp4; fotos até 512 KB, sem SVG nem HTML');
select 'aviso: não há cota total de armazenamento por conta (fotos: quantos arquivos quiser de 512 KB; vídeos Pro: trechos de até 200 MB sem limite de total)';

-- ============================================================
-- higiene: security definer, permissões e RLS
-- ============================================================
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '232. toda função security definer fixa o search_path' || coalesce(' (faltam: ' || (select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) || ')', ''));
select pg_temp.ok(not exists (select 1 from unnest(array['public.close_correction(uuid)', 'public.close_delete_request(uuid)', 'public.expire_open_requests()', 'public.leave_all(uuid)',
  'public.finish_match_if_empty(text)', 'public.live_cleanup()', 'public.admin_log_frozen()']) f, unnest(array['anon', 'authenticated']) r where has_function_privilege(r, f, 'execute')),
  '233. funções internas (fechar pedidos, prazos, sair de tudo, limpeza) não são chamadas por anon nem authenticated');
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
  and p.prorettype <> 'trigger'::regtype and p.proname not in ('is_blocked_between', 'follows_active', 'group_role', 'is_group_member', 'is_group_manager', 'can_see_match', 'played_match', 'match_has_others', 'can_see_group',
  'profile_counts', 'group_ranking', 'group_by_code', 'join_group_by_code', 'my_stats_matches', 'feed_following', 'head_to_head', 'leave_match', 'request_match_deletion', 'vote_match_deletion',
  'request_score_correction', 'vote_score_correction', 'del_is_voter', 'del_is_requester', 'fix_is_voter', 'fix_is_proposer', 'sub_active', 'has_pro', 'my_private_profile')),
  '234. anon só chama as funções security definer conhecidas (usadas nas regras ou que exigem conta)' || coalesce(' (fora da lista: ' || (select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') and p.prorettype <> 'trigger'::regtype and p.proname not in ('is_blocked_between', 'follows_active', 'group_role', 'is_group_member',
  'is_group_manager', 'can_see_match', 'played_match', 'match_has_others', 'can_see_group', 'profile_counts', 'group_ranking', 'group_by_code', 'join_group_by_code', 'my_stats_matches', 'feed_following', 'head_to_head', 'leave_match',
  'request_match_deletion', 'vote_match_deletion', 'request_score_correction', 'vote_score_correction', 'del_is_voter', 'del_is_requester', 'fix_is_voter', 'fix_is_proposer', 'sub_active', 'has_pro', 'my_private_profile')) || ')', ''));
select pg_temp.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '235. toda tabela de public tem RLS ligada');
select pg_temp.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('v', 'm')
  and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))), '236. nenhuma view aberta para anon/authenticated (view passa por cima da RLS)');
select pg_temp.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r where n.nspname = 'public' and c.relkind = 'r'
  and (has_table_privilege(r, c.oid, 'truncate') or has_table_privilege(r, c.oid, 'trigger') or has_table_privilege(r, c.oid, 'references'))), '237. ninguém do app tem TRUNCATE, TRIGGER ou REFERENCES (TRUNCATE passa por cima da RLS)');
select pg_temp.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'app_events'
  and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))),
  '238. anon só escreve em app_events (as outras tabelas fecham também pela permissão, não só pela RLS)');
-- texto e json que o app escreve, sem limite de tamanho (cada coluna precisa de uma regra: check ou chave estrangeira)
select pg_temp.ok(x is null, '239. toda coluna de texto/json/lista que o app grava tem limite' || coalesce(' (sem limite: ' || x || ')', '')) from (
  select string_agg(c.table_name || '.' || c.column_name, ', ' order by c.table_name, c.column_name) x
  from information_schema.columns c join pg_class t on t.relname = c.table_name and t.relnamespace = 'public'::regnamespace and t.relkind = 'r'
  where c.table_schema = 'public' and (c.data_type in ('text', 'jsonb', 'ARRAY') or c.udt_name = 'citext')
    and (has_column_privilege('authenticated', t.oid, c.column_name, 'insert') or has_column_privilege('authenticated', t.oid, c.column_name, 'update')
         or has_column_privilege('anon', t.oid, c.column_name, 'insert'))
    and not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
                    where k.conrelid = t.oid and a.attname = c.column_name and k.contype in ('c', 'f'))) y;
select 'aviso: qualquer um pode chamar has_pro(id) e sub_active(id) de outra pessoa (o Pro de cortesia já é público em profiles.pro_until)';
