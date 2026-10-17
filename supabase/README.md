# ULTRA PLAY · servidor (Supabase)

O app hoje funciona sem servidor: tudo fica no aparelho. Este diretório tem o banco pronto para quando entrar a **conta na nuvem**, com o mesmo modelo que o app já usa no aparelho (ver `docs/SOCIAL.md`).

| Arquivo | O que é |
|---|---|
| `schema.sql` | Tabelas, índices, gatilhos e regras por linha (RLS): pessoas, seguir, bloquear, lugares e quadras, temporadas da arena, **grupos** (membros, papéis, foto, resenha), partidas, lances, jogadores marcados, pedidos de convidado, zaps, notificações, vídeos (Pro), assinatura, denúncias e as **regras da partida entre várias pessoas** (quem pode marcar, placar travado, excluir para mim, pedido de exclusão para todos, correção de placar, prazos de 14 dias, conta apagada). |
| `storage.sql` | Pastas de arquivos: fotos de perfil (públicas), **fotos da partida** (privadas, seguem quem vê a partida) e vídeos (privados, Pro). |
| `tests/regras.sql` | 28 verificações das regras, rodadas num Postgres 16 local em 13/10/2026: todas passaram. |
| `tests/partidas.sql` | 80 verificações das regras da partida entre várias pessoas (ver `docs/REGRAS-PARTIDAS.md`): quem pode marcar, grupo, flood, placar travado, excluir para mim, exclusão para todos, correção de placar, prazos, conta apagada, bloqueio, denúncias, foto do grupo, foto só do próprio armazenamento e vídeo na nuvem só para Pro. Todas passando em 14/10/2026. |
| `tests/carga.sql` | Teste de carga: 5.000 pessoas, 200 mil "seguir", 100 mil partidas e 400 mil marcações; mede as telas e ações mais usadas (resultado abaixo). |
| `tests/sobrecarga/` | Scripts do `pgbench` para 50 pessoas usando ao mesmo tempo (80% leitura, 20% lançar e marcar). |
| `tests/corrida.sh` | Dois votos no mesmo segundo no pedido de exclusão: os dois têm que contar. |
| `admin.sql` | Estatísticas de uso e painel de admin (ver abaixo). |
| `tests/admin-seguranca.sql` | 32 verificações do acesso ao painel: papéis, código recente para ações sensíveis, e-mail mascarado, acessos com aparelho novo, limite de cortesias, admin suspenso e registro que não se apaga. |
| `tests/admin-links.sql` | 19 verificações dos links e taxas: período de/até, 1ª origem de cada aparelho, contas, partidas e Pro por link, só moderador cria link, código e campanha validados, churn, teste → pago, ativação e retenção. |
| `tests/admin.sql` | 21 verificações do painel: sem consentimento só entra visita, anônimo não lê eventos, quem não é admin não lê nem age; busca, cortesia, denúncias (tirar do ar) e registro de ações. |
| `tests/fotos.sql` | 30 verificações das fotos da partida e da privacidade do post (17/10/2026): até 6 fotos só com id/largura/altura, "não mostrar na timeline" fora do Seguindo mas no perfil, ponto a ponto só para quem jogou quando há bloco escondido, linha do jogo sai do resumo, bucket `photos` (pasta do dono, partida do dono, nome no padrão, 12 arquivos por partida, 120 por dia, quem vê a partida vê as fotos, ninguém apaga as dos outros). |
| `tests/arquivos.sql` | Regras de arquivos (com `tests/storage-stub.sql`): foto só na própria pasta, vídeo na nuvem só para Pro, quem deixou de ser Pro ainda vê e apaga o que subiu. |
| `tests/ataques.sql` | Pentest do banco (15/10/2026): 250 verificações de fraude no Pro e no Amigos, abuso do grátis, virar admin, ler ou mexer no que é dos outros, duplo clique e corrida entre sessões, entrada absurda, arquivos e higiene de permissões. Todas passando (antes da correção, 73 passavam). Ver `reports/QA e segurança 2026-10-15.md`. |
| `tests/rodar.sh` | Roda todas as suítes, cada uma numa base nova: `sh supabase/tests/rodar.sh`. |
| `tests/supabase-stub.sql` | Simula o que o Supabase já traz (`auth.users`, `auth.uid()`), para rodar os testes fora dele. |

