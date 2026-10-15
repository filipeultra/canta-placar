# QA e segurança do ULTRA PLAY · 15/10/2026

Revisão geral do app, do site, do painel de admin, do banco (Supabase) e da função de IA. Ela juntou quatro frentes: pesquisa de pentest e segurança de SaaS, ataques ao banco, revisão do código do app e testes no navegador como uma pessoa usaria, incluindo duplo clique, sobrecarga e entrada maliciosa.

## TL;DR

- **O bug que você viu existia e foi corrigido.** Pelo "Explorar sem conta", dava para lançar e publicar uma partida só de outras pessoas, sem grupo e sem você jogando, marcando perfis reais. Agora o app pede o seu nome antes de começar e põe você no 1º time. O banco também recusa partida sem o dono, a não ser que seja de grupo. Dois caminhos parecidos também foram fechados: "Só assisti" no link de uma partida publicava no feed, e a revanche perdia o grupo.
- **Não dá para virar Pro nem abusar do grátis pelo banco.** Foram 43 tentativas: dar Pro a si mesmo, criar assinatura ou recibo, um 2º teste grátis, entrar sozinho no Amigos, furar as 5 vagas com cliques simultâneos, zerar a cota da IA, gravar vídeo sem Pro e mais. Quatro passavam antes desta rodada:
  - a corrida do Amigos chegava a 6 vagas;
  - a das predefinições do grátis chegava a 2;
  - quem saía do Amigos e era convidado de novo herdava a vaga antiga;
  - um trecho de vídeo podia apontar para a pasta de outra pessoa.

  As quatro foram corrigidas, e todas as 43 tentativas agora são barradas.
- **O admin está fechado.** Quem não é admin não chama nenhuma função do painel, mesmo com a 2ª etapa (aal2) no token. Admin sem aal2 também não entra. Ninguém se coloca na tabela de admins.
- **O banco tinha 35 furos e agora tem 0.** São 250 verificações de ataque: 73 passavam antes da correção e nenhuma passa agora. Os furos mais sérios:
  - partida de terceiros;
  - partida levada para um grupo fechado alheio;
  - data de nascimento de menores visível para outras pessoas;
  - moderadora reescrevendo post alheio;
  - grupo e post tirados do ar voltando com um `update`;
  - seguidor forjado;
  - funções que revelavam bloqueios e perfis privados;
  - caminhos `../` nos arquivos;
  - dados gigantes ou absurdos (partida em 2099, placar negativo, resumo de 3 MB);
  - avisos repetidos com duplo clique.
- **O app passa em 93 de 93 testes no navegador.** Isso inclui partidas completas nos 4 esportes, cliques triplos em salvar e publicar, 600 toques aleatórios, offline, telas de 320 px, armazenamento corrompido, links adulterados, XSS em nomes, 300 partidas no aparelho (abre em 0,56 s) e acessibilidade (axe).
- **No app também foram corrigidos:**
  - link que travava o celular (bomba de descompressão);
  - injeção de fórmula no CSV do admin;
  - página aberta dentro de iframe alheio;
  - modelo de voz sem conferência de integridade;
  - eventos sem consentimento;
  - códigos de convite previsíveis;
  - cor maliciosa no perfil.
- **A função de IA ficou à prova de abuso.** A cota agora reserva a vaga antes de chamar a IA, então 10 cliques ao mesmo tempo não furam o limite. Há também um limite de 3 por minuto. A função só aceita o formato do app, o CORS fica preso ao endereço do app, e a resposta recusada ou cortada é tratada.
- **O que ainda depende de você antes de ligar a nuvem:**
  1. **domínio próprio** (o github.io é dividido com seus outros projetos);
  2. **Pro, teste grátis e pagamento só pelo servidor**, com o webhook do Mercado Pago conferindo a assinatura HMAC;
  3. **criptografar o relay ntfy** do placar ao vivo;
  4. **fixar o endereço do Supabase no CSP**;
  5. **plano de incidente da LGPD** (avisar a ANPD em 3 dias úteis).

  Também ficou para limpar: o backup com o seu nome saiu da pasta `dl/`, mas continua no histórico do git.

Veredito: **pronto para lançar no modo local (como está hoje) e pronto no banco para ligar a nuvem**, desde que o domínio próprio, o Pro decidido só pelo servidor (com o webhook conferido) e o CSP fixado no Supabase fiquem prontos antes de abrir contas de verdade.

---

## 1. O bug da partida de terceiros

