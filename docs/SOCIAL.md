# ULTRA PLAY · rede social (timeline, zaps, marcações)

Este documento descreve como a parte social funciona hoje no protótipo e o que o banco de dados precisa ter para ela ir ao ar de verdade.

## Como está hoje (protótipo)

- **Tudo roda no aparelho.** As pessoas e as partidas dos outros são fictícias, sempre iguais (semente fixa). Ficam em `social.js`, ligadas ao perfil de exemplo: a Rafa Duarte, os parceiros e os rivais dela.
- **O que você faz fica no `localStorage`**, na chave `canta.social.v1`: quem você segue, os zaps que deu, as respostas às marcações e até quando leu as notificações.
- **As suas partidas continuam no histórico do aparelho** (`canta.history.v1`). Cada partida ganhou o campo `post` (a publicação) e, quando foi lançada à mão, o campo `manual`.
- **O app só conversa com a rede pelas funções de `social.js`** (`feed`, `toggleZap`, `toggleFollow`, `respondTag`, `notifications`…). Para ligar o backend, essas funções passam a chamar a API, e as telas não mudam.
- **IDs:** cada pessoa tem um ID curto (`UP-XXXXXX`, no perfil, com botão de copiar) e cada partida tem um código (`P-XXXXXX`). Os dois usam letras e números sem 0/O/1/I, para não confundir ao digitar. O ID também serve para buscar a pessoa ao marcar.
- **Simulações:** zaps fictícios chegam aos poucos nas suas partidas, alguns minutos depois do fim. Pessoas fictícias que você marca "aceitam" um minuto depois. Os donos fictícios aceitam seu pedido de entrada um minuto depois. Se alguém do app tem o mesmo primeiro nome de um convidado da sua partida, ele "pede" para ser aquele jogador. Para testar, use os códigos da tela Entrar numa partida: partidas do Biel, da Nina e do Caio com convidados sem conta. Em Ajustes > Seu perfil > Rede de demonstração > **Recomeçar**, tudo volta ao começo.

## Telas

| Tela | O que faz |
| --- | --- |
| Início | Timeline com duas abas: **Seguindo** (você e quem você segue) e **Geral** (partidas públicas de quem joga na sua cidade). Mostra também a partida em andamento, as partidas a concluir e "Jogam perto de você". |
| Card de atividade | Quem jogou, quando, onde e o tipo (Amistoso, Treino, Resenha, Campeonato, Aula, Desafio). Depois vêm título, legenda, placar por time, números e o gráfico de momento (só nas partidas ao vivo). Por fim, o **zap** e quem deu zap. |
| Botão + | Escolhe entre **Marcar ao vivo** (placar por voz) e **Lançar partida** (esqueceu de marcar). |
| Lançar partida | Esporte, dia, hora e duração (opcional), seu lado e adversários (pessoa do app ou nome livre), resultado (vitória, derrota ou não informar), placar por set, só o final ou sem placar, tipo, título, legenda, local e quem pode ver. Nada além do esporte é obrigatório. |
| Salvar partida | Abre ao finalizar uma partida ao vivo. A partida fica salva como **rascunho**, só para você, até tocar em **Concluir e publicar**. Ali se define tipo, título, legenda, local, quem marcar e quem pode ver. A mesma tela edita a publicação depois. |
| Notificações | Marcações para **aceitar ou recusar**, zaps nas suas partidas, marcações confirmadas e novos seguidores. Ao aceitar, a partida entra no seu histórico e passa a contar no seu perfil e nas suas conquistas. |
| Atividade | A partida de outra pessoa: dados, pessoas marcadas (com o status de cada uma), zaps e, quando foi marcada ao vivo, a estatística completa. |
| Perfil de outra pessoa | Cidade, esportes, bio, contadores, botão **Seguir** e as partidas que você pode ver. |
| Entrar numa partida | Pelo **código** (`P-XXXXXX`) ou pelo **link** da partida. Quem jogou sem conta escolhe qual convidado era, cria a conta (nome e cidade) e pede ao dono. Quando ele aceita, as estatísticas daquele jogador passam a ser da pessoa, inclusive de partidas antigas. Também se chega pelo botão + > Entrar numa partida. |
| Convidar quem jogou | Na tela da sua partida: os convidados sem conta, os pedidos para **aceitar ou recusar**, o código e os botões **Copiar link** e **Enviar**. |
| Selo **manual** | Partidas lançadas depois do jogo levam um selo discreto (lápis + "manual") no card, no perfil e na imagem de compartilhar, para ninguém confundir com placar marcado ao vivo. |

## Modelo de dados

Sugestão para Postgres (por exemplo Supabase, que já traz login, regras por linha, tempo real e armazenamento de fotos).

