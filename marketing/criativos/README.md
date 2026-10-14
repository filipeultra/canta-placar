# ULTRA PLAY · criativos de teste para tráfego pago (14/10/2026)

Três anúncios verticais (1080×1920, 30 fps, 16 a 20 s) para testar ângulos de mensagem no TikTok e no Instagram/Facebook (Reels e Stories). Feitos com IA (Magnific) e com as telas reais do app, montados em código.

| Criativo | Ângulo | Voz | Duração | Gatilhos |
|---|---|---|---|---|
| **A · "Tava 5-4 ou 4-5?"** | dor com humor | João Félix (jovem, descontraído) | 17,6 s | dor reconhecível, lacuna de curiosidade, humor, prova (o app na tela), grátis |
| **B · "Seus números de atleta"** | identidade e desejo | Catarina Cordeiro (energética) | 19,5 s | curiosidade ("quantos aces?"), aversão à perda (a memória some), identidade de atleta, risco zero (14 dias sem cartão) |
| **C · "Quem é o melhor da turma?"** | turma e competição | Larissa Melo (jeito de amiga) | 16,1 s | comparação social, pertencimento, prova, escassez real (Fundador para os 1.000 primeiros) |

Cada um termina na mesma tela verde com o logo e o botão **Baixe grátis**. Assim, a diferença de resultado vem do ângulo, não do fim.

> **Aviso sobre o C:** o preço de Fundador (R$ 119,90/ano, travado, para os 1.000 primeiros ou nos 60 dias do lançamento, como está em `docs/PRECOS.md`) só pode ir ao ar enquanto a oferta existir de verdade. Escassez falsa é proibida pelas plataformas e pelo CDC. Depois do lançamento, troque o cartão por "Grátis para começar".

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
| 14,1–17,6 s | Tela final: **Jogue no modo Ultra.** · Grátis, sem cartão · **Baixe grátis →** | "Baixe grátis e jogue no modo Ultra!" |

### B · "Seus números de atleta" (19,5 s)
| Tempo | Imagem | Fala / texto |
|---|---|---|
| 0–3,7 s | Clipe animado: smash à noite, estilo game. Selo **ACES: ??** girando | "Você joga toda semana… e não sabe quantos aces fez?" |
| 3,7–6,7 s | Jogador no banco; o balão da lembrança vai borrando e perdendo a cor | "O seu melhor jogo já está sumindo da memória." |
| 6,7–14 s | Celular: **estatísticas reais** (barras, evolução, análise do dia). Stickers **ACES**, **WINNERS** e **ERROS** pulando na fala | "No Ultra Play, cada partida vira número de atleta: aces, winners, erros… e a sua evolução no mês." |
| 14–15,6 s | **Troféu real de conquista** + sticker de troféu + som de conquista | "E ainda vira conquista!" |
| 15,6–19,5 s | Tela final: **Seus números de atleta.** · Pro 14 dias grátis, sem cartão · **Baixe grátis →** | "Teste o Pro catorze dias grátis, sem cartão." |

### C · "Quem é o melhor da turma?" (16,1 s)
| Tempo | Imagem | Fala / texto |
|---|---|---|
| 0–1,7 s | Clipe animado: os 4 amigos apontando para si mesmos. Quatro balões **EU!** | "Quem é o melhor da sua turma?" |
| 1,7–4 s | A turma em zoom | (risada) "Todo mundo acha que é ele." |
| 4–5,7 s | Pódio com coroa. Carimbo **AGORA TEM PROVA** + torcida | "Agora tem prova:" |
| 5,7–9,3 s | Celular: **ranking real do grupo** → **replay real** → **timeline real** | "ranking do mês, replay dos lances e a resenha no grupo." |
| 9,3–12,9 s | Cartão **Preço de Fundador** · R$ 119,90/ano travado · **Só para os 1.000 primeiros** + medalha | "E pros primeiros mil, preço de Fundador travado." |
| 12,9–16,1 s | Tela final: **Chama a turma.** · Grátis para começar · **Baixe grátis →** | "Chama a turma e baixa o Ultra Play!" |

**Texto do anúncio (legenda do post), sugestão:**
- A: "Tava 5-4 ou 4-5? 😅 Marca o placar num toque e acaba a discussão. Grátis."
- B: "Quantos aces você fez no último jogo? Seus números de atleta, partida a partida. Teste o Pro 14 dias grátis."
- C: "Quem é o melhor da turma? Ranking do mês, replay e resenha no grupo. Chama a galera."

## 4. Custo no Magnific (projeto separado "ULTRA PLAY · Criativos de teste (tráfego)")
| Item | Quantidade | Créditos |
|---|---|---|
| Imagens (GPT 2, 1k) | 11 (2 refeitas sem fundo transparente) | 1.100 |
| Clipes de 5 s (Kling 2.5, 720p, a partir das imagens) | 3 | 420 |
| Narração (ElevenLabs v3) | 3 | 162 |
| Trilha (Lyria 3, 30 s) | 3 | 240 |
| Efeitos sonoros | 8 | 60 |
| Recorte de fundo dos stickers | 4 | 12 |
| **Total** | | **≈ 2.000** (de 72 mil disponíveis) |

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
3. Rode `node marketing/criativos/render.js a b c`. Ele gera `criativo-a.mp4` (e B e C) e as capas `criativo-*-capa.jpg`, em uns 5 minutos por vídeo.
4. Para conferir o layout sem os arquivos do Magnific, use `TESTE=1 node marketing/criativos/render.js a`. Ele usa marcadores e sons de teste e salva em `work/`.

**Onde mexer:**
- **textos, tempos, cenas e stickers:** objeto `S` em `criativo.html`;
- **tempos das palavras:** `src/falas.js`;
- **sons:** `src/sons.json`;
- **telas do app:** gravadas do app em modo demonstração, em `src/app/*.mp4`.
