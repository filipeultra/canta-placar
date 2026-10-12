# ULTRA PLAY · ideias para depois

Ideias combinadas com o Filipe para as próximas fases. Ainda não estão no app; dependem da conta na nuvem (ver `SOCIAL.md`).

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
