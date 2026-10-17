-- ULTRA PLAY · tarefas agendadas (Supabase → SQL Editor, depois do instalar.sql).
-- Liga o agendador do Postgres e cria as 3 tarefas. Rodar de novo não duplica (o nome é a chave).
create extension if not exists pg_cron;
select cron.schedule('ultra-prazos', '7 3 * * *', $$select public.expire_open_requests()$$);     -- pedidos de exclusão e correções vencidos, todo dia 03:07 (UTC)
select cron.schedule('ultra-resumo-site', '17 * * * *', $$select public.web_rollup()$$);         -- resumo diário do painel Site e app, de hora em hora
select cron.schedule('ultra-limpa-cliques', '27 4 * * *', $$select public.prune_heat_clicks()$$); -- cliques do mapa de calor com mais de 90 dias