## O que as regras garantem (testado)

- **Grupo fechado:** quem pede entra como pendente e o organizador recebe o pedido. Ninguém entra como organizador por conta própria. Quem tem o **link de convite** entra direto. Quem é de fora não vê o grupo.
- **Autorização ao organizador:** só a própria pessoa autoriza, por no máximo 24 horas, e pode cancelar quando quiser. A partida que o organizador ou um moderador lança com quem autorizou já entra **aceita**, com a notificação "lançada por você com autorização". Quem não autorizou recebe a marcação normal para aceitar.
- **Partidas:** a visibilidade (todos, seguidores, só eu, rascunho) vale junto com a privacidade do perfil. Perfil privado: só seguidor aprovado vê. Membros do grupo veem as partidas do grupo. Quem foi marcado e aceitou sempre vê.
- **Bloqueio:** some o perfil, as partidas, o seguir e o zap nos dois sentidos.
- **Ninguém se dá Pro**, troca de time numa partida, cria notificação falsa ou dá zap em nome de outra pessoa. O campo do Pro só muda pelo servidor de pagamento.
- **Ranking do grupo** (`group_ranking`): só membros, só partidas aceitas, com período.
- **Quem lança joga:** fora da partida de grupo, o dono está sempre entre os jogadores. A conferência fica para o fim da transação.
- **Placar, datas e tamanhos válidos:** placar de 0 a 999 com vencedor 0 ou 1, data entre 2000 e amanhã, e limite de tamanho em todo texto e JSON. Nomes sem caracteres de controle nem invisíveis.
- **Colunas do servidor:** código P-/G-, selo "placar corrigido", datas de criação e de exclusão. Data de nascimento e consentimento do responsável não saem para ninguém além da própria pessoa.

**O que o app precisa usar ao ligar a nuvem (mudou em 15/10/2026):**
- lançar partida por `save_match(partida, jogadores)`: grava tudo numa transação e não duplica se a fila offline mandar de novo. Um insert só da partida, sem os jogadores, é recusado;
- ler `profiles` com as colunas listadas (`select=*` é recusado); a própria data de nascimento sai por `my_private_profile()`;
- tirar post e grupo do ar por `remove_group_post(id)` e `remove_group(id)`;
- não mandar `code`, `created_at`, `corrected_at`, `deleted_at` nem `owner_left_at` no insert;
- mandar no post as colunas novas de 17/10/2026: `photos`, `in_feed`, `hide_moment`, `hide_shots`, `hide_players`;
- evento de telemetria com algo parecido com e-mail é recusado, e o lote inteiro falha.

## Painel de admin (`admin/`)

