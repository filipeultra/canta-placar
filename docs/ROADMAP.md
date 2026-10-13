# ULTRA PLAY · ideias para depois

Ideias combinadas com o Filipe para as próximas fases. Ainda não estão no app; dependem da conta na nuvem (ver `SOCIAL.md`). Marketing, vendas, área para professores, kit pró com pulseira e câmeras com replay sincronizado estão em `MARKETING.md`.

## 1. Arenas e organizadores de eventos

Mapa e área das arenas, clubes e organizadores. Pode ter plano grátis e plano pago.

- **Mapa de arenas:** quadras perto de você, esportes de cada uma, horários e quem joga lá.
- **Organizadores (plano pago):** criar e gerir campeonatos (inscrição, chaves, tabela, resultados ao vivo, status de cada jogo), reservar quadras, avisos para os inscritos.
- **Quadra exata da partida:** ao marcar ou lançar uma partida, a pessoa escolhe a arena **e a quadra** (Quadra 1, Quadra 2…). Isso alimenta as estatísticas da arena.
- **Estatísticas da arena, controladas por ela:** rankings e recordes do lugar, por exemplo:
  - maior pontuador;
  - quem mais jogou;
  - dupla com mais vitórias;
  - mais aces e maior sequência;
  - por quadra, por esporte, por mês ou temporada.
- **A arena edita e reseta:** escolhe quais rankings aparecem, corrige ou remove partidas e zera os rankings (nova temporada, novo campeonato) sem apagar o histórico das pessoas. As partidas continuam de cada jogador; o que recomeça é a contagem da arena.
- **No banco:** `places` ganha `courts` (quadras de cada arena) e `matches` ganha `court_id`. Os rankings saem de consultas por arena e período, e o reset grava o início da temporada (`arena_seasons`), sem apagar dados.

## 2. Assistente de IA

**Já existe:** análise do jogo no fim de cada partida (automática, no aparelho), e a versão por IA pronta no servidor, desligada até ter conta. Custo estimado: R$ 0,015 por análise (ver `docs/IA.md`).

Um assistente que lê as estatísticas da pessoa e ajuda a jogar melhor.

- Palpites e análises: pontos fortes e fracos, golpe que mais rende, erros que mais custam, desempenho por parceiro e por adversário.
- Antes do jogo: o que observar contra aquele adversário, a partir dos confrontos anteriores.
- Depois do jogo: um resumo em linguagem simples, com o que melhorou e o que piorou em relação à média.

## 3. Avisos e estatísticas em tempo real

Durante a partida, avisos curtos comparando com o histórico de cada jogador. Por exemplo:

- "Fulano está errando mais que a média dele."
- "3 aces seguidos: melhor sequência do ano."
- "Esta dupla nunca perdeu um tiebreak."

Aparecem no placar, no modo TV e, opcionalmente, falados.

## 4. Gravação da partida em vídeo (Pro)