```text
users            id, public_id (UP-XXXXXX, único), name, handle (único), city,
                 privacy_level ('aberto'|'personalizado'|'privado', padrão 'aberto'),
                 privacy_show jsonb { partidas, estatisticas, conquistas, recordes, confrontos, atividade, geral }, lat, lng, home_place_id, bio, avatar_url,
                 sports text[], created_at, deleted_at
follows          follower_id → users, followee_id → users, status ('ativo'|'pendente'), created_at   PK (follower_id, followee_id)
blocks           user_id, blocked_id, created_at                                PK (user_id, blocked_id)
reports          id, reporter_id, target_user_id | target_match_id, reason, created_at, status
places           id, name, city, lat, lng, created_by                           (arenas, clubes, quadras)
matches          id, code (P-XXXXXX, único, gerado no servidor), owner_id → users, sport, source ('live'|'manual'), cfg jsonb,
                 played_at, duration_ms, type, title, caption (≤140), visibility ('todos'|'seguidores'|'so-eu'),
                 status ('rascunho'|'publicada'), place_id, city,
                 result jsonb  { sets: [[a,b]...] | null, final: [a,b] | null, winner: 0|1|null },
                 summary jsonb { pts:[a,b], aces:[a,b], timeline:[...] } (só ao vivo),
                 replay jsonb  { bg, opacity, chart, score, plays, playsMode, names, stats, speed } | null
                               (visual do replay publicado no post; no aparelho: post.video),
                 created_at, updated_at, deleted_at
match_events     match_id, seq, event jsonb                                     (lances ponto a ponto, só ao vivo)
match_players    match_id, team (0|1), slot, user_id → users | null, guest_name | null,
                 tag_status ('pendente'|'aceito'|'recusado'|null), responded_at
match_claims     id, match_id, user_id (quem pede), guest_name (qual convidado diz ser),
                 status ('pendente'|'aceito'|'recusado'), created_at, responded_at
                 UNIQUE (match_id, guest_name) WHERE status = 'aceito'
zaps             match_id, user_id, created_at                                  PK (match_id, user_id)
notifications    id, user_id (quem recebe), kind ('tag'|'zap'|'accepted'|'follow'), actor_id,
                 match_id | null, created_at, read_at
```

Pontos importantes:

- **A partida é uma só, mesmo com várias pessoas.** Quem marcou é o dono. Os outros jogadores ficam em `match_players`. Ao aceitar, a pessoa passa a ver a partida no perfil dela, sem copiar a linha. No protótipo a partida aceita vira uma cópia no aparelho (`post.fromActivity`), porque não há servidor. A timeline já mostra uma só.
- **Convidado sem conta:** `guest_name` preenchido e `user_id` vazio. A pessoa entra pelo código ou link, diz qual convidado era e cria um `match_claims`. Quando o dono aceita, o servidor grava `match_players.user_id` naquele lugar. As estatísticas são calculadas dos lances (`match_events.player` = nome do convidado) e passam a contar para a conta. Não precisa copiar nada, e vale para quantas partidas antigas ela tiver.
- **Proteções do pedido:** só um pedido aceito por convidado; o dono pode desfazer (devolve o lugar a convidado); a pessoa não pode pedir um lugar numa partida em que já está; limite de pedidos por dia.
- **Zap:** uma linha por pessoa e partida. A contagem fica num campo calculado ou numa view. Não dá para dar zap na própria partida, e só existe zap (sem comentários), como você pediu.
- **Notificações:** são gravadas na hora da ação (marcação, zap, aceite, novo seguidor), para o celular poder receber push. Zaps na mesma partida são agrupados na leitura ("Lu e mais 3 deram zap").

## Regras de visibilidade (para as regras por linha do banco)

| Visibilidade | Quem vê |
| --- | --- |
| `todos` | Qualquer pessoa. Entra no **Geral** de quem está na mesma cidade ou perto. |
| `seguidores` | O dono e quem segue o dono. Não entra no Geral. |
| `so-eu` | Só o dono, no próprio perfil. |
| `rascunho` | Só o dono, independente da visibilidade. |

Jogadores marcados que aceitaram sempre veem a partida, mesmo que seja só para seguidores.

**Privacidade do perfil (por cima da visibilidade de cada partida):**

| Nível | Quem não segue vê | Seguir |
| --- | --- | --- |
| Aberto (padrão de toda conta nova) | Tudo o que é público | Direto |
| Personalizado | Só os itens marcados: partidas, números, conquistas, recordes, confrontos e parceiros, calendário; e se aparece no Geral | Direto |
| Privado | Só nome, foto e ID; fora do Geral; publicações novas saem como "Seguidores" | Pedido que a pessoa aprova (`follows.status = 'pendente'`) |

**Bloquear:** quem foi bloqueado não aparece na sua timeline, não vê seu perfil e não pode te marcar nem pedir para entrar nas suas partidas. Bloquear também desfaz o seguir nos dois sentidos.

**Geral (perto de você):** no protótipo é "mesma cidade". No banco, o ideal é pelo local da partida (`places.lat/lng`) num raio de, por exemplo, 30 km da cidade da pessoa, com fallback para a cidade escrita. Nunca mostre a localização exata da pessoa, só o nome da arena ou quadra.