Endereço: **https://filipeultra.github.io/canta-placar/admin/**. Não é linkado no app e o Google não indexa.
- **Sem servidor:** mostra **dados de demonstração** (fictícios), para ver o painel funcionando. Com o servidor ligado, `?demo=1` no endereço volta à demonstração.
- **Com servidor:** entra com o e-mail de uma conta admin (link mágico do Supabase). Só lê os números quem estiver na tabela `admins`; para os outros, a função `admin_metrics` recusa.
- **Seções** (menu ao lado no computador, faixa no topo no celular; período de 7, 30 ou 90 dias, 6 meses, 1 ano ou **datas de/até**, sempre comparando com o período anterior do mesmo tamanho):
  - **Visão geral:** quem está usando agora (últimos 15 min), ativos no dia/semana/mês, 8 indicadores com mini gráfico, visitas e ativos por dia, **próxima meta** (membros ativos, pagantes e receita, pelas metas de `docs/METAS.md`) e **“O que olhar agora”** (denúncias, aparelho novo no painel, alta de erros, marcações recusadas, variação das visitas, maior perda do funil, retenção, versões antigas, custo da IA).
  - **Crescimento:** contas, novas contas, conversão visita → conta, instalações, convites, contas excluídas, funil, origem (utm, convite `?ref=`, direto), **cidades** e retenção por semana.
  - **Uso do app:** ativos (DAU/WAU/MAU) e frequência, partidas, % de pontos por voz, % que usa o app instalado, gravações, compartilhamentos, sugestões, partidas por esporte, **mapa de calor de quando se joga** (dia × hora), versões do app em uso, **saúde do app** (erros por arquivo e linha, aparelhos afetados) e **comunidade** (marcações aceitas e recusadas, bloqueios, pedidos de exclusão e correção abertos, placares corrigidos).
  - **Links e tráfego:** cria **links rastreáveis** (nome, destino no app ou numa página do site, origem, meio e campanha; o painel limpa os campos e monta o `utm_*`), copia o link, gera **QR Code** (baixa em SVG para cartaz e camiseta) e arquiva sem perder os números. Mostra visitas por dia (com origem marcada × direto), e por link, origem e campanha: visitas, contas, 1ª partida, Pro e conversão. Conta a **1ª origem** de cada aparelho por 30 dias, então quem viu o cartaz e criou a conta dias depois ainda conta para o cartaz.
  - **Site e app** (16/10/2026), com uma aba para o site e outra para o app:
    - quem está agora (últimos 5 minutos) e em que página ou tela;
    - visitantes, visitas, páginas vistas, tempo médio, rejeição, rolagem média e quanto das visitas tem estatísticas ligadas;
    - **de onde vêm**: canal (redes sociais, busca, direto, campanha, convite, anúncio, e-mail, outros sites), os sites que mandaram gente e as campanhas, cada um com tempo e rejeição;
    - **páginas** (site) ou **telas** (app): vistas, tempo médio e rolagem; no site, também entradas, saídas e rejeição;
    - **caminhos no app** (de que tela para qual);
    - **público**: aparelho, navegador, sistema, idioma, largura da tela e **região** (pelo fuso do aparelho, sem localização);
    - **quando visitam** (dia × hora);
    - **mapa de calor**: a página de verdade num quadro, com os cliques por cima, no celular, tablet ou computador. Mostra também a **rolagem** (até onde as pessoas chegaram, com o fim da 1ª tela), os elementos mais clicados (passar o mouse destaca na página), os cliques **com raiva** (3 ou mais seguidos no mesmo lugar) e os **mortos** (onde não há botão).
  - **Receita:** MRR, ARR, assinantes pagando e de cortesia, ticket médio, novas assinaturas, cancelamentos, churn mensal, valor por assinante (LTV), custo da IA no mês, em teste grátis, **receita mensal dia a dia**, planos e um simulador de projeção.
  - **Taxas:** churn de assinantes e de receita, receita nova e perdida, teste grátis → pago, ativação (1ª partida em 7 dias), retenção no dia 1, 7 e 30, frequência (DAU/MAU), conversão visita → conta → Pro e LTV, cada uma com a referência de mercado e a cor de bom, atenção ou ruim.
  - **Contas:** busca por nome, @, código UP-… ou e-mail (e-mail **mascarado**; o dono pode mostrar inteiro), e **Pro de cortesia** (7, 30, 90 dias ou 1 ano; ou tirar).
  - **Segurança:** seu papel, há quanto tempo digitou o código, acesso anterior, **acessos ao painel** (quando, quem, IP e aparelho, com aparelho novo em destaque), **equipe** (só o dono) e a lista do que protege o painel.
  - **Grupos:** os mais movimentados (membros, pedidos, partidas, posts).
  - **Moderação:** fila de denúncias (abertas, resolvidas, descartadas) com **Em análise, Resolvida, Tirar do ar e Descartar**, e o **registro de ações** de todos os admins.
  - **IA:** análises, quem usou, custo, custo por análise, projeção e tokens. **Eventos:** o que o app registra.
  - Tema claro/escuro, atualização automática a cada minuto, **Ocultar dados** (borra nomes, e-mails e IPs para compartilhar a tela) e **CSV** de cada tabela (baixar fica no registro).
