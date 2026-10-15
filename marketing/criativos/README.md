# ULTRA PLAY · criativos de teste para tráfego pago (14/10/2026)

Vinte e um anúncios verticais (1080×1920, 30 fps, 12 a 21 s) para testar ângulos de mensagem no TikTok e no Instagram/Facebook (Reels e Stories): 3 do lote 1 (A, B, C), 10 do lote 2 (D1 a D10, por esporte) e 8 do lote 3 (E1 a E8, com foto real). Feitos com IA (Magnific) e com as telas reais do app, montados em código.

**Catálogo para escolher e subir:** [`index.html`](index.html) (no site: `/marketing/criativos/`). Filtra por esporte, tipo e ângulo, mostra gancho, CTA, público e legenda de cada vídeo, copia o link com UTM e guarda os escolhidos.

> **Regras de texto (desde o lote 2):** não usar "ace" (no beach e no padel quase não existe; falamos "ponto de saque"), não falar "sem cartão" nem de plano pago ou preço de Fundador. O anúncio só traz a galera para o app grátis. B, C e o selo final do A foram refeitos assim.

| Criativo | Ângulo | Voz | Duração | Gatilhos |
|---|---|---|---|---|
| **A · "Tava 5-4 ou 4-5?"** | dor com humor | João Félix (jovem, descontraído) | 17,6 s | dor reconhecível, lacuna de curiosidade, humor, prova (o app na tela), grátis |
| **B · "Seus números de atleta"** | identidade e desejo | Catarina Cordeiro (energética) | 20,6 s | curiosidade ("quantos pontos de saque?"), aversão à perda (a memória some), identidade de atleta, conquista |
| **C · "Quem é o melhor da turma?"** | turma e competição | Larissa Melo (jeito de amiga) | 12,7 s | comparação social, pertencimento, prova (ranking, replay e resenha) |

Cada um termina na mesma tela verde com o logo e o botão de baixar. Assim, a diferença de resultado vem do ângulo, não do fim.

## 1. Pesquisa: criar e editar vídeo com IA (e com o Claude)

**O caminho que funciona hoje:** gerar as peças com IA e montar o vídeo em código. A IA gera as imagens, a voz, a trilha, os efeitos e, se precisar, alguns segundos de vídeo. O Claude escreve o roteiro e monta tudo com um motor de vídeo (HTML/React ou FFmpeg). Ferramentas citadas:

