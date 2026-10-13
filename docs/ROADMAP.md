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

## 4. Gravação da partida em vídeo (Pro)

### Já existe (versão básica, sem servidor)
- **Gravar com o próprio celular do placar:** botão de câmera no placar. A imagem aparece só nos primeiros 8 segundos, para posicionar o celular; depois fica um selo "● 00:11" no canto (tocando, a imagem volta). Só imagem, sem som, para o microfone continuar livre para a voz.
- **Outro aparelho como câmera:** QR Code ou link. O outro celular ou notebook vira câmera em tela cheia, com selo de gravando, cronômetro e espaço usado. Pode usar os dois ao mesmo tempo.
- **Trechos de ~5 minutos sem perder lance:** o corte acontece no tempo morto logo depois de um ponto marcado (inclui troca de lado) a partir de 4 min; se não houver, corta aos 6 min com 8 s de sobreposição. Se o app sair da tela, a gravação para e volta sozinha (ou com um toque) ao reabrir. Aviso quando há pouco espaço no aparelho.
- **Placar e câmera conectados:** o celular do placar mostra quando o outro aparelho conectou, se está gravando (com cronômetro) ou parou, e avisa quando ele some por mais de 2 min. Dá para mandar gravar e parar lá pelo placar, e a câmera para sozinha quando a partida acaba. Cada ponto marcado avisa a câmera, que aproveita o tempo morto para virar o trecho. O canal usa o ntfy.sh (serviço público de mensagens, grátis): cada partida tem um canal com nome sorteado, e só passa o status da gravação, sem nomes nem placar. Com servidor próprio, troca-se só o `relay.js`.
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