### Já existe (versão básica, sem servidor)
- **Gravar com o próprio celular do placar:** botão de câmera no placar. A imagem aparece só nos primeiros 8 segundos, para posicionar o celular; depois fica um selo "● 00:11" no canto (tocando, a imagem volta). Só imagem, sem som, para o microfone continuar livre para a voz.
- **Outro aparelho como câmera:** QR Code ou link. O outro celular ou notebook vira câmera em tela cheia, com selo de gravando, cronômetro e espaço usado. Pode usar os dois ao mesmo tempo.
- **Trechos de ~5 minutos sem perder lance:** o corte acontece no tempo morto logo depois de um ponto marcado (inclui troca de lado) a partir de 4 min; se não houver, corta aos 6 min com 8 s de sobreposição. Se o app sair da tela, a gravação para e volta sozinha (ou com um toque) ao reabrir. Aviso quando há pouco espaço no aparelho.
- **Placar e câmera conectados:** o celular do placar mostra quando o outro aparelho conectou, se está gravando (com cronômetro) ou parou, e avisa quando ele some por mais de 2 min. Dá para mandar gravar e parar lá pelo placar, e a câmera para sozinha quando a partida acaba. Cada ponto marcado avisa a câmera, que aproveita o tempo morto para virar o trecho. O canal usa o ntfy.sh (serviço público de mensagens, grátis): cada partida tem um canal com nome sorteado, e só passa o status da gravação, sem nomes nem placar. Com servidor próprio, troca-se só o `relay.js`.
- **Vídeo com a marca, o placar e os lances:** o vídeo salvo sai com a logo ULTRA PLAY no canto direito de baixo e, se quiser, o placar (canto de cima) e o lance que acabou de acontecer (canto de baixo), ligados ou desligados na folha da câmera ou no modo câmera. No celular câmera, o placar chega pelo canal (só números e cores, sem nomes).
- **Horizontal por padrão:** o vídeo sai 1280×720 mesmo com o celular em pé (a prévia mostra exatamente o que vai sair e pede para virar o celular). Para vertical, só pelo botão de formato; girar o celular não muda.
- **Cada ponto vira um lance em vídeo:** cada lance guarda o horário em que foi marcado, e cada trecho guarda início e fim. O app acha o momento pelo relógio e mostra uns 8 segundos antes do ponto. Há ajuste de sincronia (±1 s) caso os relógios dos aparelhos não batam.
- **No aparelho que gravou:** no fim, o placar manda o link das estatísticas para o aparelho câmera; lá, cada ponto já aparece com o vídeo (sem mandar arquivo pesado). Salvar o vídeo (Fotos/Arquivos) e apagar.
- **Armazenamento:** os vídeos ficam só no aparelho que gravou, com espaço usado em Ajustes e botão para apagar. Cerca de 9 MB por minuto (720p).

### Para depois
1. **Vídeo na nuvem (Pro):** subir os trechos para a conta, para ver em qualquer aparelho, inclusive no celular do placar quando a câmera foi outro aparelho.
2. **Limite de armazenamento "vitalício":** X horas guardadas no total enquanto for Pro (não renova por mês, porque as partidas ficam até a pessoa apagar). Ao cancelar o Pro, os vídeos ficam disponíveis por X dias para renovar ou baixar tudo; depois são excluídos (com avisos antes).
3. **Ver a imagem da câmera no placar ao vivo** (WebRTC) e trocar o ntfy.sh por um canal no próprio servidor.
4. **Marcar assistindo:** gravar sem marcar o placar e, depois, assistir e lançar os pontos em cada momento (Ponto Verde, Ponto Laranja, ou com detalhe: winner, erro, ace). Também acertar o momento de pontos marcados fora de hora.
5. **Juntar os trechos num vídeo só** ao salvar, com opção de cortar só os lances.
6. **Transmissão ao vivo:** usar o celular ou outras câmeras para transmitir no YouTube ou Instagram (chave de transmissão), com layout de placar e estatísticas na tela, já que tudo é registrado ao vivo.
7. **Som opcional** na gravação (hoje é só imagem, para não disputar o microfone com a voz).
8. **Câmeras das arenas parceiras** no mesmo esquema de horário e quadra (ver `MARKETING.md`).

## 5. Relógios e fones

### Já existe
- **Controle pelo relógio ou fone:** em Lançar → Relógio ou fone (ou em Ajustes). Os botões de música do relógio (Garmin, Amazfit, Apple Watch, Galaxy Watch) e os toques dos fones Bluetooth marcam o ponto: próxima = 1º time, anterior = 2º time, tocar/pausar = desfazer. A tela "tocando agora" do relógio mostra o placar. Funciona tocando um áudio mudo em loop, que é o que faz o celular entregar os botões ao app; precisa ser testado em cada modelo, principalmente no iPhone.
- **Microfone sem fio:** fone Bluetooth com microfone ou lapela sem fio, escolhido em Ajustes → Microfone, com teste de nível.

### Para depois
- **Voz no próprio relógio:** app nativo para Apple Watch e Wear OS (reconhecimento de voz no relógio, que manda o ponto para o celular). Garmin (Connect IQ) não libera o microfone para apps: lá, um app de relógio com botões de ponto na tela. Amazfit (Zepp OS): verificar por modelo.
- **Kit Pró com a pulseira** (ver `MARKETING.md`).

## 6. Pedidos anotados em 13/10/2026 (para fazer depois)