- **Remotion + Agent Skills:** vídeo em React, com skills oficiais para Claude Code (`npx skills add remotion-dev/skills`, repositório `remotion-dev/skills`). [tella.com](https://www.tella.com/blog/how-to-use-remotion-agent-skills-with-claude-code.md), [mer.vin](https://mer.vin/2026/05/remotion-agent-skills-install-remotion-dev-skills-for-claude-code-and-cursor/)
- **Servidores MCP com FFmpeg:** `video-editor-mcp` (cortar, legendar com Whisper, estabilizar) e `mcp-video`. [glama.ai](https://glama.ai/mcp/servers/y8ta1e6pbt), [mcpservers.org](https://mcpservers.org/pt-BR/servers/kyanitelabs/mcp-video), [opus.pro](https://www.opus.pro/blog/claude-video-editing-mcp)
- **Nossa skill `claude-video-vision`** (repositório `main-skills`): assiste vídeos locais por quadros e áudio.
- **O que usei aqui:** o mesmo método do reels `vem-ai` do projeto. Uma página (`criativo.html`) desenha cada quadro a partir do tempo, o Playwright fotografa os quadros e o FFmpeg junta tudo com o áudio. É o mesmo princípio do Remotion, sem instalar nada novo, e cada texto ou tempo muda numa linha.

**O que dizem os guias de anúncio (blogs de agências e ferramentas, não da TikTok ou da Meta; confira no Ads Manager antes de subir):**
- **Gancho:** os 3 primeiros segundos decidem. Estrutura gancho → problema → solução → CTA, ou PAS (problema, agitação, solução). [stackmatix.com](https://stackmatix.com/blog/tiktok-creative-best-practices-2026), [bevycommerce.com](https://bevycommerce.com/insights/tiktok-ads-strategy-creative-best-practices-for-2026)
- **Mensagem cedo:** cerca de 63% a 67% dos anúncios que performam bem mostram a mensagem principal nos 3 primeiros segundos (número de segunda mão). [megadigital.ai](https://megadigital.ai/en/blog/tiktok-ad-creatives)
- **Estilo nativo:** vídeo nativo e "lo-fi" costuma ganhar do comercial polido no TikTok. [segwise.ai](https://segwise.ai/blog/tiktok-ad-best-practices-improve-performance.md)
- **Volume de teste:** testar muitos conceitos e trocar rápido, porque o criativo cansa mais rápido no TikTok. [hawky.ai](https://hawky.ai/blog/tiktok-ad-ideas), [adcreate.com](https://adcreate.com/blog/ai-video-ads-for-mobile-apps)
- **Personagem próprio:** a IA deixa os anúncios parecidos entre si. Personagem e estilo reconhecíveis ajudam a não sumir no meio. [adcreate.com](https://adcreate.com/blog/ai-video-ads-for-mobile-apps)
- **Área segura (9:16):** texto e CTA fora dos ~14% de cima e dos ~25% a 35% de baixo, onde ficam o nome, a legenda e o botão da plataforma. [houseofmarketers.com](https://houseofmarketers.com/guide-to-safe-zones-tiktok-facebook-instagram-stories-reels/), [adsmurai.com](https://www.adsmurai.com/en/articles/meta-reels-ads), [moda.app](https://moda.app/resources/sizes/tiktok-ad)
- **Som e legenda:** feito para ouvir com som, mas legendado para quem assiste mudo. [adsmurai.com](https://www.adsmurai.com/en/articles/meta-reels-ads)
- **Duração:** guias recomendam de 6 a 30 s, sem consenso. Os três ficaram entre 16 e 20 s. Se o vídeo segurar até o fim, vale testar um corte de 9 s (gancho + app + CTA).

**Vídeo de referência do amigo** (@eagora.ze, "Elevador ou escada durante um terremoto?", ep. 2/6, 55 s), assistido por quadros e transcrição:
- **Formato:** série educativa com cliffhanger, não anúncio. Termina numa pergunta aberta ("e se você estivesse no 6º andar, a um passo do elevador?") para levar ao próximo episódio.
- **Imagem:** 8 imagens paradas, uma a cada 5 a 7 s (cortes aos 5, 12, 18, 27, 31, 37, 43 e 50 s).
  - O personagem é o mesmo em todas (o Zé, camisa florida), em estilo cartoon de livro ilustrado, com luz noturna quente.
  - O movimento é só zoom lento e um leve tremor (o terremoto). Não há vídeo gerado.
- **Texto:** uma palavra por vez no centro da tela, em letras brancas com contorno preto (o estilo "uma palavra" das legendas automáticas).
- **Som:** narração calma (voz sintética, terceira pessoa: "11 da noite. O Zé está na cozinha…") e trilha de suspense (piano e caixinha de música, da biblioteca do TikTok).
- **O que levamos dele:**
  1. imagem parada com movimento basta, sem gerar vídeo;
  2. personagem fixo cria série e reconhecimento: vale um mascote do ULTRA PLAY para conteúdo orgânico;
  3. uma história com começo, problema e saída prende mais que lista de recursos.
- **O que muda num anúncio pago:**
  - cortes bem mais rápidos (1,5 a 3 s em vez de 5 a 7 s);
  - o produto aparece antes da metade;
  - CTA claro no fim, em vez de cliffhanger. O cliffhanger fica para a série orgânica.

## 2. Direção de arte

- **Estilo:** desenho plano tipo sticker (contorno preto grosso, cores chapadas, borda branca recortada) sobre fundo escuro, com as cores do app: verde-limão `#AFFB48` e laranja `#FF5A1F`, que também são os times Verde e Laranja do placar.
  - Nada de imitar pessoa real. Personagens caricatos e cômicos.
- **Ritmo:** troca de plano a cada 1,5 a 3 s.
  - Os movimentos são zoom e pan lento nas imagens, stickers que pulam com mola, balões de fala, carimbo e o celular entrando de baixo.
  - Um flash curto marca cada corte.
- **Prova:** metade do vídeo é o app de verdade, gravado do próprio app em modo demonstração:
  - placar marcando pontos;
  - Momento ponto a ponto;
  - estatísticas com barras enchendo;
  - troféu de conquista;
  - ranking do grupo;
  - replay;
  - timeline.
- **Legenda:** palavra por palavra, sincronizada com a fala.
  - A palavra dita fica em verde-limão.
  - A legenda fica no centro da tela e sobe para o topo quando o celular aparece, para não cobrir o app.
  - Tudo fica dentro da área segura.
- **Som:**
  - narração ElevenLabs v3 com direção de emoção (frustrado, suspiro, animado), acelerada 8% a 12% para ganhar ritmo;
  - trilha instrumental (Lyria) que abaixa sozinha quando a voz entra;
  - efeitos: bola na raquete, pop dos stickers, scratch de vinil, "ooh" da galera, apito, whoosh, som de conquista e torcida;
  - volume final normalizado em -14 LUFS (padrão das redes).

## 3. Roteiros

### A · "Tava 5-4 ou 4-5?" (17,6 s)
| Tempo | Imagem | Fala / texto |
|---|---|---|
| 0–3 s | Clipe animado (Kling): as duas duplas brigando na rede. Balões **5-4!** (verde) e **4-5!** (laranja) | "Tava cinco a quatro… ou quatro a cinco?" |
| 3–4,3 s | Congela em preto e branco + scratch. Sticker do jogador confuso com "???" | (suspiro) |
| 4,3–6,9 s | A briga em zoom, tremendo + "ooh" | "Toda partida termina na mesma discussão." |
| 6,9–10,7 s | Celular entra: **placar real** marcando pontos, com som de bola em cada um | "Com o Ultra Play, um toque e o ponto fica registrado." |
| 10,7–14,1 s | **Momento ponto a ponto real** + apito | "Ponto a ponto, com horário. Sem discussão." |
| 14,1–17,6 s | Tela final: **Jogue no modo Ultra.** · Placar · estatísticas · replay · **Baixe grátis →** | "Baixe grátis e jogue no modo Ultra!" |

### B · "Seus números de atleta" (20,6 s, refeito no lote 2)
| Tempo | Imagem | Fala / texto |
|---|---|---|
| 0–3,9 s | Clipe animado: smash à noite, estilo game. Selo **SAQUES: ??** girando | "Você joga toda semana… e não sabe quantos pontos de saque fez?" |
| 3,9–7,3 s | Jogador no banco; o balão da lembrança vai borrando e perdendo a cor | "O seu melhor jogo já está sumindo da memória." |
| 7,3–15,5 s | Celular: **estatísticas reais**. Selos **Pontos de saque**, **Bolas vencedoras** e **Erros** na fala | "No Ultra Play, cada partida vira número de atleta: pontos de saque, bolas vencedoras, erros… e a sua evolução no mês." |
| 15,5–17,3 s | **Troféu real de conquista** + som de conquista | "E ainda vira conquista!" |
| 17,3–20,6 s | Tela final: **Seus números de atleta.** · Beach · padel · tênis · peteca · **Baixe agora →** | "Baixe agora e jogue no modo Ultra." |

### C · "Quem é o melhor da turma?" (12,7 s, refeito no lote 2)
| Tempo | Imagem | Fala / texto |
|---|---|---|
| 0–1,9 s | Clipe animado: os 4 amigos apontando para si mesmos. Quatro balões **EU!** | "Quem é o melhor da sua turma?" |
| 1,9–4,8 s | A turma em zoom | (risada) "Todo mundo acha que é ele." |
| 4,8–6 s | Pódio com coroa. Carimbo **AGORA TEM PROVA** + torcida | "Agora tem prova:" |
| 6–9,6 s | Celular: **ranking real do grupo** → **replay real** → **timeline real** | "ranking do mês, replay dos lances e a resenha no grupo." |
| 9,6–12,7 s | Tela final: **Chama a turma.** · Beach · padel · tênis · peteca · **Baixe agora →** | "Chama a turma e baixa o Ultra Play!" |

**Texto do anúncio (legenda do post), sugestão:**
- A: "Tava 5-4 ou 4-5? 😅 Marca o placar num toque e acaba a discussão. Grátis."
- B: "Seu melhor jogo não pode sumir da memória 💪 Cada partida vira número de atleta."
- C: "Todo mundo acha que é o melhor da turma 😂 Agora tem ranking do mês. Marca a turma."

## 4. Custo no Magnific (projeto separado "ULTRA PLAY · Criativos de teste (tráfego)")
| Item | Quantidade | Créditos |
|---|---|---|
| Imagens (GPT 2, 1k) | 11 (2 refeitas sem fundo transparente) | 1.100 |
| Clipes de 5 s (Kling 2.5, 720p, a partir das imagens) | 3 | 420 |
| Narração (ElevenLabs v3) | 3 | 162 |
| Trilha (Lyria 3, 30 s) | 3 | 240 |
| Efeitos sonoros | 8 | 60 |
| Recorte de fundo dos stickers | 4 | 12 |
| **Total do lote 1** | | **≈ 2.000** (de 72 mil disponíveis) |
| **Lote 2:** 4 imagens, 2 clipes Kling, 12 narrações (10 novas + B e C refeitas), 4 trilhas, 6 efeitos, análise dos clipes | | **≈ 1.900** (estimativa) |

Gerar o vídeo inteiro por IA custaria muito mais. Só o Seedance Fast sai 1.175 créditos por 5 s, e o app não pode ser inventado. Por isso a IA fica no gancho (3 s de clipe) e nas cenas de humor. O resto é imagem parada com movimento e o app real.

**Problemas que a análise de vídeo do Magnific apontou nos clipes do Kling:** no A, uma raquete extra aparece aos 0,8 s e de novo aos 4,2 s. No B, o personagem deforma depois dos 3 s. No C, as raquetes se deformam entre 1,6 e 2,4 s. Os cortes usam só os trechos limpos: A de 1,2 a 4,1 s, B de 0 a 3 s e C de 0 a 1,6 s.

## 5. Plano de teste
- **Estrutura:** uma campanha de instalação ou tráfego para o site, com 3 conjuntos iguais (mesmo público e mesmo orçamento), cada um com um criativo.
- **Orçamento e janela:** R$ 30 a 50 por dia por criativo, de 3 a 5 dias, sem mexer no meio.
- **O que medir, em ordem:**
  1. **taxa de gancho** (visualizações de 3 s ÷ impressões);
  2. **retenção** (quem assiste até 50% e até 100%);
  3. **CTR** do link;
  4. **custo por instalação**, ou por conta criada.
- **Links do painel:** use os links rastreáveis do painel (Links e tráfego), um por criativo, com `utm_content=criativo-a|b|c`. O painel mostra visitas, contas, 1ª partida e Pro de cada um.
- **Depois do teste:** fique com o ângulo vencedor e faça variações dele (outro gancho, outra voz, versão de 9 s). O vencedor vira o modelo dos próximos.
- **Teto de custo por membro ativo:** R$ 4 a 5 (de `docs/METAS.md`).

## 6. Como gerar de novo
1. Com a rede liberada para `*.cdnpk.net`, baixe os arquivos do Magnific listados em `src/assets.json`:
   - pegue os links atuais com `creations_get` (eles expiram);
   - rode `python3 marketing/criativos/baixar.py links.json`.
2. Na raiz do repositório, suba o servidor: `python3 -m http.server 8765`.
3. Se mexeu numa narração, rode `python3 marketing/criativos/prep_voz.py` (corta as pausas longas e gera `src/audio/<id>-voz-ed.wav` e `src/falas.js`).
4. Rode `node marketing/criativos/render.js` (todos) ou `render.js d1 d4 b` (só esses). Ele gera `criativo-<id>.mp4` e a capa `criativo-<id>-capa.jpg`. Cada vídeo leva de 8 a 12 minutos; dá para rodar 3 processos ao mesmo tempo.
5. Para conferir o layout sem os arquivos do Magnific, use `TESTE=1 node marketing/criativos/render.js a`. Ele usa marcadores e sons de teste e salva em `work/`.

**Onde mexer:**
- **textos, tempos, cenas, celular e motion graphics:** `src/roteiros.js` (um objeto por vídeo; `criativo.html` é só o motor);
- **tempos das palavras:** `src/falas-brutas.json` (tempos da IA) → `prep_voz.py` → `src/falas.js`;
- **sons:** `src/sons.json` (trilha, volume e efeitos; os toques no celular entram sozinhos);
- **toques na tela:** `src/toques.js` (gravados junto com as telas);
- **telas do app:** gravadas do app em modo demonstração, em `src/app/*.mp4`;
- **catálogo:** a lista `V` em `index.html`.

## 7. Lote 2 · 10 criativos por esporte (D1 a D10)

**O pedido:** mais 10 vídeos, alguns sem desenho (só o app funcionando e gráficos animados), um ângulo próprio para cada esporte, perguntas que o jogador não sabe responder, e o app lançando pontos ao vivo, encerrando, publicando e mostrando as estatísticas.

**O que a pesquisa de gancho diz** (blogs de ferramentas e agências; os números são indicativos, não estudos):
- **Taxa de gancho** = visualizações de 3 s ÷ impressões. Referência de 15% a 35%. É a 1ª métrica do teste. [kickbite.io](https://www.kickbite.io/en/blog/hook-rate)
- **Laço aberto:** o gancho que mais prende promete uma resposta que a pessoa ainda não tem. Por isso quase todos abrem com uma pergunta sobre o próprio jogo dela ("Quantas vezes você já ganhou daquele seu amigo?"). [tlinky.com](https://tlinky.com/3-second-hook/)
- **Três camadas juntas:** imagem, fala e texto na tela dizem a mesma coisa nos 3 primeiros segundos. [tlinky.com](https://tlinky.com/3-second-hook/)
- **Curiosidade, tensão, surpresa ou relevância** são os quatro motores das fórmulas de gancho; a afirmação contrária ("quem vence os pontos decisivos vence o jogo") gera tensão. [sideshift.app](https://sideshift.app/blog/ugc-hook-formulas), [go-viral.app](https://www.go-viral.app/blog/hook-first-3-seconds/), [eliro.pro](https://eliro.pro/blog/short-form-video-hooks-script-guide-2026)
- **Uma campanha por modalidade:** o Strava separa campanhas por atividade (corrida, bike, natação), e os anúncios dele têm cara de vídeo gravado pelo próprio usuário, com cortes rápidos. [Apple Ads · Strava](https://ads.apple.com/app-store/success-stories/strava), [motionapp.com](https://motionapp.com/library/strava)
- **Mercado:** padel com mais de 600 mil praticantes no Brasil (Cobrapa) e beach tennis com cerca de 1,1 milhão (CBT); os números variam conforme a fonte. [gazetasp.com.br](https://www.gazetasp.com.br/esportes/mais-de-600-mil-praticantes-padel-dispara-no-brasil-e-e-o-esporte-que/), [lance.com.br](https://www.lance.com.br/tenis/modalidades-esportivas-como-beach-tennis-e-o-futevolei-arrastam-adeptos-e-abrem-espacos-para-novos-mercados-no-brasil.html)

**Como ficou cada esporte:**
| Vídeo | Esporte | Tipo | Gancho (0–3 s) | Por que nesse esporte |
|---|---|---|---|---|
| **D1** Ficou fácil marcar o placar | Beach | App ao vivo | "Ficou fácil demais marcar o placar do seu beach." | lança pontos, encerra, replay e post: mostra o app inteiro |
| **D2** Quantas vezes você ganhou daquele amigo? | Todos | Motion de dados | a pergunta + "Sem chutar" | rivalidade entre amigos existe em todos |
| **D3** O parceiro que mais te deu vitórias | Beach (e padel) | Motion de dados | "Quem foi o parceiro de dupla que mais te deu vitórias?" | os dois são jogados em dupla |
| **D4** O que você mais erra no padel? | Padel | Motion de dados | "Na rede? Pra fora? No saque?" | a parede e a rede decidem o padel |
| **D5** Ganha quem vence os pontos decisivos | Padel | Motion de dados | afirmação + "E você?" | ponto de ouro e break points |
| **D6** Faz aula e não evolui no jogo? | Tênis | Ilustrado + app | "Você faz aula particular… mas não consegue evoluir?" | tênis é o esporte da aula particular |
| **D7** Qual foi a sua maior virada? | Tênis | Motion de dados | "Qual foi a maior virada que você já deu no tênis?" | jogo longo, sets, viradas de 19 pontos |
| **D8** Treina, joga e perde sem saber por quê | Beach | Ilustrado + app | "Você treina a semana toda… chega no jogo e perde." | muita gente treina com professor no beach |
| **D9** Ô, petequeiro! | Peteca | Ilustrado + app | chamado direto + "pontos de saque esse mês?" | nicho com identidade forte e pouco anúncio |
| **D10** Seu campeonato em nível profissional | Todos (organizador) | Ilustrado + app | "Organiza torneio de beach, padel ou peteca?" | um organizador traz dezenas de jogadores |

**Números na tela:** todos vêm de partidas reais do modo demonstração do app (por exemplo, Você × Brenda 6V 1D, Mari Teles 67%, padel com 11 erros na rede e 9 pra fora, virada 2-6 6-4 6-4 depois de 19 pontos atrás).

**O que mudou no motor (`criativo.html`):**
- os roteiros saíram para `src/roteiros.js`, e o motor ganhou motion graphics: palavra a palavra grande (`kin`), pílulas, carimbos, contadores, barras, medidor e gráfico de linha, sobre fundo animado;
- o celular mostra o toque do dedo onde o ponto foi lançado (círculo + som de toque), com os toques gravados junto com a tela;
- o texto grande encolhe sozinho para caber em 1000 px;
- a narração passa por `prep_voz.py`: pausas acima de 0,3 s ficam curtas, o fim de palavra arrastado é cortado e os tempos das palavras são refeitos. O vídeo fica 10% a 20% mais curto sem acelerar a voz.

**Antes de subir:** ouça cada um com fone. A voz da IA pode errar a pronúncia de um nome ou número. No roteiro da voz, o nome está escrito "Ultra Plei" para sair certo em português.

## 8. Lote 3 · 8 criativos com foto real (E1 a E8)

**O pedido:** vídeos com imagem real, na pegada da fotografia da Biovita (identidade criada pela Ultra Design), para testar foto real contra desenho no tráfego.

**Referências de estilo:**
- **Biovita:** gente real, em movimento, sol duro, flash direto à noite, grão de filme 35 mm e cultura de rua, praia e quadra. Corte fora do padrão, corpo cortado, mão em ação, cor quente e meio lavada. Nada de sorriso posado nem banco de imagem.
- **Strava, "Athletes Unfiltered":** membros reais, sem filtro (bolha, marca de sol, mão suja), contra o feed arrumado. [lbbonline.com](https://lbb.lbbonline.com/news/strava-pays-tribute-to-the-good-bad-and-ugly-of-true-amateur-athletes), [thedrum.com](https://www.thedrum.com/news/strava-campaign-encourages-athletes-be-unfiltered)
- **Nike, "Winning Isn't Comfortable":** a garra do treino (chuva, madrugada, escada) para falar com o corredor amador. [contagious.com](https://contagious.com/news-and-views/campaign-of-the-week-nike-winning-isnt-comfortable-advert)
- **Track&Field:** corredores reais, imagens com textura de arquivo pessoal e o ritual de acordar antes do sol ("só quem corre entende"). [grandesnomesdapropaganda.com.br](https://grandesnomesdapropaganda.com.br/?p=188506), [abcdoabc.com.br](https://abcdoabc.com.br/santander-trackfield-run-series-no-jk-iguatemi/)

**Os 8:**
| Vídeo | Esporte | Ângulo | Gancho (0–3 s) |
|---|---|---|---|
| **E1** Só quem joga beach entende | Beach | ritual (manifesto) | "Acordar antes do sol. A areia ainda fria." |
| **E2** Quinta, 21h | Padel | ritual da turma | "Quinta, nove da noite. O jogo mais importante da semana." |
| **E3** Quantos pontos você ganha sacando? | Tênis | saque | "Quando você está sacando… quantos pontos você ganha?" |
| **E4** Domingo de peteca no parque | Peteca | ritual da turma | "Domingo de manhã, peteca no parque." |
| **E5** Ele jura que ganhou | Todos | rivalidade (humor) | "Ele jura que ganhou o último jogo." |
| **E6** Professor de beach | Beach | professor | "Professor de beach: o seu aluno sai do jogo dizendo que perdeu por azar." |
| **E7** As meninas do beach | Beach | turma feminina | "Terça à noite, as meninas do beach." |
| **E8** A sua mãe viu cada ponto | Todos | família / ao vivo | "A sua mãe não conseguiu ir no torneio. Mas viu cada ponto." |

**Como foi feito:**
- **Fotos:** 21 imagens no Seedream 5 Pro (2k, 9:16), com o mesmo pedido de estilo em todas: foto documental em filme 35 mm, grão, sol duro ou flash direto, cor quente lavada, gente real com suor e areia, ninguém olhando para a câmera, sem texto nem logo. Ficam em `src/img/e*.jpg`.
- **Clipes de abertura:** 8 clipes de 5 s no Kling 2.5 (720p), a partir da 1ª foto de cada vídeo, com câmera na mão. No E2 a raquete some atrás do corpo depois de 1,5 s, então o clipe é cortado ali.
- **Narração:** ElevenLabs v3, uma voz por vídeo (Rafael Valente, Vinícius Barroso, Henrique Cordeiro, Caio Nogueira, João Félix, Duarte Sampaio, Lívia Moreira e Catarina Cordeiro). As risadas do E4, E5 e E7 são mantidas no corte de pausas.
- **Trilhas novas:** `trilha-doc` (violão e piano, clima de documentário: E1, E3, E6, E8) e `trilha-indie` (guitarra, palmas e pandeiro: E2, E4, E5, E7). Efeitos novos: ondas e risada de amigos.
- **Estilo foto no motor:** `estilo: 'foto'` no roteiro liga:
  - grão de filme animado (6 quadros de ruído fixos, sempre iguais), vinheta e cor quente;
  - legenda em caixa escura no estilo das redes, em vez do texto com contorno;
  - texto grande em Bricolage, pílulas sem contorno preto;
  - carimbo de data laranja de câmera de filme (`k: 'dt'`) e cortes secos sem flash.
  - A tela final verde é a mesma dos outros lotes, para a comparação ser justa.
  - O render usa crf 24 no estilo foto (o grão pesa na compressão): de 10 a 18 MB por vídeo.
- **Custo no Magnific:** 3.821 créditos, conferido no saldo (21 fotos: 2.100; 8 clipes: 1.120; 8 narrações: 386; 2 trilhas: 160; 2 efeitos: 55). Sobram 61,5 mil.

**Teste sugerido:** foto real × desenho no mesmo ângulo e no mesmo conjunto (E5 × A, E4 × D9, E6 × D6). O estilo que tiver a melhor taxa de gancho define o próximo lote.

