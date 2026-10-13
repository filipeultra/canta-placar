# ULTRA PLAY · build in public

Inspirado no FitFolio (app brasileiro de treino que cresceu no orgânico, com o fundador postando os bastidores no X e no TikTok). A pesquisa completa, com fontes, está em `docs/pesquisa/FITFOLIO.md`.

## O que já está no app por causa disso (13/10/2026)

| Lição | O que fizemos |
|---|---|
| Colagem e check-in compartilháveis viram "anúncio natural" | Imagens de story, replay em vídeo e GIF e link das estatísticas, que já existiam. O vídeo gravado agora sai com a marca ULTRA PLAY. |
| Clubes e desafios com ranking (GymRats e FitFolio) | **Grupos** com ranking por período, convite por link e resenha |
| Novidades usadas como canal de retenção | **Novidades** dentro do app (Ajustes → Novidades e aviso no Início a cada versão) |
| Feedback e depoimento na hora certa | **"Curtindo o ULTRA PLAY?"** depois da 3ª, 10ª e 25ª partida, no máximo 3 vezes por ano. Quem curtiu é convidado a chamar um parceiro ou deixar um depoimento; quem não curtiu cai em **Enviar sugestão** |
| Indicação com código | **Convidar parceiros** com o código da pessoa (`?ref=UP-XXXXXX`). O app guarda de onde cada um veio (`ref` e `utm`), para virar recompensa quando houver servidor |
| Sequência ("ofensiva") | Aviso no Início: "**6 semanas seguidas** · jogue nos próximos X dias para não perder". É semanal, porque ninguém joga todo dia |
| Páginas de SEO por intenção de busca | `site/placar-beach-tennis.html`, `placar-padel.html`, `placar-tenis.html`, `placar-peteca.html` e `site/sitemap.xml` |
| A falha de gravação é a maior reclamação do SwingVision | Trechos de ~5 min salvos na hora, retomada automática, aviso de espaço e status da câmera no placar |

## Rotina de posts (sugestão)

- **Segunda (X e LinkedIn):** "Semana N do ULTRA PLAY". Números da semana: partidas marcadas, pontos falados, grupos criados e, quando houver, pessoas e receita. Mais uma coisa que deu certo e uma que deu errado.
- **Quarta (TikTok e Reels):** um recurso em 15 segundos gravado na quadra ("falei 'ponto verde' e…"). Use os roteiros de `docs/CONTEUDO-LANCAMENTO.md`.
- **Sexta:** "o que vocês pediram e saiu": prints das **Novidades** e créditos para quem sugeriu.
- **Mensal:** abrir a receita no **ListaMRR** (listamrr.com.br) quando a cobrança começar. Funciona como prova social para quem acompanha os bastidores.
- **Fim de temporada:** "Retrospectiva ULTRA PLAY", com os números de cada um. É o recurso mais viral do Strava e do GymRats.

## Métricas para abrir (precisam do servidor)

1. Ativação: quem marcou a 1ª partida em até 7 dias.
2. Partidas compartilhadas ÷ partidas terminadas.
3. Pessoas que entraram por convite (`ref`) ÷ total.
4. Grupos com 4 ou mais membros ativos na semana.
5. Conversão para o Pro, quando houver cobrança.

## Depende de você

- Escolher onde postar (X pessoal, TikTok @ultraplay.app) e com que frequência dá para manter.
- Pôr o contato em `FEEDBACK_WHATSAPP` ou `FEEDBACK_EMAIL` (`app.js`). Assim as sugestões chegam direto; hoje o app só abre o compartilhar.
- Decidir a recompensa da indicação (ex.: 1 mês de Pro para cada 3 parceiros que terminarem uma partida). Precisa do servidor para ser automática; a falta disso gerou reclamação no FitFolio.
