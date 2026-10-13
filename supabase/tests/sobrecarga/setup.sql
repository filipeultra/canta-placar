-- funções de apoio do teste de sobrecarga (pgbench). Rodar depois do carga.sql, na mesma base.
create schema if not exists bench;
create or replace function bench.uid(n int) returns text language sql immutable as $$ select '00000000-0000-0000-0001-' || lpad(to_hex(n), 12, '0') $$;
-- escrita típica: lança partida, marca 2 pessoas (com política/limites), a 1ª aceita; erros de regra contam como "recusado"
create or replace function bench.write(n int, k int) returns text language plpgsql as $$
declare mid text := 'b' || n || '-' || k || '-' || floor(random() * 1e9)::bigint; a uuid; b uuid;
begin
  perform set_config('request.jwt.claim.sub', bench.uid(n), true);
  if not exists (select 1 from public.profiles where id = auth.uid()) then return 'sem conta'; end if;
  insert into public.matches (id, owner_id, sport, played_at, result) values (mid, auth.uid(), 'beach', now(), '{"sets":[[6,4]],"winner":0}');
  insert into public.match_players (match_id, team, slot, user_id) values (mid, 0, 0, auth.uid());
  a := bench.uid(1 + (n * 37 + k) % 5000)::uuid; b := bench.uid(1 + (n * 91 + k * 7) % 5000)::uuid;
  begin
    insert into public.match_players (match_id, team, slot, user_id) values (mid, 1, 0, a);
    insert into public.match_players (match_id, team, slot, user_id) values (mid, 1, 1, b);
  exception when others then return 'recusado';
  end;
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.match_players set tag_status = 'aceito' where match_id = mid and user_id = auth.uid();
  return 'ok';
end $$;
grant usage on schema bench to authenticated; grant execute on all functions in schema bench to authenticated;
