#!/bin/sh
# Junta schema.sql, storage.sql e admin.sql em instalar.sql (um arquivo só para colar no SQL Editor do Supabase).
# Rodar de novo sempre que um dos três mudar: sh supabase/montar.sh
cd "$(dirname "$0")" || exit 1
{
  echo "-- ULTRA PLAY · instalação completa do banco (gerado por montar.sh; não edite aqui, edite schema.sql, storage.sql e admin.sql)."
  echo "-- Colar inteiro no Supabase → SQL Editor → Run, num projeto novo. Depois rode agendar.sql."
  for f in schema.sql storage.sql admin.sql; do printf '\n-- ============================== %s ==============================\n' "$f"; cat "$f"; done
} > instalar.sql
echo "instalar.sql: $(wc -l < instalar.sql) linhas"