## Funções do protótipo → endpoints

| `social.js` | API sugerida |
| --- | --- |
| `feed('seguindo' / 'geral')` | `GET /feed?tab=seguindo|geral&cursor=` (paginado por `played_at`) |
| `byUser(id)` | `GET /users/:id/matches` |
| `toggleFollow(id)` | `PUT` / `DELETE /users/:id/follow` |
| `toggleZap(id)` | `PUT` / `DELETE /matches/:id/zap` |
| `respondTag(id, resp)` | `POST /matches/:id/tag-response { resp }` |
| `notifications()` / `markRead()` | `GET /notifications`, `POST /notifications/read` |
| `findByCode(code)` | `GET /matches/by-code/:code` (só os dados públicos da partida e os nomes dos convidados) |
| `requestClaim(id, guest)` / `cancelClaim(id)` | `POST /matches/:id/claims { guest_name }`, `DELETE /claims/:id` |
| `incomingClaims()` / `respondClaim()` | `GET /me/claims/incoming`, `POST /claims/:id { status }` |
| `suggestions()` | `GET /users/suggestions` (mesma cidade, mais ativos, quem você ainda não segue) |
| salvar ou lançar partida | `POST /matches`, `PATCH /matches/:id` (com os lances, em lote, nas partidas ao vivo) |

## O que mais é necessário para ir ao ar

1. **Contas e login:** telefone (SMS ou WhatsApp), Google e Apple. Foto de perfil e @usuário único.
2. **Sincronização sem internet:** o placar funciona offline, e isso é um diferencial. As partidas precisam entrar numa fila e subir quando houver conexão, sem duplicar (id gerado no aparelho, como já é hoje).
3. **Confirmação do resultado:** na marcação, o adversário pode **aceitar** ou **contestar** o placar. Partidas não confirmadas podem ficar fora de conquistas e recordes, para ninguém inventar resultado.
4. **Convite por link (já desenhado):** o link `…/#entrar-P-XXXXXX` vira link universal do app (abre o app se instalado, a página se não). Quem entra por ele cai direto na escolha do jogador.
5. **Convite por link para marcação:** marcar alguém que não tem conta gera um link para WhatsApp. Quem entra pelo link já cai com a partida para aceitar. É o melhor caminho de crescimento.
6. **Notificações push:** Web Push (PWA) agora e, depois, push nativo se o app for para as lojas.
7. **Segurança e convivência:** bloquear pessoa, denunciar partida ou legenda, remover marcação de si mesmo, limite de zaps e de seguir por minuto (anti-robô) e um filtro simples de palavrões na legenda.
8. **Privacidade e LGPD:** perfil privado (só seguidores aprovados), escolher se o local aparece, exportar os próprios dados, excluir a conta e os dados de verdade, e termos de uso. Atenção especial a menores de idade.
9. **Performance:** timeline paginada (20 por vez) e a contagem de zaps e de seguidores guardada (não calculada a cada leitura).
10. **Painel interno:** ver denúncias, banir contas e cadastrar arenas, que podem virar parceiras depois.

## Decisões de produto já tomadas

- Sem nível nem ranking de usuários (08/10/2026).
- Toda conta nova começa com perfil **aberto**. A pessoa muda em Ajustes > Privacidade do perfil e pode ver a prévia "como os outros veem".
- Na tela de entrada, os números "ao vivo" (pessoas jogando agora, partidas e pontos de hoje, por esporte) são estimados pela hora do dia até existir o dado real. No banco, saem de partidas abertas nos últimos 15 minutos.
- A única interação nas partidas é o **zap** (o ícone de raio da marca), sem comentários por enquanto.
- Conquistas usam só as partidas da própria pessoa: as dela, as marcações que ela aceitou e os convidados que ela reivindicou.
- Partidas lançadas à mão sempre mostram o selo **manual**.
- **Link das estatísticas (enquanto não há servidor):** o link `…/#ver-<dados>` leva a partida inteira dentro dele (times, regras e lances, sem o texto falado), comprimida com deflate e em base64url: uma partida de 150 pontos dá uns 2 mil caracteres. Quem abre vê o resumo completo e pode salvar nas partidas dele escolhendo qual jogador era (os lances desse jogador passam para o nome dele, como na reivindicação). Quando houver servidor, o mesmo botão passa a mandar `…/p/P-XXXXXX`, e o link antigo continua abrindo.
- **Replay animado (vídeo da partida):** é desenhado no aparelho a partir dos lances (`match_events`), então o servidor não guarda vídeo, só o visual escolhido (`matches.replay`). Assistir é livre; gerar o arquivo (MP4/WebM ou GIF) é do Pro. A foto ou o vídeo de fundo não sobem: ficam só no aparelho, no momento de gerar. Se um dia o post precisar de vídeo pronto (para abrir fora do app), gerar no servidor com o mesmo `motion.js` num navegador headless e guardar no armazenamento de arquivos.