- **De onde vêm os números:** `admin.sql` (tabelas `app_events`, `admins`, `plan_prices`, `admin_log`, `tracked_links`, `web_sessions`, `web_daily`, `heat_clicks` e as funções `admin_metrics`, `admin_users`, `admin_grant_pro`, `admin_reports`, `admin_handle_report`, `admin_groups`, `admin_links`, `admin_link_save`, `admin_web`, `admin_heatmap` e `admin_web_rollup`). Testado em `tests/admin.sql` (23 verificações), `tests/admin-seguranca.sql` (32), `tests/admin-links.sql` (19) e `tests/admin-web.sql` (55).
  - O app e o site mandam eventos por `telemetry.js`, mas só quando `config.js` estiver preenchido.
  - **Sem consentimento:** a visita (página vista ou abertura do app) e, ao sair, quanto tempo ficou e quanto rolou, com um id que some ao fechar a aba. Vão junto o tipo de aparelho, o navegador, o sistema, o idioma, o fuso, a largura da tela e o domínio do site que mandou a pessoa (nunca o endereço inteiro).
  - **Com consentimento:** no app, ele é pedido uma vez depois da 1ª partida e fica em Ajustes → Estatísticas de uso; no site, num aviso no rodapé que só aparece com o servidor ligado. Aí entram os eventos de uso, as telas do app e os **cliques do mapa de calor** (posição e elemento, nunca o texto), com um id sorteado do aparelho.
  - Nenhum nome, e-mail ou partida vai nos eventos. Dentro do quadro do mapa de calor, o site e o app não contam nada.
- **Para o painel não ficar lento** (medido em 16/10/2026 com 2,4 milhões de eventos, 660 mil visitas e 600 mil cliques; Postgres 16, 4 CPUs):
  - cada visita vira uma linha em `web_sessions` quando chega (gatilho); o banco copia de `props` para colunas próprias o que o painel lê, e índices cobrem essas colunas;
  - os dias fechados ficam somados em `web_daily` (`web_rollup()`): o painel soma linhas prontas e só calcula na hora ontem e hoje. O teste confirma que o resumo e o cálculo na hora dão os mesmos números;
  - as funções do painel têm memória de trabalho maior (`work_mem` de 64 MB, só nelas), e o painel guarda cada resposta por 45 s e só carrega o mapa de calor quando ele aparece na tela.

  | Chamada | Antes | Depois |
  |---|---|---|
  | Visão geral, 30 dias | 9,1 s | 1,5 s |
  | Visão geral, 1 ano | 5 min 37 s | 5,3 s |
  | Site, 30 dias / 1 ano | 4,4 s / 38 s | 0,5 s / 0,7 s |
  | App, 30 dias / 1 ano | 1,9 s / 17 s | 0,1 s / 0,3 s |
  | Mapa de calor, 30 dias | 0,44 s | 0,19 s |
  | Links, 30 dias | 0,78 s | 0,64 s |

  Gravar um evento ficou 0,05 a 0,27 ms mais caro por causa dos gatilhos. No navegador, o painel abre em 0,35 s e troca de seção em 20 a 80 ms.
