-- ULTRA PLAY · testes da assinatura (Pro, Pro Amigos, recibos). Rodar numa base nova depois de supabase-stub.sql e schema.sql.
-- A assinatura e os recibos são escritos pelo webhook do pagamento (service role); aqui o "servidor" é o usuário do banco.
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a9', '{"name":"Ana Paga"}'), ('00000000-0000-0000-0000-0000000000b9', '{"name":"Bia Amiga"}'),
 ('00000000-0000-0000-0000-0000000000c9', '{"name":"Caio Amigo"}'), ('00000000-0000-0000-0000-0000000000d9', '{"name":"Davi Solo"}'),
 ('00000000-0000-0000-0000-0000000000e9', '{"name":"Eva Bloqueada"}');
-- servidor: Ana assina o Amigos anual; Davi, o Pro mensal
insert into public.subscriptions (user_id, plan, status, provider, current_period_end) values
 ('00000000-0000-0000-0000-0000000000a9', 'amigos_anual', 'ativa', 'web', now() + interval '1 year'),
 ('00000000-0000-0000-0000-0000000000d9', 'pro_mensal', 'ativa', 'web', now() + interval '1 month');
insert into public.payments (user_id, plan, amount, method) values ('00000000-0000-0000-0000-0000000000a9', 'amigos_anual', 549.90, 'cartao');
insert into public.blocks (user_id, blocked_id) values ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000a9');
-- mais 5 contas para encher o plano
insert into auth.users (id, raw_user_meta_data) select ('00000000-0000-0000-0000-00000000010' || g)::uuid, jsonb_build_object('name', 'Extra ' || g) from generate_series(1, 5) g;
create or replace function pg_temp.u(c text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c || '9', false) $$;
set role authenticated;
\o /dev/null
select pg_temp.u('a');
\o
select '1. Ana tem Pro: ' || public.has_pro(auth.uid()) || ' · Bia ainda não: ' || public.has_pro('00000000-0000-0000-0000-0000000000b9');
insert into public.subscription_members (owner_id, member_id, status) values (auth.uid(), '00000000-0000-0000-0000-0000000000b9', 'ativo');
select '2. convite nasce pendente (mesmo pedindo ativo): ' || status || ' · Bia com Pro: ' || public.has_pro(member_id) from public.subscription_members;
do $$ begin update public.subscription_members set status = 'ativo' where member_id = '00000000-0000-0000-0000-0000000000b9'; if (select status from public.subscription_members limit 1) = 'ativo' then raise notice '3. ERRO: dona aceitou pela amiga'; else raise notice '3. só a pessoa convidada aceita'; end if; exception when check_violation then raise notice '3. só a pessoa convidada aceita'; end $$;
do $$ begin insert into public.subscription_members (owner_id, member_id) values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000c9'); raise notice '4. ERRO: convidou em nome de outro'; exception when insufficient_privilege or check_violation then raise notice '4. ninguém convida pelo plano de outro'; end $$;
do $$ begin insert into public.subscription_members (owner_id, member_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000e9'); raise notice '5. ERRO: convidou quem bloqueou'; exception when check_violation then raise notice '5. não convida quem bloqueou'; end $$;
\o /dev/null
select pg_temp.u('b');
\o
update public.subscription_members set status = 'ativo' where member_id = auth.uid();
select '6. Bia aceitou: ' || status || ' · tem Pro: ' || public.has_pro(auth.uid()) from public.subscription_members where member_id = auth.uid();
select '7. Bia vê a assinatura da Ana: ' || count(*) || ' · recibos da Ana: ' || (select count(*) from public.payments) from public.subscriptions;
do $$ begin update public.subscription_members set owner_id = '00000000-0000-0000-0000-0000000000d9' where member_id = auth.uid(); raise notice '8. ERRO: trocou de plano sozinha'; exception when insufficient_privilege then raise notice '8. ninguém se muda de plano'; end $$;
\o /dev/null
select pg_temp.u('d');
\o
do $$ begin insert into public.subscription_members (owner_id, member_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c9'); raise notice '9. ERRO: Pro mensal convidou'; exception when check_violation then raise notice '9. só o Pro Amigos tem vagas'; end $$;
select '10. Davi vê os convites da Ana: ' || count(*) from public.subscription_members;
-- encher o plano
\o /dev/null
select pg_temp.u('a');
\o
insert into public.subscription_members (owner_id, member_id) select auth.uid(), ('00000000-0000-0000-0000-00000000010' || g)::uuid from generate_series(1, 4) g;
select '11. Ana com 5 convidados: ' || count(*) from public.subscription_members;
do $$ begin insert into public.subscription_members (owner_id, member_id) values (auth.uid(), '00000000-0000-0000-0000-000000000105'); raise notice '12. ERRO: 6º convidado'; exception when check_violation then raise notice '12. no máximo 5 convidados'; end $$;
delete from public.subscription_members where member_id = '00000000-0000-0000-0000-000000000104';
insert into public.subscription_members (owner_id, member_id) values (auth.uid(), '00000000-0000-0000-0000-000000000105');
select '13. tirou um e convidou outro: ' || count(*) from public.subscription_members;
do $$ begin insert into public.payments (user_id, plan, amount, method) values (auth.uid(), 'pro_anual', 0, 'pix'); raise notice '14. ERRO: recibo falso'; exception when insufficient_privilege then raise notice '14. recibo só pelo servidor'; end $$;
do $$ begin update public.subscriptions set current_period_end = now() + interval '10 years' where user_id = auth.uid(); raise notice '15. ERRO: estendeu a assinatura'; exception when insufficient_privilege then raise notice '15. ninguém estende a própria assinatura'; end $$;
-- Bia sai do plano
\o /dev/null
select pg_temp.u('b');
\o
delete from public.subscription_members where member_id = auth.uid();
select '16. Bia saiu e voltou ao Grátis: ' || public.has_pro(auth.uid());
-- assinatura da Ana termina: convidados perdem o Pro (o servidor não tem usuário logado)
reset role;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
update public.subscriptions set status = 'cancelada', current_period_end = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-0000000000a9';
update public.subscription_members set status = 'ativo' where member_id = '00000000-0000-0000-0000-000000000101';
select '17. depois do fim do período, convidado com Pro: ' || public.has_pro('00000000-0000-0000-0000-000000000101') || ' · Ana: ' || public.has_pro('00000000-0000-0000-0000-0000000000a9');
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin perform 1 from public.subscription_members; raise notice '18. ERRO: anônimo leu'; exception when insufficient_privilege then raise notice '18. anônimo não lê membros nem recibos'; end $$;