### 6.1 Indicação para professores e influenciadores
- **Como funciona:** cada parceiro tem um código ou link (o app já registra o `?ref=UP-XXXXXX` de quem convidou, em `prefs.origin` e nos eventos). Quando a pessoa indicada assina o Pro, o parceiro ganha **uma parte do valor** (sugestão para começar: 20 a 30% da 1ª mensalidade, ou 10% recorrente por 12 meses).
- **Metas:** a cada **10 indicações que assinam**, um prêmio maior (ex.: Pro vitalício, kit ULTRA com tripé, camiseta, destaque no Instagram oficial). Níveis: Bronze (10), Prata (25), Ouro (50).
- **No app:** tela "Minhas indicações" com o link, quantas pessoas entraram, quantas assinaram e quanto falta para a próxima meta. No painel de admin: ranking dos parceiros e quanto pagar no mês.
- **No banco:** tabela `referrals` (quem indicou, quem entrou, quando assinou) preenchida pelo webhook do pagamento; o pagamento ao parceiro sai por Pix (manual no começo; depois por split do provedor de pagamento). Atenção a regras: termo de parceria, nota fiscal/recibo e evitar autoindicação (mesmo aparelho ou mesmo cartão).

### 6.2 Kit ULTRA nas arenas
- Um **tripé** (de celular, com presilha universal) e um **banner/display** na quadra com: "Marque o placar por voz", QR Code (`utm_source=kit&utm_medium=<arena>`), 3 passos ilustrados (abrir, apoiar o celular no tripé, falar "ponto azul") e o Instagram.
- Começar com 3 a 5 arenas parceiras; medir no painel as visitas pela origem `kit`. O cartaz A4 (`marketing/posts/08-cartaz.png`) serve de base para a arte.

### 6.3 Pro "borrado" para dar vontade de assinar
- **Feito nas estatísticas completas (13/10/2026):** os 4 números do topo e o gráfico de aproveitamento ficam abertos; o resto aparece borrado com os números do perfil de exemplo, e o botão abre o Pro. Falta levar o mesmo para o resumo da partida e o grupo.
- Nas telas de estatística (resumo da partida, perfil, grupo), mostrar os blocos Pro **com desfoque** e um cadeado: momento ponto a ponto, pontos decisivos, golpes por jogador, evolução no ano, análise por IA.
- O conteúdo borrado deve ser **de mentira ou genérico** (não dá para "tirar o borrado" pelo inspetor e ver o dado real). Toque no bloco abre a tela do Pro já no recurso certo (`openPro('momento')`).
- Medir no painel: `pro_view` por recurso → `pro_start`.

### 6.4 Cidade por lista (país → estado → cidade)
- Trocar o campo de texto livre por seleção: **País** (Brasil primeiro), **Estado** (27 UFs) e **Cidade** (os 5.570 municípios do IBGE), com busca por digitação.
- A lista do IBGE fica num arquivo do próprio app (~60 kB compactado), sem depender de internet na quadra. Fora do Brasil, cidade em texto.
- Guardar o código IBGE do município (`city_code`) além do nome: deixa o ranking por cidade e o mapa de arenas certos (sem "BH", "Belo Horizonte" e "B. Horizonte" separados).

### 6.5 Site: posts de "curiosidades e dicas"
- Uma seção de artigos curtos no site (e no Instagram) com o que as pessoas não descobrem sozinhas: marcar ponto pelo **relógio** (Garmin, Apple Watch, Galaxy, Amazfit) ou fone, **passador de slides** como botão sem fio, **placar na TV** pela segunda janela, outro celular como **câmera** por QR Code, lente **0.5×** e brilho na gravação, grupos com ranking, backup entre celulares, comandos de voz com detalhe ("ace", "dupla falta", "na rede").
- Cada post com um GIF ou vídeo curto, link para o app (`utm_source=blog`) e a pergunta frequente correspondente em `help.js`.

### 6.6 Ideias do FitFolio (prints de 13/10/2026), para os ajustes finais
- **Ranking em pódio:** abas "Mês · Sempre" e um link "Como funciona".
  - Top 3 num pódio, com foto, nome e número grande na fonte condensada (o 1º no meio, mais alto).
  - Embaixo, "Outras posições" numa lista limpa (04, 05… à esquerda e o número à direita).
  - O que medir para nós: vitórias, semanas seguidas jogando, partidas e aproveitamento.
  - Onde: no grupo (já existe o ranking, ganha o visual), na arena, na cidade e geral.
  - Selo de verificado para professor e arena.
