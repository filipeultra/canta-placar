-- 20%: lançar partida, marcar 2 pessoas (com política e limites) e a 1ª aceitar
\set n random(1, 5000)
\set k random(1, 1000000)
begin;
set local role authenticated;
select bench.write(:n, :k);
commit;