**Existia.** Reproduzido num perfil limpo:
1. Tela de boas-vindas → "Explorar sem conta".
2. Nova partida de beach tennis, sem grupo.
3. Escolher 4 perfis da rede (Duda, Nina…) e começar.
4. Terminar e publicar.

A partida saiu **publicada para todos, sem grupo, sem você entre os jogadores e marcando perfis reais**. A causa: sem nome salvo, o app não colocava "você" no 1º time, e a regra "você joga sempre" só valia para quem já tinha nome.

**Correção no app (`app.js`, `index.html`):**
- Sem nome salvo, a Nova partida mostra "Seu nome nos pontos" e não começa sem nome e sobrenome. Com o nome, você entra no 1º time com cadeado, como em qualquer conta.
- Ao começar, o app confere de novo que você está no 1º time, fora da partida de grupo com "Estou jogando" desligado.
- Teste depois da correção: começar sem nome dá a mensagem "Diga seu nome e sobrenome…" e 0 partidas. Com o nome, a partida começa com `["me","duda"]` no 1º time.

**Correção no banco (`schema.sql`):** regra 8, "quem lança joga". Fora da partida de grupo, o dono precisa estar entre os jogadores. A conferência fica para o fim da transação, e o app grava partida e jogadores juntos com a nova função `save_match`. Mandar a mesma partida duas vezes não duplica nada, o que cobre a fila offline e o duplo clique. Testes 149 a 161 em `tests/ataques.sql`:
- terceiros sem a dona: recusado;
- `save_match` de terceiros: recusado;
- a dona tirando a própria linha: recusado;
- organizador lançando partida do grupo sem jogar: permitido;
- tirar do grupo uma partida em que o dono não joga: recusado.

**Dois caminhos parecidos, também corrigidos:**
- **"Só assisti"** ao abrir o link de uma partida salvava a partida como publicada no feed. Agora ela fica "só eu", marcada como assistida, e não marca ninguém.
- **Revanche** de uma partida de grupo virava partida sem grupo. Para quem não joga, isso era uma partida de terceiros. Agora a revanche continua no grupo.

## 2. Pro e grátis: dá para burlar?

**No banco, não.** Cada linha abaixo é uma tentativa feita como usuário comum, direto pela API (o que um app modificado faria):

| Tentativa | Resultado |
|---|---|
| Dar Pro a si mesmo (`pro_until`), inclusive escondido junto com uma troca de nome | barrado (permissão) |
| Criar assinatura, reativar a encerrada, apagá-la para ganhar novo teste grátis | barrado |
| Criar recibo de pagamento "pago" | barrado |
| 2º teste grátis criando assinatura "trial" | barrado |
| Chamar a cortesia do admin, mesmo com aal2 no token | barrado |
| Entrar sozinha no Amigos de outra pessoa; aceitar no lugar da convidada; trocar o dono do convite; estar em dois Amigos | barrado |
| **Duas sessões convidando a 5ª e a 6ª pessoa no mesmo segundo** | **passava (6 vagas)**; agora no máximo 5 |
| Sair e ser convidada de novo para herdar a data antiga | **passava**; agora volta como pendente |
| Dono cancela, atrasa ou estorna | a convidada perde o Pro na hora |
| Gravar vídeo depois que o Pro venceu; subir arquivo de vídeo | barrado |
| Apontar trecho de vídeo para a pasta de outra pessoa | **passava**; agora barrado |
| Forjar, apagar ou "envelhecer" o uso da IA para zerar a cota | barrado |
| **Duas predefinições de formato no mesmo segundo (grátis tem 1 por esporte)** | **passava (2)**; agora 1 |
| Cupom ou indicação com recompensa para abusar | não existe no banco (o `?ref=` só conta a origem) |

**No app (aparelho), sim, e isso é esperado hoje.** O Pro e o teste grátis do modo local ficam no próprio celular. Quem abre o console consegue se dar Pro, e não há como impedir isso no aparelho. Não há perda real porque o app ainda não cobra nem tem nuvem. **Ao ligar a nuvem:**
- quem decide se a pessoa é Pro é o banco (`has_pro`), nunca o aparelho;
- o pagamento só vale quando o webhook do Mercado Pago chega com a assinatura `x-signature` conferida (HMAC-SHA256 sobre `id`, `request-id` e `ts`, rejeitando `ts` velho) e é gravado uma vez só pelo id do pagamento;
- o teste grátis fica preso à conta (`trial_used_at`, que só o servidor grava). Para dificultar o abuso por contas novas, como recomenda o guia da Stripe, vale também pedir cartão ou Pix no início, ou limitar por aparelho ou telefone confirmado.