- **Perfil com redes sociais:** campos de Instagram e TikTok (só o @, validado; o toque abre o app da rede).
  - Topo com fundo em degradê da foto ou da cor da pessoa e os números em linha: Seguidores · Seguindo · Partidas · Sequência.
  - "Seu progresso": calendário do mês com o ícone do esporte (ou miniatura) em cada dia que jogou, e "Ver calendário" para os outros meses.
  - No banco: `profiles` ganha `instagram` e `tiktok` (texto curto, `^[a-z0-9._]{1,30}$`), com permissão de edição só do próprio.
- **Seletor da timeline mais minimalista:** trocar o seletor com fundo (Seguindo/Geral) por abas de texto com um sublinhado na aba atual, como no FitFolio.
  - Considerar uma 3ª aba: **Grupos** (partidas e resenha das suas turmas).
- **Prints para as lojas no mesmo estilo:** título grande em 2 linhas, a 2ª em cinza ("Cada ponto. / Por voz."), e o celular com a tela real em fundo preto.

### 6.7 Reel "vem aí" v2 (depois que o app estiver todo pronto)
O reel atual (`marketing/reels/vem-ai.html`) ficou com "cara de IA". A versão 2 segue o padrão dos vídeos de motion profissionais de app:
- **Um iPhone recente em mockup no centro**, com o app de verdade rodando dentro (gravação da tela, não print).
- **O texto acima do celular, centralizado e curto**, uma frase por cena, grande o bastante para ler no celular. Nada de texto em cima da tela do app.
- **Menos telas, mais movimento:** mostrar o uso como se alguém estivesse gravando uma partida ao vivo: toca em "Iniciar gravação", os pontos vão sendo marcados, os lances aparecem, e no fim os gráficos enchem e os números sobem.
- Cenas sugeridas (10 a 15 s): 1) "Tava 5-4 ou 4-5?" com a quadra; 2) toque em Iniciar gravação; 3) três pontos marcados com o placar mudando; 4) estatísticas completas com as barras enchendo e o raio "on fire"; 5) logo + "Jogue no modo Ultra."
- Movimento suave (easing de mola, sem efeitos chamativos), trilha com batida marcada e sons curtos de toque.

### 6.8 Relógios e pulseiras: distância, calorias e batimentos
- Sincronizar com Apple Saúde (HealthKit), Health Connect (Android), Garmin Connect, Strava e as pulseiras (Amazfit/Zepp, Xiaomi, Samsung Health) para trazer **km percorridos, kcal e frequência cardíaca** de cada partida.
- Casar pelo horário: o treino do relógio que cobre o começo e o fim da partida vira os números dela (com a opção de desfazer).
- No app: "Distância", "Calorias" e "Batimentos" entram nas estatísticas completas (por partida e na evolução) e no compartilhar.
- Precisa de app nativo (HealthKit e Health Connect não são acessíveis pelo navegador); Garmin e Strava têm API web com OAuth.

### 6.9 Análise do dia por IA no servidor
- Hoje a análise do dia das estatísticas completas sai por regras no próprio aparelho (`fullstats.js`), uma vez por dia por esporte e só quando há partida nova.
- Quando a IA estiver ligada (`AI_URL`), a mesma regra de "uma por dia, só com partida nova" vale no servidor: a função recebe só os números (`CantaFull.facts()`, sem nomes) e guarda o texto por pessoa e esporte, para não gastar IA à toa.

### 6.10 Guardado para depois (13/10/2026)
- **Exportar planilha (CSV) e dados (JSON):** saiu da tela da partida (pouco útil por partida). O código continua em `app.js` (`exportMatch`); a ideia é voltar nas estatísticas completas, exportando o período filtrado inteiro.
- **Mais de 2 jogadores por time:** hoje cada time aceita até 2 (`MAX_PER_TEAM` em `app.js`). Para vôlei de quadra, futevôlei 4x4 e futebol, subir o limite por esporte e mostrar a escolha de "quem fez o ponto" em grade.
- **Lances editáveis:** na lista de Lances, tocar num ponto antigo para corrigir o tipo ou o jogador (hoje só dá para desfazer os últimos).

