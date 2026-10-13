# ULTRA PLAY · servidor (Supabase)

O app hoje funciona sem servidor: tudo fica no aparelho. Este diretório tem o banco pronto para quando entrar a **conta na nuvem**, com o mesmo modelo que o app já usa no aparelho (ver `docs/SOCIAL.md`).

| Arquivo | O que é |
|---|---|
| `schema.sql` | Tabelas, índices, gatilhos e regras por linha (RLS): pessoas, seguir, bloquear, lugares e quadras, temporadas da arena, **grupos** (membros, papéis, autorização temporária, resenha), partidas, lances, jogadores marcados, pedidos de convidado, zaps, notificações, vídeos (Pro), assinatura e denúncias. |
| `storage.sql` | Pastas de arquivos: fotos de perfil (públicas) e vídeos (privados, Pro). |
| `tests/regras.sql` | 28 verificações das regras, rodadas num Postgres 16 local em 13/10/2026: todas passaram. |
| `tests/supabase-stub.sql` | Simula o que o Supabase já traz (`auth.users`, `auth.uid()`), para rodar os testes fora dele. |

## O que as regras garantem (testado)

- **Grupo fechado:** quem pede entra como pendente e o organizador recebe o pedido. Ninguém entra como organizador por conta própria. Quem tem o **link de convite** entra direto. Quem é de fora não vê o grupo.
- **Autorização ao organizador:** só a própria pessoa autoriza, por no máximo 24 horas, e pode cancelar quando quiser. A partida que o organizador ou um moderador lança com quem autorizou já entra **aceita**, com a notificação "lançada por você com autorização". Quem não autorizou recebe a marcação normal para aceitar.
- **Partidas:** a visibilidade (todos, seguidores, só eu, rascunho) vale junto com a privacidade do perfil. Perfil privado: só seguidor aprovado vê. Membros do grupo veem as partidas do grupo. Quem foi marcado e aceitou sempre vê.
- **Bloqueio:** some o perfil, as partidas, o seguir e o zap nos dois sentidos.
- **Ninguém se dá Pro**, troca de time numa partida, cria notificação falsa ou dá zap em nome de outra pessoa. O campo do Pro só muda pelo servidor de pagamento.
- **Ranking do grupo** (`group_ranking`): só membros, só partidas aceitas, com período.

## Como ligar (passo a passo)

1. Criar o projeto em supabase.com (região São Paulo, `sa-east-1`). O plano grátis serve para o lançamento; o Pro custa US$ 25 por mês quando passar dos limites.
2. No **SQL Editor**, rodar `schema.sql` e depois `storage.sql`.
3. Em **Authentication → Providers**, ligar Google, Apple e telefone (SMS ou WhatsApp, com um provedor como Twilio). Em **URL Configuration**, pôr o endereço do app.
4. Copiar a **URL do projeto** e a **chave anon** (pública) para o app. A chave **service role** nunca vai para o app: fica só no servidor de pagamento.
5. No app, liberar o endereço do projeto na política de segurança (`connect-src` em `index.html`).
6. Trocar as funções de `social.js` pelas chamadas ao banco. As telas não mudam: o app só fala com a rede por essas funções. O mapa função → tabela está em `docs/SOCIAL.md`. A ordem sugerida:
   1. login e perfil;
   2. subir as partidas do aparelho (fila offline, id gerado no aparelho, sem duplicar);
   3. seguir, zap, marcações e notificações;
   4. grupos: `group_by_code`, `join_group_by_code`, `group_delegations`, `group_posts`, `group_ranking`;
   5. vídeo na nuvem (Pro).
7. **Placar ↔ câmera:** trocar o ntfy.sh por um canal do Supabase Realtime (`match:<id>`), sem tabela. Só muda o `relay.js`.
8. **Pagamento:** um webhook (Edge Function) do Mercado Pago ou do Stripe grava em `subscriptions` e `profiles.pro_until` com a service role.

## Para rodar os testes num Postgres local

```sh
createdb ultraplay_teste
psql -d ultraplay_teste -f supabase/tests/supabase-stub.sql
psql -d ultraplay_teste -f supabase/schema.sql
psql -d ultraplay_teste -f supabase/tests/regras.sql
```