A demonstração de pagamento continua sem coletar dados de cartão.

## 3. Admin

- Todas as funções do painel recusam quem não está em `admins`, e também o admin sem a 2ª etapa (aal2) ou com o código digitado há mais tempo que o permitido.
- Ninguém se insere em `admins`. A cortesia de Pro só sai pelo admin, com registro.
- **Moderação**: a moderadora conseguia **reescrever o texto e o autor** de um post alheio. Um `update` sem `where` também **devolvia ao ar** grupos e posts tirados do ar pela equipe. Agora ninguém edita post pela API: tirar do ar é só pela função `remove_group_post` (e o grupo, por `remove_group`), e o que foi tirado do ar não volta. Junto apareceu um bug antigo: apagar post ou grupo pela API sempre falhava, porque a linha apagada sumia da regra de leitura. As duas funções resolvem isso.
- **CSV do painel**: um nome começando com `=`, `+`, `-` ou `@` virava fórmula ao abrir no Excel ou Sheets. Agora todo campo vai entre aspas, e esses começam com `'`.
- Os tokens do painel ficam no `sessionStorage`: somem ao fechar a aba, mas um XSS no painel os leria. O painel não monta HTML com dado do usuário sem escapar, e o CSP bloqueia script de fora. Fica como risco baixo, anotado.

## 4. Dados dos outros (privacidade)

Tentativas de ler, mudar ou agir em nome de outra pessoa. As que passavam antes desta rodada:
- **Data de nascimento e consentimento do responsável** (dado de menor) eram lidos por qualquer pessoa, até anônima. Agora só a própria pessoa lê, pela função `my_private_profile()`.
- **Funções auxiliares** (`follows_active`, `is_blocked_between`, `group_role`, `can_see_match`) podiam ser chamadas pela API para perguntar "fulano bloqueou beltrano?", "fulano segue o perfil privado?" ou "fulano é do grupo fechado?". Agora só respondem sobre a própria sessão.
- **Seguidor forjado**: quem era seguido podia trocar o `follower_id`. Agora só aprova.
- **Partida levada para um grupo fechado alheio**: agora só entra num grupo de que o dono é membro ativo.
- **Pedido de convidado**: dava para pedir numa partida que não se vê, com nome gigante e em duplo clique, e o dono podia trocar quem pediu. Tudo isso foi fechado.
- **Arquivos**: caminho com `../` para a pasta de outra pessoa, e renomear foto para outra pasta. Fechado.

## 5. Duplo clique, corrida entre usuários e sobrecarga

- **No banco:**
  - zap tirado e dado 20 vezes, seguir e deixar de seguir 20 vezes, e pedir para entrar no grupo 20 vezes geravam 20 avisos; agora geram 1;
  - dois zaps no mesmo segundo, de duas abas, viram um zap e um aviso;
  - `save_match` enviado duas vezes não duplica;
  - as corridas do Amigos e das predefinições já aparecem na seção 2.
- **No app:**
  - clique triplo em "Salvar" e em "Publicar" e 10 toques rápidos no placar gravam uma partida só;
  - desfazer 20 vezes volta ao 0 a 0 sem erro;
  - 3 rodadas de 200 toques aleatórios ("monkey test") não deram erro de JavaScript.
- **Carga no banco** (Postgres 16 local, 5.000 pessoas, 100 mil partidas, 400 mil marcações, 200 mil relações de seguir):
  - timeline Geral em 4,7 ms;
  - timeline Seguindo em 5,8 ms pela função `feed_following`;
  - busca por nome em 7,2 ms;
  - lançar partida pelo `save_match` em 3,0 ms;
  - apagar conta com centenas de partidas em 16 ms.
- **Sobrecarga** (pgbench, 50 conexões simultâneas, 80% leitura e 20% escrita, 20 s):
  - **620 operações por segundo, 0 falhas**;
  - leitura em 86 ms e lançar e marcar em 59 ms;
  - o esquema de antes fazia 500 a 535 por segundo na mesma máquina. As regras novas ficaram mais rápidas porque a timeline Seguindo passou a ler o bloqueio direto;
  - para comparar: 10 mil pessoas ativas no dia dão cerca de 10 operações por segundo no pico.
- **No aparelho**: 300 partidas (2 MB) abrem em 0,56 s. Cada tela abre em menos de 0,1 s.

