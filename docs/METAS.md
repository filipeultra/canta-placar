# ULTRA PLAY · simulação financeira e metas de membros

Feita em 13/10/2026 com os preços de `docs/ASSINATURA.md` e as taxas de `docs/PRECOS.md`. São estimativas para planejar, não promessa: trocando as premissas abaixo, os números mudam.


> **Revisão de 14/10/2026** (`reports/Tempo até MRR em apps.md`): os benchmarks mostram que preço e mix estão certos, mas o ritmo é otimista. A conversão de 5% fica no top quartil (mediana de Health & Fitness: 2,9%). O crescimento composto de 15% a 25% ao mês por 3 anos passa do tamanho do mercado. O churn real dos planos mensais está perto de 14% ao mês. Use como base os cenários revistos do relatório:
>
> | Prazo | Membros ativos | Pagantes | Receita total |
> |---|---|---|---|
> | 6 meses | ~900 | — | o app paga os custos |
> | 12 meses | 1,6 a 2 mil | 60 a 80 | — |
> | 24 meses | 5 a 6 mil | ~200 | R$ 3 a 4 mil/mês |
> | 36 meses | ~10 mil | ~300 | US$ 1 a 1,3 mil de MRR, contando professores e arenas |

## Premissas
- **Membro ativo:** quem abriu o app no mês (MAU).
- **Conversão:** parte dos membros ativos que paga. Três cenários:
  - **3%:** pessimista;
  - **5%:** base, comum em app de nicho com estatística;
  - **8%:** otimista, com turmas e professores puxando.
- **Mix de planos entre quem paga:**
  - mensal: 25%;
  - semestral: 15%;
  - anual: 35%;
  - Amigos: 25% das pessoas (cada grupo tem 6).
- **Canal:** 70% pelo site (Pix ou cartão, 4% + R$ 0,40) e 30% pelas lojas (15%).
- **Imposto:** Simples a 6% (confirmar com contador).
- **Custo por pessoa paga, por mês:**
  - nuvem: R$ 0,60 (uso médio de 1/3 do limite de 20 h; no pior caso, R$ 1,80);
  - IA: R$ 1,00 em média.
- **Custo fixo:**
  - Supabase Pro: R$ 140/mês até 10 mil membros, e sobe com a base;
  - conta Apple: ~R$ 45/mês;
  - domínio: ~R$ 10/mês;
  - ferramentas: ~R$ 150/mês;
  - login por e-mail ou SMS: ~R$ 0,03 por membro ativo.
- **Fora da conta:** o seu salário, marketing, contador, patrocínio e parcerias com federações.

## Quanto sobra por pessoa que paga (por mês)
| Plano | Paga por mês | Sobra |
|---|---|---|
| Pro mensal | R$ 24,90 | R$ 19,71 |
| Pro semestral | R$ 19,98 | R$ 15,68 |
| Pro anual | R$ 14,99 | R$ 11,37 |
| Amigos (por pessoa) | R$ 5,55 | R$ 3,21 |
| **Média com o mix** | **R$ 15,86** | **R$ 12,06** |

O Amigos rende pouco por pessoa, mas cada venda traz 6 contas e segura a turma inteira no app. Ele é canal de entrada e de retenção, não de margem.

## Resultado por mês (já descontados taxas, imposto, nuvem, IA e custo fixo)
| Membros ativos | 3% pagando | 5% pagando (base) | 8% pagando |
|---|---|---|---|
| 1.000 | −R$ 13 | R$ 228 | R$ 590 |
| 3.000 | R$ 651 | R$ 1.374 | R$ 2.460 |
| 5.000 | R$ 1.314 | R$ 2.521 | R$ 4.330 |
| 10.000 | R$ 2.974 | R$ 5.386 | R$ 9.005 |
| 25.000 | R$ 7.577 | R$ 13.609 | R$ 22.656 |
| 50.000 | R$ 15.249 | R$ 27.312 | R$ 45.406 |
| 100.000 | R$ 30.594 | R$ 54.719 | R$ 90.908 |

**Faturamento bruto no cenário base:**
| Membros ativos | Por mês | Por ano |
|---|---|---|
| 10 mil | R$ 7,9 mil | R$ 95 mil |
| 50 mil | R$ 39,6 mil | R$ 476 mil |
| 100 mil | R$ 79,3 mil | R$ 951 mil |

**Professores e arenas, por cima disso (estimativa):** a cada 10 mil membros, 25 professores, 6 arenas e 10 torneios avulsos por mês somam cerca de **R$ 2,3 mil por mês**. Com 100 mil membros, são R$ 22,9 mil.

## Metas de membros ativos
| Meta de resultado por mês | 3% | 5% (base) | 8% |
|---|---|---|---|
| Pagar os custos | 1.043 | 604 | 375 |
| R$ 5 mil | 16.606 | 9.330 | 5.725 |
| R$ 15 mil (dedicação integral) | 49.193 | 27.544 | 16.597 |
| R$ 30 mil (2 a 3 pessoas no time) | 98.069 | 54.905 | 33.077 |
| R$ 60 mil | 195.829 | 109.635 | 66.044 |
| R$ 120 mil | 391.339 | 219.097 | 131.972 |

**Marcos sugeridos (cenário base):**
1. **600 membros ativos:** o app se paga.
2. **10 mil:** R$ 5 mil por mês.
3. **30 mil:** dá para viver do app.
4. **55 mil:** dá para montar um time pequeno.
5. **100 mil:** cerca de R$ 55 mil por mês, mais R$ 23 mil de professores e arenas.

## Quanto tempo leva
Partindo de 500 membros ativos no lançamento (fundadores e turmas próximas):

| Crescimento por mês | 5 mil | 10 mil | 25 mil | 50 mil | 100 mil |
|---|---|---|---|---|---|
| 10% | 25 meses | 32 | 42 | 49 | 56 |
| 15% | 17 meses | 22 | 28 | 33 | 38 |
| 25% | 11 meses | 14 | 18 | 21 | 24 |

## Quanto pagar para trazer alguém
- **Valor de uma pessoa que paga ao longo do tempo:**
  - mensal: ~R$ 246, com 8% de cancelamento por mês;
  - anual: ~R$ 341, com 60% renovando.
- **Custo máximo para trazer quem paga:** até 1/3 desse valor, ou seja, R$ 80 a 110.
- **Custo máximo por membro ativo,** com 5% pagando: **R$ 4 a 5.** É o teto para o custo de um campeonato patrocinado, o cachê de atleta ou o anúncio, dividido pelas contas novas que ele trouxe.

## O que mais mexe no resultado
1. **Conversão:** de 3% para 5%, a meta de dedicação integral cai de 49 mil para 28 mil membros. O que puxa a conversão:
   - estatística que o atleta mostra para os outros;
   - ranking do grupo;
   - teste grátis de 14 dias.
2. **Mix de planos:** por mês, o mensal sobra 70% a mais que o anual. O anual, porém, segura a pessoa por mais tempo.
3. **Loja ou site:** quem assina pelo site deixa cerca de 12% a mais que quem assina pela loja.
4. **Federações e campeonatos** (`docs/MARKETING.md`, seção 8): trazem membros em bloco, a custo por membro baixo. Perto de 5 mil membros, uma federação com 3 mil atletas ativos equivale a uns 3 meses de crescimento a 15%.
