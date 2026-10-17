#!/bin/sh
# Roda todas as verificações do banco, cada uma numa base nova (Postgres 16 local).
# Uso: sh supabase/tests/rodar.sh   (precisa de createdb/psql com permissão de criar bases)
cd "$(dirname "$0")/.." || exit 1
falhou=0
base() { dropdb --if-exists "$1"; createdb "$1"; psql -q -v ON_ERROR_STOP=1 -d "$1" -f tests/supabase-stub.sql >/dev/null; }
rodar() { # nome, arquivos do esquema..., teste
  nome=$1; shift; teste=$(eval echo \${$#}); db=up_t_$nome
  base "$db"
  for f in "$@"; do [ "$f" = "$teste" ] && break; psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null 2>"/tmp/up_$nome.err" || { echo "✗ $nome: erro ao carregar $f"; cat "/tmp/up_$nome.err"; falhou=1; return; }; done
  out=$(psql -v ON_ERROR_STOP=1 -d "$db" -f "$teste" 2>&1); st=$?
  n=$(printf '%s\n' "$out" | grep -cE '(^ *(ok +)?|NOTICE: +)[0-9]+[a-z]?\. ')
  erros=$(printf '%s\n' "$out" | grep -E 'ERRO|ERROR|FALH|^ *xx|NAO OK|NÃO OK' )
  if [ $st -ne 0 ] || [ -n "$erros" ]; then echo "✗ $nome ($n verificações)"; printf '%s\n' "$erros" | head -20; falhou=1; else echo "✓ $nome ($n verificações)"; fi
  dropdb "$db"
}
rodar regras schema.sql tests/regras.sql
rodar partidas schema.sql tests/partidas.sql
rodar ao-vivo schema.sql tests/ao-vivo.sql
rodar formato schema.sql tests/formato.sql
rodar assinatura schema.sql tests/assinatura.sql
rodar arquivos schema.sql tests/storage-stub.sql storage.sql tests/arquivos.sql
rodar fotos schema.sql tests/storage-stub.sql storage.sql tests/fotos.sql
rodar admin schema.sql admin.sql tests/admin.sql
rodar admin-seguranca schema.sql admin.sql tests/admin-seguranca.sql
rodar admin-links schema.sql admin.sql tests/admin-links.sql
rodar admin-web schema.sql admin.sql tests/admin-web.sql
[ -f tests/ataques.sql ] && rodar ataques schema.sql tests/storage-stub.sql storage.sql admin.sql tests/ataques.sql
exit $falhou
