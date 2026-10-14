-- Segurança do painel de admin: papéis, código recente para ações sensíveis, e-mail mascarado, acessos e registro que não se apaga.
-- Rodar numa base nova: supabase-stub.sql, schema.sql, admin.sql e este arquivo. Cada linha sai "ok" ou "ERRO".
\set QUIET on
\pset footer off
\pset tuples_only on
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000d0', 'dona@exemplo.com', '{"name":"Dona"}'), ('00000000-0000-0000-0000-0000000000d1', 'mod@exemplo.com', '{"name":"Moderador"}'),
 ('00000000-0000-0000-0000-0000000000d2', 'leitor@exemplo.com', '{"name":"Leitor"}'), ('00000000-0000-0000-0000-0000000000d3', 'atleta@exemplo.com', '{"name":"Atleta"}');
insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-0000000000d0', 'dono'), ('00000000-0000-0000-0000-0000000000d1', 'moderador'), ('00000000-0000-0000-0000-0000000000d2', 'leitor');
-- quem: sufixo do id; codigo_min: há quantos minutos digitou o código do autenticador
create function pg_temp.as_admin(c text, codigo_min int default 1) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || c, false),
         set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000' || c, 'aal', 'aal2',
           'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', (extract(epoch from now()) - codigo_min * 60)::bigint)))::text, false),
         set_config('request.headers', '{"user-agent":"Teste/1.0","x-forwarded-for":"200.10.20.30, 10.0.0.1"}', false) $$;
create function pg_temp.ok(cond boolean, label text) returns text language sql as $$ select case when coalesce(cond, false) then 'ok   ' else 'ERRO ' end || label $$;
create function pg_temp.err(q text, want text, label text) returns text language plpgsql as $$
begin execute q; return 'ERRO ' || label || ': passou sem erro';
exception when others then if sqlerrm like '%' || want || '%' then return 'ok   ' || label || ' (' || sqlerrm || ')'; else return 'ERRO ' || label || ': ' || sqlerrm; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
set role authenticated;
\o /dev/null
select pg_temp.as_admin('d0');
\o
select pg_temp.ok(public.admin_role() = 'dono', '1. a dona entra como dono');
select pg_temp.ok((public.admin_hello() ->> 'new_device')::boolean, '2. 1ª entrada: aparelho novo');
select pg_temp.ok(not (public.admin_hello() ->> 'new_device')::boolean, '3. 2ª entrada do mesmo aparelho: conhecido');
select pg_temp.ok((select count(*) from public.admin_log where action = 'login') = 1, '4. entrar de novo em menos de 30 min não enche o registro');
select pg_temp.ok((public.admin_access(10) -> 0 ->> 'ip') = '200.10.20.30', '5. o acesso guarda o IP de quem entrou');
select pg_temp.ok((public.admin_users('atleta') -> 0 ->> 'email') = 'at***@exemplo.com', '6. na lista de contas, o e-mail vem mascarado');
select pg_temp.ok((public.admin_users('atleta', 50, true) -> 0 ->> 'email') = 'atleta@exemplo.com', '7. a dona, com código recente, vê o e-mail inteiro');
select pg_temp.ok(exists (select 1 from public.admin_log where action = 'emails_view'), '8. ver os e-mails fica no registro');
select pg_temp.ok(public.admin_grant_pro((select public_id from public.profiles where name = 'Atleta'), 7) > now(), '9. a dona dá cortesia');
select pg_temp.ok(jsonb_array_length(public.admin_team()) = 3, '10. a dona vê a equipe');
\o /dev/null
select pg_temp.as_admin('d0', 600);
\o
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where name = 'Atleta'), 7)$$, 'codigo_recente', '11. código digitado há 10 h: dar cortesia pede o código de novo');
select pg_temp.err($$select public.admin_users('atleta', 50, true)$$, 'codigo_recente', '12. e ver e-mails inteiros também');
select pg_temp.err($$select public.admin_note_export('contas')$$, 'codigo_recente', '13. e baixar a planilha de contas');
select pg_temp.ok(public.admin_metrics(30) ? 'kpi', '14. os números continuam liberados');
\o /dev/null
select pg_temp.as_admin('d1');
\o
select pg_temp.ok(public.admin_role() = 'moderador', '15. moderador entra');
select pg_temp.ok((public.admin_users('atleta') -> 0 ->> 'email') like '%***%', '16. moderador vê contas com e-mail mascarado');
select pg_temp.err($$select public.admin_users('atleta', 50, true)$$, 'sem_permissao', '17. moderador não vê e-mail inteiro');
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where name = 'Atleta'), 7)$$, 'sem_permissao', '18. moderador não dá cortesia');
select pg_temp.err($$select public.admin_team()$$, 'sem_permissao', '19. moderador não vê a equipe');
select pg_temp.ok(jsonb_array_length(public.admin_access(10)) = 0, '20. moderador só vê os próprios acessos (ainda nenhum)');
\o /dev/null
select pg_temp.as_admin('d2');
\o
select pg_temp.ok(public.admin_metrics(30) ? 'kpi', '21. leitor vê os números');
select pg_temp.err($$select public.admin_users('')$$, 'sem_permissao', '22. leitor não vê contas');
select pg_temp.err($$select public.admin_reports('abertas')$$, 'sem_permissao', '23. leitor não vê denúncias');
select pg_temp.ok((select count(*) from public.admin_log) = 0, '24. leitor não lê o registro de ações');
-- registro que não se apaga
reset role;
select pg_temp.err($$delete from public.admin_log$$, 'não pode ser alterado', '25. nem o dono do banco apaga o registro de ações');
select pg_temp.err($$update public.admin_log set action = 'nada'$$, 'não pode ser alterado', '26. nem altera');
-- suspender um admin
update public.admins set disabled_at = now() where user_id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
\o /dev/null
select pg_temp.as_admin('d1');
\o
select pg_temp.ok(public.admin_role() is null and not public.is_admin(), '27. admin suspenso perde o acesso na hora');
select pg_temp.err($$select public.admin_metrics(30)$$, 'acesso só', '28. e não lê mais os números');
-- limite de cortesias por dia
\o /dev/null
select pg_temp.as_admin('d0');
\o
do $$ begin for i in 1..29 loop perform public.admin_grant_pro((select public_id from public.profiles where name = 'Atleta'), 1); end loop; end $$;
select pg_temp.err($$select public.admin_grant_pro((select public_id from public.profiles where name = 'Atleta'), 1)$$, 'limite_de_cortesias', '29. no máximo 30 cortesias por dia (conta roubada não distribui Pro à vontade)');
select pg_temp.ok(public.admin_note_export('contas'), '30. baixar a planilha de contas fica registrado');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.ok(not exists (select 1 from public.admins where user_id = '00000000-0000-0000-0000-0000000000d1'), '31. admin que apaga a conta sai da equipe');
select pg_temp.ok((select count(*) from public.admin_log where action = 'login') >= 1, '32. e o registro de ações continua inteiro');
