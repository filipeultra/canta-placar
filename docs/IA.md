# ULTRA PLAY · análise do jogo (automática e por IA)

## O que já está no app

**Análise do jogo (automática):** aparece no resumo de toda partida marcada ao vivo, com 10 pontos ou mais. É feita no próprio aparelho, sem internet e sem custo. Ela traz:
- um título ("Verde venceu Laranja de virada, 7-5");
- de 3 a 6 frases sobre onde o jogo foi decidido:
  - pontos importantes (break points e set points);
  - erros (na rede, pra fora, duplas faltas);
  - winners e aces;
  - saque;
  - maior sequência e trocas de liderança;
  - reta final;
  - destaque da partida;
- uma **dica** para o seu time (ou para quem perdeu), escolhida pelo maior ponto fraco.

Quanto mais detalhe na marcação ("ace verde", "erro na rede laranja", "ponto smash da Ana"), melhor a análise. Com poucos detalhes, o app avisa.

**Análise com IA (pronta, desligada):** botão "Análise com IA" (Pro) no mesmo cartão. Aparece quando `AI_URL` em `app.js` aponta para a função do servidor (`supabase/functions/analise`). Como funciona:
1. O aparelho manda **só os números** da partida. Os jogadores viram J1, J2… e os times, T1/T2: **nenhum nome sai do aparelho**. A resposta volta com os nomes trocados de novo.
2. O servidor confere se a pessoa é Pro e se está dentro da cota do mês (60 análises). Depois pede o texto ao Claude (modelo Haiku, o menor e mais barato) e guarda o uso em `ai_usage` para medir o custo.
3. Pedido ao modelo: até 110 palavras, só com os números recebidos, terminando com uma sugestão de treino ("Treino: …").

## Quanto custa a IA (estimativa)

Premissas [estimativa]:
- Por análise, a entrada tem cerca de 1.500 tokens: as instruções (~350, que ficam em cache) mais os números da partida (~900 a 1.300). A saída tem cerca de 250 tokens.
- Preço de referência de modelo pequeno (classe Haiku): **US$ 1 por milhão de tokens de entrada e US$ 5 por milhão de saída**. É o preço do Claude Haiku 4.5. **Confira o preço atual do modelo escolhido** em https://www.anthropic.com/pricing antes de lançar.
- Câmbio: US$ 1 = R$ 5,50.

| Cenário | Custo |
|---|---|
| 1 análise | ~US$ 0,003 ≈ **R$ 0,015** |
| Pro que analisa 20 partidas no mês | **R$ 0,30 por mês** |
| Pro no limite (60 por mês) | R$ 0,90 por mês |
| 1.000 assinantes Pro × 20 análises | ~R$ 300 por mês |
| Com um modelo médio (classe Sonnet, ~3x mais caro) | ~R$ 0,05 por análise |

**Conclusão:** cabe com folga no Pro de R$ 24,90, menos de 2% da receita mesmo no limite.

**Sugestão:**
- análise automática grátis para todos;
- análise por IA no Pro, com 60 por mês;
- 3 análises por IA grátis para quem acabou de criar conta, para mostrar o valor do Pro (custo de ~R$ 0,05 por pessoa nova).

## Para ligar
1. Criar a conta na API da Anthropic e gerar a chave.
2. `supabase secrets set ANTHROPIC_API_KEY=...` e `supabase functions deploy analise`.
3. Rodar `schema.sql` (já inclui a tabela `ai_usage`).
4. No app:
   - pôr o endereço da função em `AI_URL`;
   - fazer `aiAuth()` mandar o token de login;
   - liberar o endereço no `connect-src` do `index.html`.
5. Atualizar a Política de Privacidade: os números da partida (sem nomes) passam pela Anthropic, nos EUA.

## Depois
- **Comparar com o histórico** ("você errou 12, sua média é 8") e com o adversário de sempre (confrontos).
- **Avisos ao vivo** durante o jogo, com os mesmos fatos (ver ROADMAP, item 3).
- **Assistente de IA no perfil**, com perguntas sobre as próprias estatísticas ("contra quem eu mais perco?"), cobrado por cota no Pro.
