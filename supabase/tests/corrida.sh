#!/bin/sh
# Corrida: dois votos finais no mesmo segundo no pedido de exclusão para todos. Os dois votam "sim" e o pedido tem que fechar.
# Uso: sh supabase/tests/corrida.sh <base vazia>   (roda o stub e o schema nela)
set -e
DB=${1:?nome da base}
dir=$(dirname "$0")
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$dir/supabase-stub.sql" -f "$dir/../schema.sql" >/dev/null
psql -d "$DB" -q -At >/dev/null <<'SQL'
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a1','{"name":"A"}'),('00000000-0000-0000-0000-0000000000b1','{"name":"B"}'),('00000000-0000-0000-0000-0000000000c1','{"name":"C"}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
begin;
insert into public.matches (id, owner_id, sport, played_at, result) values ('x1', auth.uid(), 'beach', now(), '{"winner":0}');
insert into public.match_players (match_id, team, slot, user_id) values ('x1',0,0,auth.uid()),('x1',1,0,'00000000-0000-0000-0000-0000000000b1'),('x1',1,1,'00000000-0000-0000-0000-0000000000c1');
commit;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
update public.match_players set tag_status='aceito' where match_id='x1' and user_id=auth.uid();
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
update public.match_players set tag_status='aceito' where match_id='x1' and user_id=auth.uid();
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select public.request_match_deletion('x1','duplicada');
SQL
vote() { psql -d "$DB" -q -At <<SQL
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000$1',true) \g /dev/null
select '$1 votou: ' || public.vote_match_deletion((select id from public.match_delete_requests where match_id='x1'), true); select pg_sleep(1.5) \g /dev/null
commit;
SQL
}
vote b1 & sleep 0.4; vote c1 & wait
psql -d "$DB" -At -c "select case when q.status = 'aprovado' and m.deleted_at is not null then 'ok   os dois votos contaram e a partida saiu' else 'ERRO pedido ficou ' || q.status end from public.match_delete_requests q join public.matches m on m.id = q.match_id"
