# ULTRA PLAY · servidor (Supabase)

O app hoje funciona sem servidor: tudo fica no aparelho. Este diretório tem o banco pronto para quando entrar a **conta na nuvem**, com o mesmo modelo que o app já usa no aparelho (ver `docs/SOCIAL.md`).

| Arquivo | O que é |
|---|---|
| `schema.sql` | Tabelas, índices, gatilhos e regras por linha (RLS): pessoas, seguir, bloquear, lugares e quadras, temporadas da arena, **grupos** (membros, papéis, autorização temporária, resenha), partidas, lances, jogadores marcados, pedidos de convidado, zaps, notificações, vídeos (Pro), assinatura e denúncias. |
| `storage.sql` | Pastas de arquivos: fotos de perfil (públicas) e vídeos (privados, Pro). |
| `tests/regras.sql` | 28 verificações das regras, rodadas num Postgres 16 local em 13/10/2026: todas passaram. |
| `admin.sql` | Estatísticas de uso e painel de admin (ver abaixo). |
| `tests/admin.sql` | 21 verificações do painel: sem consentimento só entra visita, anônimo não lê eventos, quem não é admin não lê nem age; busca, cortesia, denúncias (tirar do ar) e registro de ações. |
| `tests/supabase-stub.sql` | Simula o que o Supabase já traz (`auth.users`, `auth.uid()`), para rodar os testes fora dele. |

## O que as regras garantem (testado)

- **Grupo fechado:** quem pede entra como pendente e o organizador recebe o pedido. Ninguém entra como organizador por conta própria. Quem tem o **link de convite** entra direto. Quem é de fora não vê o grupo.
- **Autorização ao organizador:** só a própria pessoa autoriza, por no máximo 24 horas, e pode cancelar quando quiser. A partida que o organizador ou um moderador lança com quem autorizou já entra **aceita**, com a notificação "lançada por você com autorização". Quem não autorizou recebe a marcação normal para aceitar.
- **Partidas:** a visibilidade (todos, seguidores, só eu, rascunho) vale junto com a privacidade do perfil. Perfil privado: só seguidor aprovado vê. Membros do grupo veem as partidas do grupo. Quem foi marcado e aceitou sempre vê.
- **Bloqueio:** some o perfil, as partidas, o seguir e o zap nos dois sentidos.
- **Ninguém se dá Pro**, troca de time numa partida, cria notificação falsa ou dá zap em nome de outra pessoa. O campo do Pro só muda pelo servidor de pagamento.
- **Ranking do grupo** (`group_ranking`): só membros, só partidas aceitas, com período.

## Painel de admin (`admin/`)

Endereço: **https://filipeultra.github.io/canta-placar/admin/**. Não é linkado no app e o Google não indexa.
- **Sem servidor:** mostra **dados de demonstração** (fictícios), para ver o painel funcionando. Com o servidor ligado, `?demo=1` no endereço volta à demonstração.
- **Com servidor:** entra com o e-mail de uma conta admin (link mágico do Supabase). Só lê os números quem estiver na tabela `admins`; para os outros, a função `admin_metrics` recusa.
- **Seções** (menu ao lado no computador, faixa no topo no celular; período de 7, 30 ou 90 dias comparando com o anterior):
  - **Visão geral:** quem está usando agora (últimos 15 min), ativos no dia/semana/mês, 8 indicadores com mini gráfico, visitas e ativos por dia e **“O que olhar agora”** (denúncias, variação das visitas, maior perda do funil, retenção, versões antigas, custo da IA).
  - **Crescimento:** contas, novas contas, conversão visita → conta, instalações, convites, contas excluídas, funil, origem (utm, convite `?ref=`, direto) e retenção por semana.
  - **Uso do app:** ativos (DAU/WAU/MAU) e frequência, partidas, % de pontos por voz, % que usa o app instalado, gravações, compartilhamentos, sugestões, partidas por esporte, **mapa de calor de quando se joga** (dia × hora) e versões do app em uso.
  - **Receita:** MRR, ARR, assinantes pagando e de cortesia, ticket médio, novas assinaturas, cancelamentos, churn mensal, valor por assinante (LTV), custo da IA no mês, planos e um simulador de projeção.
  - **Contas:** busca por nome, @, código UP-… ou e-mail, e **Pro de cortesia** (7, 30, 90 dias ou 1 ano; ou tirar).
  - **Grupos:** os mais movimentados (membros, pedidos, partidas, posts).
  - **Moderação:** fila de denúncias (abertas, resolvidas, descartadas) com **Em análise, Resolvida, Tirar do ar e Descartar**, e o **registro de ações** de todos os admins.
  - **IA:** análises, quem usou, custo, custo por análise, projeção e tokens. **Eventos:** o que o app registra.
  - Tema claro/escuro, atualização automática a cada minuto e **CSV** de cada tabela.