## 6. Entrada absurda e maliciosa

O banco aceitava, e agora recusa:
- placar negativo, placar gigante e vencedor que não é 0 ou 1 (quebraria o ranking do grupo);
- duração negativa ou de 11 dias;
- partida em 2099, que ficaria no topo da timeline para sempre, ou em 1900;
- resumo e replay de 3 MB;
- código P- escolhido pela pessoa, selo "placar corrigido" forjado e data de criação forjada (bagunçava os números do painel);
- post com data no futuro, que ficaria fixado no topo do mural;
- nome com o caractere invisível U+202E (permite se passar por outra pessoa: "Bia" lida como "aiB"), com quebra de linha ou só com espaços;
- ajustes de privacidade gigantes, lista de 10 mil esportes e latitude impossível;
- "jogando agora" com o último ponto no futuro (agora vale a hora do servidor);
- e-mail dentro de evento de telemetria;
- toda coluna de texto ou JSON sem limite de tamanho (agora todas têm limite).

O cadastro com nome do Google de 70 letras quebrava a criação da conta. Agora o nome é cortado em 60 letras.

Ficaram sem correção no banco, como aviso:
- **telemetria**: 300 eventos seguidos do mesmo aparelho entram, porque não há limite de taxa no banco. O limite deve ficar na borda (função ou API gateway) ao ligar.
- **armazenamento**: não há cota total por conta (fotos de até 512 KB; trechos de vídeo Pro de até 200 MB). Vale pôr uma cota ao ligar os vídeos.
- `has_pro(id)` de outra pessoa é consultável. O Pro de cortesia já é público no perfil, mas uma assinatura paga ativa também vaza. Risco baixo.
- **placar ao vivo** (médio/baixo): o dono pode pôr qualquer pessoa sem bloqueio como "jogando", e ela aparece assim para os seguidores dela, com o placar e o lugar. Precisa de uma decisão de produto: pedir aceite ou mostrar só quem aceitou a marcação.
- **grupo** (baixo):
  - o organizador adiciona alguém como membro ativo sem pedir. Agora recusa quem tem bloqueio com ele;
  - quem foi removido volta pelo mesmo link de convite. Vale trocar o código ao remover alguém.
- **limites diários** (baixo): 30 cortesias, 60 convites e 20 denúncias por dia são contados antes de gravar, então pedidos simultâneos passam alguns além do limite.
- **criação em massa** (baixo): criar lugares e grupos não tem limite por dia.
- **denúncia** (baixo): a chave estrangeira confirma se um id de partida ou post existe.

No app, testado e seguro:
- XSS: nomes com `<img onerror>`, `<script>` e `"><svg onload>` em jogador, grupo e post aparecem como texto;
- `localStorage` corrompido ou com tipos trocados: o app abre e se recupera;
- links de partida adulterados ou truncados: aviso amigável.

Corrigido no app:
- **link-bomba**: um link pequeno que descomprime para centenas de MB travava o celular. Agora há limite de 64 KB no código e de 2 MB descomprimido, lido aos poucos.
- `?abrir=` com nome de propriedade interna (`__proto__`, `constructor`): só aceita as telas conhecidas.
- **cor do perfil** com texto arbitrário (CSS injetado): só aceita `#rgb`/`#rrggbb`.
- **dados da rede de demonstração com formato errado** (`g: 5`): quebravam o app. Agora são normalizados.

## 7. Revisão do código do app, site e service worker

