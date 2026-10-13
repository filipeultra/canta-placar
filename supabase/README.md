# ULTRA PLAY · servidor (Supabase)

O app hoje funciona sem servidor: tudo fica no aparelho. Este diretório tem o banco pronto para quando entrar a **conta na nuvem**, com o mesmo modelo que o app já usa no aparelho (ver `docs/SOCIAL.md`).

| Arquivo | O que é |
|---|---|
| `schema.sql` | Tabelas, índices, gatilhos e regras por linha (RLS): pessoas, seguir, bloquear, lugares e quadras, temporadas da arena, **grupos** (membros, papéis, foto, resenha), partidas, lances, jogadores marcados, pedidos de convidado, zaps, notificações, vídeos (Pro), assinatura, denúncias e as **regras da partida entre várias pessoas** (quem pode marcar, placar travado, excluir para mim, pedido de exclusão para todos, correção de placar, prazos de 14 dias, conta apagada). |
| `storage.sql` | Pastas de arquivos: fotos de perfil (públicas) e vídeos (privados, Pro). |
| `tests/regras.sql` | 28 verificações das regras, rodadas num Postgres 16 local em 13/10/2026: todas passaram. |
| `tests/partidas.sql` | 75 verificações das regras da partida entre várias pessoas (ver `docs/REGRAS-PARTIDAS.md`): quem pode marcar, grupo, flood, placar travado, excluir para mim, exclusão para todos, correção de placar, prazos, conta apagada, bloqueio, denúncias e foto do grupo. Todas passando em 13/10/2026. |
| `tests/carga.sql` | Teste de carga: 5.000 pessoas, 200 mil "seguir", 100 mil partidas e 400 mil marcações; mede as telas e ações mais usadas (resultado abaixo). |
| `tests/sobrecarga/` | Scripts do `pgbench` para 50 pessoas usando ao mesmo tempo (80% leitura, 20% lançar e marcar). |
| `tests/corrida.sh` | Dois votos no mesmo segundo no pedido de exclusão: os dois têm que contar. |
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

## Jogando agora (presença e placar ao vivo) e análise do dia
Já estão no `schema.sql`, com testes em `tests/ao-vivo.sql` (24 verificações). O app ainda usa a rede de demonstração; quando a conta na nuvem for ligada, ele passa a publicar o placar nestas tabelas.
- **`profiles.show_online` e `profiles.live_view`** (ligados por padrão): "Mostrar quando estou jogando" e "Deixar amigos verem o placar ao vivo". Cada um só muda os seus.
- **`live_matches` + `live_players`:** a partida em andamento (placar em `score`, convidados sem conta em `guests`). Só o dono lê e escreve direto; ninguém se coloca na partida de outro nem troca o dono.
- **`live_for_viewer(pessoa)`** é o único jeito de outra pessoa ver:
  - só quem segue a pessoa (sem bloqueio), e só se ela deixou `show_online`;
  - a pessoa com `live_view` desligado: só "está jogando <esporte>", sem placar (`mode = 'so-jogando'`);
  - alguém da partida com `live_view` desligado: placar sim, nomes e ids dos outros vazios (`mode = 'nomes'`; o app mostra "Jogador 2, 3…");
  - todos permitem: placar e nomes (`mode = 'aberto'`);
  - partida sem ponto há mais de 30 min não aparece. `live_cleanup()` apaga as paradas (agendar a cada 15 min; só o servidor roda).
- **Tempo real:** Supabase Realtime avisando que o placar mudou; o app chama `live_for_viewer` de novo (assim as regras valem sempre).
- **`daily_analyses`:** uma análise por pessoa, por esporte e por dia, e só com partida nova (`last_match_at` maior que o da última, conferido por gatilho). Pelo app só entra a análise por regras (`source = 'regras'`); a da IA quem grava é a função do servidor.

## Jogadores, apelido e predefinições de formato
Testes em `tests/formato.sql` (11 verificações).
- **`profiles.name`** é o "nome nos pontos" (nome e sobrenome curtos, usado no placar, nas estatísticas e na voz) e **`profiles.full_name`** o nome completo.
- **`match_players.nickname`:** apelido só naquela partida, quando dois jogadores têm o mesmo nome (o `user_id` continua o mesmo, então as estatísticas vão para a pessoa certa).
- **`format_presets`:** formato salvo com nome no padrão `BT1-Amigos de Segunda` (prefixo do esporte + número + até 18 letras). Cada um só vê e grava as suas; o servidor confere o prefixo e o limite do plano (grátis 1 por esporte, Pro 3).

## Carga e sobrecarga (13/10/2026, Postgres 16, 4 CPUs)

Com 100 mil partidas na base, cada tela ou ação, medida como a pessoa logada (com as regras por linha ligadas):

| Tela ou ação | Tempo |
|---|---|
| Timeline Geral (30 mais recentes) | 5 ms |
| Timeline Seguindo por `feed_following()` | 5 ms (pela regra de linha: 39 ms) |
| Estatísticas, confronto, contadores do perfil, notificações, ranking do grupo | 0,5 a 2 ms |
| Lançar partida, marcar 3 pessoas, excluir para mim, pedir exclusão, pedir correção | 1 a 5 ms |
| Apagar conta com centenas de partidas | 18 ms |