- **De onde vêm os números:** `admin.sql` (tabelas `app_events`, `admins`, `plan_prices`, `admin_log` e as funções `admin_metrics`, `admin_users`, `admin_grant_pro`, `admin_reports`, `admin_handle_report`, `admin_groups`), testado em `tests/admin.sql` (21 verificações, todas passando em 13/10/2026).
  - O app e o site mandam eventos por `telemetry.js`, mas só quando `config.js` estiver preenchido.
  - **Sem consentimento**, só a visita, com um id que some ao fechar.
  - **Com consentimento** (o app pergunta uma vez, depois da 1ª partida; e em Ajustes → Estatísticas de uso), os eventos de uso, com um id sorteado do aparelho.
  - Nenhum nome, e-mail ou partida vai nos eventos.
- **Segurança do painel (testada em `tests/admin.sql`, seção "invasão", 21 tentativas bloqueadas):**
  - **Duas etapas para entrar:** link no e-mail + código de 6 números de um app autenticador (Google Authenticator, Authy, 1Password). O banco só reconhece admin com a sessão na 2ª etapa (`aal2` no token); quem rouba só o link do e-mail não entra. Na 1ª vez, o painel mostra o QR Code para cadastrar.
  - **Ninguém se torna admin pelo app ou pela API:** a tabela `admins` não aceita gravação de ninguém (só pelo SQL Editor do Supabase, com a sua conta de dono do projeto). Também não dá para se dar Pro, criar assinatura, mudar preço, mexer em denúncia ou no registro de ações.
  - **Não dá para descobrir quem é admin:** `is_admin()` só responde sobre a própria sessão.
  - **Permissões fechadas por tabela:** o Supabase libera toda tabela nova para todo mundo; `admin.sql` tira tudo e devolve só o necessário. Os testes simulam essa liberação padrão para pegar qualquer esquecimento.
  - **Sair de verdade:** "Sair" invalida a sessão no servidor; parado por 30 min, o painel sai sozinho. A sessão fica só na aba (some ao fechar).
  - **No Supabase (você):** Authentication → URL Configuration: pôr `https://filipeultra.github.io/canta-placar/admin/` nas URLs de redirecionamento; Authentication → Multi-Factor: deixar TOTP ligado (já vem ligado). Nunca coloque a chave `service_role` no `config.js` nem no site: só a `anon`.
  - **Limite conhecido:** qualquer um pode mandar eventos de visita (é assim que o site conta visitas sem login). Isso não dá acesso a nada, mas alguém mal-intencionado pode inflar os números de visitas; o Supabase limita a taxa de pedidos por IP e o painel mostra a origem para identificar.
- **Primeiro admin:** depois de criar sua conta no app, rode no SQL Editor: `insert into admins (user_id) select id from auth.users where email = 'seu@email.com';`

## Como ligar (passo a passo)

1. Criar o projeto em supabase.com (região São Paulo, `sa-east-1`). O plano grátis serve para o lançamento; o Pro custa US$ 25 por mês quando passar dos limites.
2. No **SQL Editor**, rodar `schema.sql`, depois `storage.sql` e `admin.sql`.
3. Em **Authentication → Providers**, ligar Google, Apple e telefone (SMS ou WhatsApp, com um provedor como Twilio). Em **URL Configuration**, pôr o endereço do app.
4. Copiar a **URL do projeto** e a **chave anon** (pública) para `config.js` (vale para o app, o site e o painel). A chave **service role** nunca vai para o app: fica só no servidor de pagamento.
5. A política de segurança já libera `https://*.supabase.co` no app, no site e no painel.
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
