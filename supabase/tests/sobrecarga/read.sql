-- 80% das visitas: timeline Geral, timeline Seguindo, estatísticas e notificações de uma pessoa ao acaso
\set n random(1, 5000)
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', bench.uid(:n), true);
select id from public.matches where status = 'publicada' and deleted_at is null order by played_at desc limit 30;
select id from public.feed_following();
select count(*) from public.my_stats_matches();
select id from public.notifications where user_id = auth.uid() order by created_at desc limit 50;
commit;
