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

Falta, e depende de servidor ou de decisão:
1. **Conta na nuvem** (login Google, Apple e celular), com as partidas sincronizadas entre aparelhos.
2. **Desligar a rede de demonstração** para quem é usuário real: pessoas, zaps, convites e números "ao vivo" da tela de entrada são fictícios. Manter só no modo de demonstração.
3. **Pro de verdade:** hoje é demonstração grátis; cobrança pela loja ou por assinatura web.
4. **Termos de uso e política de privacidade (LGPD)**, com atenção a menores de idade, e canal de contato.
5. **Domínio próprio** (ex.: ultraplay.app) em vez de github.io, com cabeçalhos de segurança no servidor.
6. **Monitoramento de erros e métricas de uso** (com consentimento), para saber o que quebra no celular das pessoas.
7. **Moderação:** as denúncias hoje só mostram "enviada"; precisam chegar a alguém.