| Achado | Gravidade | Situação |
|---|---|---|
| Página podia ser aberta dentro de um iframe de outro site (clickjacking) | média | **corrigido**: o app se recusa a abrir em frame alheio |
| Modelo de voz (Vosk, ~40 MB) sem conferência de integridade: cache envenenado ou CDN trocada rodaria código no worker | média | **corrigido**: SHA-384 conferido no service worker (o modelo vem de ccoreilly.github.io; se o hash não bate, refaz o download e, se continuar errado, recusa) |
| Service worker podia responder com arquivo de outro cache da mesma origem | baixa | **corrigido**: lê só o próprio cache (`canta-app-v51`) |
| Eventos de telemetria além da visita saíam sem consentimento quando a fila enchia | média (LGPD) | **corrigido**: sem consentimento, só a visita de sessão sai |
| Código de convite do Amigos e do link derivados do id do aparelho (previsíveis) | média | **corrigido**: aleatório com `crypto.getRandomValues` |
| CSV do admin com fórmula | média | **corrigido** (seção 3) |
| Link-bomba, `?abrir=`, cor injetada | média/baixa | **corrigido** (seção 6) |
| `dl/backup.json` com o seu nome real e código UP- publicado no Pages | média | **removido da pasta**; continua no histórico do git (ver pendências) |
| Origem `filipeultra.github.io` dividida com outros repositórios seus (um deles carrega scripts de unpkg/jsdelivr sem SRI) | **alta ao ligar a nuvem** | pendente: domínio próprio antes das contas de verdade |
| Relay ntfy do placar ao vivo sem criptografia (quem souber o tópico lê e manda comandos) | média | pendente: AES-GCM com a chave no `#` do link |
| CSP ainda sem o endereço do Supabase fixado; `unsafe-eval` exigido pelo worker do Vosk | baixa | pendente ao criar o projeto |
| Tokens do admin no `sessionStorage` | baixa | aceito (seção 3) |
| Pro e teste grátis só no aparelho | — | esperado no modo local (seção 2) |
| Eventos `pro_start`/`sub_start` disparam na demonstração | baixa | pendente: marcar como demo ou não enviar |
| `myUid` com `Math.random` de 30 bits (só identifica o aparelho, não é segredo) | baixa | anotado |
| Object URLs de foto e vídeo não liberados (memória) | baixa | anotado |
| Atribuição (`?ref=`) e chave de eventos guardadas antes do consentimento | baixa (LGPD) | anotado: guardar só depois do "aceito" |
| Bibliotecas de terceiros | — | sem CVE conhecida nas versões usadas |

## 8. Função de IA (`supabase/functions/analise`)

Baseada no OWASP Top 10 para apps com LLM: injeção de instrução (LLM01) e consumo sem limite (LLM10).
- **Cota furável**: a função contava e depois gravava, então 10 pedidos simultâneos passavam do limite. Agora ela reserva a vaga primeiro e conta depois, e quem passou do limite desfaz a própria reserva. Há também o limite de 3 por minuto.
- **Chat grátis pago por nós**: a função aceitava qualquer JSON como "fatos". Agora só aceita as chaves do app, textos de até 60 caracteres e jogadores J1, J2… e T1/T2. Isso também impede um app modificado de mandar nomes reais para fora.
- **Instrução escondida nos dados**: o pedido ao modelo diz que os fatos são dados e que nada dentro deles muda as regras.
- **CORS `*`**: agora só o endereço do app (`APP_ORIGIN`).
- **Resposta recusada, vazia ou cortada**: a recusa ou o texto vazio desfaz a reserva (a pessoa não perde a análise). A resposta cortada termina na última palavra, com "…".
- **Assinante recusado**: a função só olhava o Pro de cortesia (`pro_until`), então quem paga assinatura ou está num Amigos recebia "recurso do Pro". Agora ela usa `has_pro`, a mesma regra do banco.
- Configuração do modelo: raciocínio desligado e esforço baixo (texto curto e barato).

## 9. Testes no navegador (93 de 93)

Playwright + Chromium, com o app servido localmente:
- 1ª abertura;
- todas as telas em 390, 320 e 1280 px, sem rolagem lateral. Uma notificação vazava 12 px em 320 px e foi corrigida;
- partida completa em beach tennis, padel, tênis e peteca;
- salvar e publicar com clique triplo;
- 10 toques rápidos e desfazer 20 vezes;
- XSS nos nomes e regra da partida de terceiros;
- armazenamento corrompido e URLs adulteradas;
- monkey test (3 × 200 toques);
- offline: 133 toques salvos sem rede;
- acessibilidade (axe) no app, no site e no painel;
- 300 partidas no aparelho;
- todas as páginas do site e o painel em modo demonstração (12 seções).

Erros de JavaScript em todas as rodadas: 0.

## 10. O que ainda depende de você

Antes de abrir contas de verdade (ligar o Supabase):
1. **Domínio próprio** (ex.: ultraplay.app) apontando para o Pages, ou uma conta do GitHub só para o app. Hoje o `filipeultra.github.io` é a mesma origem de outros projetos seus, e um deles carrega scripts de CDN sem SRI: uma falha lá leria o `localStorage` e o login do ULTRA PLAY.
2. **Pagamento pelo servidor**: webhook do Mercado Pago com a assinatura `x-signature` conferida, gravado uma vez só (idempotência pelo id), e o Pro decidido só por `has_pro`. Teste grátis preso à conta, e de preferência com cartão ou Pix confirmado.
3. **CSP**: trocar o `connect-src` genérico pelo endereço exato do projeto Supabase e da função de IA.
4. **Segredos**: `ANTHROPIC_API_KEY` e `APP_ORIGIN` como segredos da função. A service role nunca vai no `config.js`, como já está documentado.
5. **Rodar `sh supabase/tests/rodar.sh`** no projeto de homologação depois de cada mudança no banco.