- **Agendar no Supabase (Database → Cron):** `select public.web_rollup();` de hora em hora (se não agendar, o painel faz ao abrir Site e app; só demora na 1ª vez) e `select public.prune_heat_clicks();` uma vez por dia (os cliques ficam 90 dias).
- **Segurança do painel (testada em `tests/admin.sql`, seção "invasão", 21 tentativas bloqueadas):**
  - **Duas etapas para entrar:** link no e-mail + código de 6 números de um app autenticador (Google Authenticator, Authy, 1Password). O banco só reconhece admin com a sessão na 2ª etapa (`aal2` no token); quem rouba só o link do e-mail não entra. Na 1ª vez, o painel mostra o QR Code para cadastrar.
  - **Ninguém se torna admin pelo app ou pela API:** a tabela `admins` não aceita gravação de ninguém (só pelo SQL Editor do Supabase, com a sua conta de dono do projeto). Também não dá para se dar Pro, criar assinatura, mudar preço, mexer em denúncia ou no registro de ações.
  - **Não dá para descobrir quem é admin:** `is_admin()` só responde sobre a própria sessão.
  - **Permissões fechadas por tabela:** o Supabase libera toda tabela nova para todo mundo; `admin.sql` tira tudo e devolve só o necessário. Os testes simulam essa liberação padrão para pegar qualquer esquecimento.
  - **Papéis** (`admins.role`): **dono** faz tudo; **moderador** cuida de denúncias e contas, com e-mail mascarado e sem dar Pro; **leitor** só vê os números. `admins.disabled_at` suspende alguém na hora, sem apagar o histórico.
  - **Código recente para ações sensíveis:** dar ou tirar Pro, tirar do ar, ver e-mails inteiros e baixar a planilha de contas pedem que o código do autenticador tenha sido digitado nas últimas **8 horas** (o banco lê a hora em `amr` no token). Se passou, o painel pede o código de novo e repete a ação.
  - **Limites por admin:** 30 cortesias e 300 respostas a denúncias por dia. Uma conta roubada não distribui Pro nem apaga a moderação à vontade.
  - **Registro que não se apaga:** `admin_log` recusa alteração e exclusão, inclusive de quem tem acesso ao banco. A única exceção é a conta de admin apagada, quando só o vínculo some.
  - **Acessos registrados:** cada entrada guarda aparelho e IP (`admin_hello`), uma vez a cada 30 minutos por aparelho, e marca aparelho novo.
  - **Sair de verdade:** "Sair" invalida a sessão no servidor. Parado por 15 minutos, o painel sai sozinho, com aviso 1 minuto antes. A sessão fica só na aba e some ao fechar.
  - **Não abre dentro de outro site:** dentro de um iframe, a página fica em branco (o GitHub Pages não deixa mandar o cabeçalho `frame-ancestors`).
  - **No Supabase (você):** Authentication → URL Configuration: pôr `https://filipeultra.github.io/canta-placar/admin/` nas URLs de redirecionamento; Authentication → Multi-Factor: deixar TOTP ligado (já vem ligado). Nunca coloque a chave `service_role` no `config.js` nem no site: só a `anon`.
  - **Limite conhecido:** qualquer um pode mandar eventos de visita (é assim que o site conta visitas sem login). Isso não dá acesso a nada, mas alguém mal-intencionado pode inflar os números de visitas; o Supabase limita a taxa de pedidos por IP e o painel mostra a origem para identificar.
- **Primeiro admin:** depois de criar sua conta no app, rode no SQL Editor: `insert into admins (user_id) select id from auth.users where email = 'seu@email.com';` (entra como dono).
- **Mais gente na equipe:**
  - incluir: `insert into admins (user_id, role) select id, 'moderador' from auth.users where email = 'pessoa@email.com';` (ou `'leitor'`);
  - trocar o papel: `update admins set role = 'leitor' where user_id = (select id from auth.users where email = 'pessoa@email.com');`;
  - suspender: `update admins set disabled_at = now() where user_id = (select id from auth.users where email = 'pessoa@email.com');` (para devolver, `disabled_at = null`).