**50 pessoas ao mesmo tempo** (`pgbench`, 30 s): 513 operações por segundo, nenhuma falha. A leitura (4 consultas) leva 111 ms em média e lançar e marcar leva 44 ms. Antes da `feed_following()`, eram 104 por segundo, com leitura de 583 ms.

Para ter uma ideia: 10 mil pessoas ativas no dia, abrindo o app 5 vezes cada, dão cerca de 1 operação por segundo, ou 10 no horário de pico. A margem é de dezenas de vezes.

**O que a auditoria corrigiu:**
- **Votos ao mesmo tempo:** se as duas últimas pessoas votavam no mesmo segundo, cada uma via o voto da outra como pendente e o pedido ficava aberto para sempre. Agora o pedido é travado durante o voto (`for update`), e `tests/corrida.sh` confere.
- **Código curto repetido:** com ~50 mil partidas, o código `P-XXXXXX` sorteado repetia e o insert falhava. Agora o gatilho `unique_code` sorteia de novo.
- **Lançar partida com `returning`:** a regra de leitura não enxergava a linha nova e o Supabase (`insert().select()`) recusava. O dono agora passa direto.
- **Apagar a própria conta:** a regra de leitura escondia o próprio perfil e recusava a marcação de conta apagada. Agora a pessoa sempre lê o próprio perfil.
- **Hora da resposta:** quem aceita ou recusa não escolhe mais a hora. O servidor grava, e isso protege o prazo de 30 dias e a contagem de recusas. Recusou: não volta para pendente.
- **Apagar a própria marcação:** o marcado não apaga a linha dele. Ele recusa ou usa "Excluir para mim".
- **Conta apagada no meio de um pedido:** os pedidos de exclusão e correção que só esperavam por ela se resolvem na hora.
- **Limite de 60 convites por dia:** conta pelos avisos de marcação, que só o servidor grava. Antes, a contagem varria as marcações do dia de todo mundo.
- **Índices:** 23 índices novos nas chaves estrangeiras e nos limites por dia. Sem eles, apagar uma conta ou uma partida varreria as tabelas inteiras.
- **Dois pedidos na mesma partida:** o segundo recebe `pedido_em_andamento`, e não mais um erro de chave.

**Para depois (com mais de 100 mil pessoas):**
- busca por nome com índice de trigramas (`pg_trgm`): hoje leva 10 ms com 5 mil pessoas e cresce junto com a base;
- agendar `expire_open_requests()` uma vez por dia (pg_cron).

## Como ligar (passo a passo)

1. Criar o projeto em supabase.com (região São Paulo, `sa-east-1`). O plano grátis serve para o lançamento; o Pro custa US$ 25 por mês quando passar dos limites.
2. No **SQL Editor**, rodar `schema.sql`, depois `storage.sql` e `admin.sql`.
3. Em **Authentication → Providers**, ligar Google, Apple e telefone (SMS ou WhatsApp, com um provedor como Twilio). Em **URL Configuration**, pôr o endereço do app.
4. Copiar a **URL do projeto** e a **chave anon** (pública) para `config.js` (vale para o app, o site e o painel). A chave **service role** nunca vai para o app: fica só no servidor de pagamento.
5. A política de segurança já libera `https://*.supabase.co` no app, no site e no painel.
6. Trocar as funções de `social.js` pelas chamadas ao banco. As telas não mudam: o app só fala com a rede por essas funções. O mapa função → tabela está em `docs/SOCIAL.md`. A ordem sugerida:
   1. login e perfil;
   2. subir as partidas do aparelho (fila offline, id gerado no aparelho, sem duplicar);
   3. seguir, zap, marcações e notificações (a timeline Seguindo usa `feed_following(antes, quantas)`);
   4. grupos: `group_by_code`, `join_group_by_code`, `group_posts`, `group_ranking`;
   5. vídeo na nuvem (Pro).
7. **Placar ↔ câmera:** trocar o ntfy.sh por um canal do Supabase Realtime (`match:<id>`), sem tabela. Só muda o `relay.js`.
8. **Prazos:** agendar `select public.expire_open_requests();` uma vez por dia (Database → Cron). Ela fecha pedidos de exclusão e correções vencidos.
9. **Pagamento:** um webhook (Edge Function) do Mercado Pago ou do Stripe grava em `subscriptions` e `profiles.pro_until` com a service role.

## Para rodar os testes num Postgres local

```sh
createdb ultraplay_teste
psql -d ultraplay_teste -f supabase/tests/supabase-stub.sql
psql -d ultraplay_teste -f supabase/schema.sql
psql -d ultraplay_teste -f supabase/tests/regras.sql
psql -d ultraplay_teste -f supabase/tests/ao-vivo.sql   # jogando agora e análise do dia (numa base nova)
psql -d ultraplay_teste -f supabase/tests/formato.sql   # predefinições e apelido (numa base nova)
psql -d ultraplay_teste -f supabase/tests/partidas.sql  # regras da partida entre várias pessoas (numa base nova)
psql -d ultraplay_carga -f supabase/tests/carga.sql     # carga (numa base nova, depois do stub e do schema)
psql -d ultraplay_carga -f supabase/tests/sobrecarga/setup.sql
pgbench -n -c 50 -j 4 -T 30 -f supabase/tests/sobrecarga/read.sql@8 -f supabase/tests/sobrecarga/write.sql@2 ultraplay_carga
sh supabase/tests/corrida.sh ultraplay_corrida          # numa base vazia
```