### Fila dos ajustes finais (tudo o que ficou "para depois")
| # | O quê | Onde está o detalhe |
|---|---|---|
| 1 | Cidade por lista: país → estado → cidade (IBGE) | 6.4 |
| 2 | Pro "borrado" no resumo da partida e no grupo (nas estatísticas completas já está) | 6.3 |
| 3 | Seletor da timeline minimalista (e talvez a aba Grupos) | 6.6 |
| 4 | Perfil com Instagram/TikTok, números no topo e calendário do mês | 6.6 |
| 5 | Ranking em pódio (grupo, arena, cidade, geral) | 6.6 |
| 6 | Posts de "curiosidades e dicas" no site | 6.5 |
| 7 | Indicação para professores e influenciadores (comissão e metas) | 6.1 |
| 8 | Kit ULTRA nas arenas (tripé e banner com QR Code) | 6.2 |
| 9 | Prints das lojas no estilo do FitFolio | 6.6 |
| 10 | Reel "vem aí" v2 com iPhone e uso ao vivo | 6.7 |
| 11 | Relógios e pulseiras: km, kcal e batimentos | 6.8 |
| 12 | Análise do dia por IA no servidor | 6.9 |
| 13 | Exportar CSV/JSON nas estatísticas gerais; mais de 2 por time; editar lances | 6.10 |

## Antes de abrir para o público (checklist)

Já feito na revisão de 12/10/2026:
- Dados de fora (link das estatísticas, backup) validados contra listas fechadas; testado com link, backup e campos com código malicioso, sem execução.
- Política de segurança de conteúdo (CSP): só roda script do próprio app e do motor de voz offline; código injetado em texto não executa.
- Funciona sem internet depois da primeira visita; com sinal fraco (mais de 3 s) abre pela cópia guardada.
- Timeline em páginas de 12, histórico e perfil em memória: navegação 2 a 3 vezes mais rápida com 100 partidas.
- Até 300 partidas no aparelho, com aviso para exportar o backup antes de perder as antigas.
- Aviso amigável em erro inesperado; acessibilidade sem violações no verificador automático (axe, WCAG AA).
- Prévia do link no WhatsApp e nas redes (imagem e descrição).
- "Já tenho conta" sem botões de Google/Apple de mentira: restaurar backup ou continuar no aparelho.

Feito em 13/10/2026:
- Placar e câmera conectados: o placar mostra o status da câmera e manda gravar ou parar lá; trechos de ~5 min cortados no tempo morto.
- Grupos/turmas com ranking, resenha, convite por link, partida do grupo e autorização temporária ao organizador.
- Rede de exemplo desligável (Ajustes → Conta). O padrão é a constante `DEMO_NET_DEFAULT` em `app.js`.
- Site de apresentação em `site/`, artes de lançamento e cartaz com QR Code em `marketing/`.
- Banco do servidor pronto e testado em `supabase/` (28 verificações das regras).
- Rascunhos de Termos e Política de Privacidade em `docs/legal/`, para revisão jurídica.

Falta, e depende de servidor ou de decisão:
1. **Conta na nuvem** (login Google, Apple e celular), com as partidas sincronizadas entre aparelhos.
2. **Rede de exemplo desligada no lançamento:** a chave já existe. No dia, mude `DEMO_NET_DEFAULT` para `false` (ou deixe ligada só no modo de demonstração).
3. **Pro de verdade:** hoje é demonstração grátis; cobrança pela loja ou por assinatura web.
4. **Termos de uso e política de privacidade (LGPD):** os rascunhos estão em `docs/legal/`. Falta a revisão por advogado, os dados do responsável (nome/CNPJ, endereço, e-mail, encarregado), as decisões entre [colchetes] e o canal de contato. Depois, publicar como páginas e pôr o link na tela de entrada.
5. **Domínio próprio** (ex.: ultraplay.app) em vez de github.io, com cabeçalhos de segurança no servidor.
6. **Monitoramento de erros e métricas de uso** (com consentimento), para saber o que quebra no celular das pessoas.
7. **Moderação:** as denúncias hoje só mostram "enviada"; precisam chegar a alguém.