Logo depois:
6. **Relay ntfy criptografado** (ou trocar pelo Realtime do Supabase) antes de divulgar o placar ao vivo.
7. **Limite de taxa** na telemetria e **cota de armazenamento** por conta.
8. **Plano de incidente (LGPD)**: a Resolução CD/ANPD 15/2024 pede comunicar a ANPD e as pessoas em 3 dias úteis (prazo em dobro para agente de pequeno porte) e guardar o registro do incidente por 5 anos. Basta uma página: quem decide, como avisar e o modelo de texto.
9. **Histórico do git**: o `dl/backup.json`, com o seu nome e o código UP-, foi removido do site, mas ainda está no histórico público. Se isso incomodar, dá para reescrever o histórico ou recriar o repositório. Isso apaga o histórico de commits, então é decisão sua.
10. Guardar a atribuição (`?ref=`) só depois do consentimento, e não enviar `pro_start`/`sub_start` na demonstração.

## 11. Pesquisa (fontes)

- **OWASP Top 10 2025**: A01 Controle de acesso quebrado continua em 1º (agora inclui SSRF); entra A03 Falhas na cadeia de suprimentos de software; A10 Tratamento incorreto de condições excepcionais. Fontes: [Fastly](https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know), [Knowit](https://blog.knowit.eu/owasp-top-10-2025-what-is-new-and-what-has-actually-changed), [Nordic APIs](https://nordicapis.com/owasp-top-ten-2025-key-security-risks-for-apis-and-applications/).
- **OWASP ASVS 5.0** (maio de 2025, níveis L1 a L3), usado como lista de verificação de autenticação, sessão, controle de acesso e validação: [OWASP ASVS](https://owasp.org/www-project-ASVS/).
- **OWASP Top 10 para LLM 2025**: LLM01 injeção de instrução, LLM10 consumo sem limite. Fontes: [F5](https://www.f5.com/resources/infographic/owasp-llm-top10), [Indusface](https://www.indusface.com/learning/owasp-top-10-llm/).
- **Supabase**: erros comuns são RLS desligada ou "sempre verdadeira", view sem `security_invoker`, função `security definer` exposta pela API e service role no cliente ([unpwned.io](https://unpwned.io/qa/supabase/common-supabase-security-mistakes)). Todos foram conferidos no teste de higiene (`ataques.sql`, seção final).
- **Abuso de teste grátis** (contas novas, cartões descartáveis, mesmo aparelho): [Stripe](https://stripe.com/resources/more/free-trial-abuse).
- **Webhooks do Mercado Pago**: a assinatura `x-signature` (`ts` e `v1`) é um HMAC-SHA256 do `data.id`, do `x-request-id` e do `ts` com a chave secreta. Fonte: [Mercado Pago](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks).
- **GitHub Pages**: os sites de projeto ficam sob `usuario.github.io`, a mesma origem para o navegador: [GitHub Docs](https://docs.github.com/enterprise/2.2/user/articles/user-organization-and-project-pages/).
- **LGPD, incidente**: a Resolução CD/ANPD 15/2024 dá 3 dias úteis para a comunicação, em dobro para agente de pequeno porte, e pede guardar o registro por 5 anos. Fontes: [Cescon Barrieu](https://cesconbarrieu.com.br/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca/), [Legismap](https://legismap.com.br/conteudos/artigos-e-noticias/anpd-publica-resolucao-que-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca).

## 12. Como repetir

- **Banco**: `sh supabase/tests/rodar.sh` (precisa de um Postgres local) cria uma base nova para cada suíte e roda todas. Resultado de 15/10/2026: regras 31, partidas 83, ao vivo 24, formato 11, assinatura 18, arquivos, admin 23, admin-segurança 32, links 19 e ataques 250, todas passando. `tests/corrida.sh` (dois votos no mesmo segundo) também passa.
- **App**: os scripts de navegador desta rodada ficaram fora do repositório, na pasta de trabalho da sessão. Os casos estão listados na seção 9.