## Fotos da partida e privacidade do post (17/10/2026)
Testes em `tests/fotos.sql` (30 verificações). O app já guarda as fotos no aparelho (`fotos.js`); com a conta na nuvem, sobe para o bucket `photos`.
- **Leve por desenho:** o app reduz cada foto antes de sair do aparelho: WebP 1280 px no lado maior (~100 a 180 KB, tela cheia) e 800 px (~35 a 60 KB, timeline e perfil). Uma foto de celular de 3 a 5 MB vira ~200 KB no total. Redesenhar no canvas tira os metadados da câmera, inclusive o GPS.
- **Limites no servidor:** bucket privado de até 512 KB por arquivo, só WebP e JPEG; caminho `<dono>/<partida>/<id>-sm|lg.webp`, só na própria pasta e na própria partida; até 12 arquivos (6 fotos) por partida e 120 por dia por pessoa (`photo_room`).
- **Quem vê:** quem vê a partida (`can_see_match`): link assinado ou download com a sessão. Como os nomes nunca se repetem, subir com `cacheControl: '31536000'` e o aparelho não baixa de novo.
- **Na partida:** `matches.photos` guarda só a lista `[{ id, w, h }]` (a 1ª é a de destaque); a timeline lê o tamanho 800 px.
- **Apagar:** ao tirar uma foto ou excluir a partida, o app apaga os dois arquivos pelo Storage (`remove`). Uma limpeza do servidor (função agendada) pode varrer o que sobrar de partida excluída.
- **"Não mostrar na timeline"** (`matches.in_feed = false`): fica fora do Seguindo (`feed_following`) e do Geral (consultar com `in_feed=eq.true`; o índice `matches_feed` já filtra), mas continua no perfil para quem pode ver a partida.
- **Blocos escondidos de quem não jogou** (`hide_moment`, `hide_shots`, `hide_players`): com qualquer um ligado, o ponto a ponto (`match_events`) só sai para quem jogou (`played_match`: o dono ou quem aceitou a marcação). Os outros veem o placar e o resumo (`summary`); com `hide_moment`, a linha do jogo sai do resumo sozinha (gatilho `matches_zhide`), mesmo numa partida com placar travado.
- **Análise do jogo:** só aparece para quem jogou (o app esconde; ela é feita do ponto a ponto).
- **Custo estimado:** 1.000 pessoas ativas × 12 partidas/mês × 1,5 foto × ~200 KB ≈ 3,6 GB a mais por mês no Storage. A timeline baixa só a versão de ~50 KB, e uma vez por aparelho (cache). Cabe no Supabase Pro (100 GB de arquivos e 250 GB de tráfego por mês incluídos).

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

## Carga e sobrecarga (13/10/2026, refeita em 15/10/2026, Postgres 16, 4 CPUs)

Com 100 mil partidas na base, cada tela ou ação, medida como a pessoa logada (com as regras por linha ligadas):

| Tela ou ação | Tempo |
|---|---|
| Timeline Geral (30 mais recentes) | 5 ms |
| Timeline Seguindo por `feed_following()` | 5 ms (pela regra de linha: 39 ms) |
| Estatísticas, confronto, contadores do perfil, notificações, ranking do grupo | 0,5 a 2 ms |
| Lançar partida, marcar 3 pessoas, excluir para mim, pedir exclusão, pedir correção | 1 a 5 ms |
| Apagar conta com centenas de partidas | 18 ms |

**50 pessoas ao mesmo tempo** (`pgbench`, 30 s): 513 operações por segundo, nenhuma falha. A leitura (4 consultas) leva 111 ms em média e lançar e marcar leva 44 ms. Antes da `feed_following()`, eram 104 por segundo, com leitura de 583 ms.

**Depois do pentest (15/10/2026)**, com as regras novas: 620 operações por segundo em 20 s, nenhuma falha, leitura em 86 ms e lançar e marcar em 59 ms. É mais rápido que antes, porque `feed_following` e `can_see_match` passaram a ler bloqueio, grupo e seguir direto. Lançar pelo `save_match` leva 3 a 4 ms.

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
2. No **SQL Editor**, colar e rodar **`instalar.sql`** inteiro (é `schema.sql` + `storage.sql` + `admin.sql` num arquivo só, montado por `sh supabase/montar.sh`). Depois rodar **`agendar.sql`**: liga o `pg_cron` e agenda os prazos, o resumo do painel e a limpeza dos cliques.
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
9. **Pagamento:** um webhook (Edge Function) do Mercado Pago ou do Stripe grava em `subscriptions` com a service role. Antes de gravar, ele confere a assinatura do aviso (no Mercado Pago, o HMAC-SHA256 do cabeçalho `x-signature` com a chave secreta, recusando `ts` antigo) e grava uma vez só por id de pagamento. Quem decide se a pessoa é Pro é sempre `has_pro()`, nunca o aparelho.

## Para rodar os testes num Postgres local

Tudo de uma vez, cada suíte numa base nova:

```sh
sh supabase/tests/rodar.sh
```

Ou uma a uma:

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
