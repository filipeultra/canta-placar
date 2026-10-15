# ULTRA PLAY · assinatura (Pro e Pro Amigos)

Atualizado em 13/10/2026. Preços e conta de margem: ver `PRECOS.md`.

## O que já existe
- **No app:**
  - **Planos:** abre de qualquer recurso Pro, de Ajustes → Assinatura e do chip do plano em Você. Tem Pro e Pro Amigos, escolha do período, preço por mês e por pessoa, e o teste grátis de 14 dias.
  - **Assinar:** resumo, data da renovação, Pix ou cartão.
  - **Seu plano:**
    - status (teste, ativa, não renova, encerrada) e próxima cobrança;
    - mudar de plano, cancelar ou religar a renovação, e os pagamentos;
    - no Amigos, as pessoas do plano: convidar pelo perfil ou por link e tirar alguém.
- **Ainda é demonstração:** o botão de pagar ativa sem cobrar e não pede dados de cartão. Tudo fica no aparelho (`prefs.sub`).
- **No banco (`supabase/schema.sql`, testes em `tests/assinatura.sql`):**
  - `subscriptions` (com os planos novos e `cancel_at_period_end`), `subscription_members` (Amigos) e `payments` (recibos);
  - `has_pro(uid)`: assinatura própria, vaga ativa num Amigos ativo, ou cortesia da equipe;
  - `profiles.trial_used_at`: o teste grátis só uma vez por conta.

## Planos e preços
| Plano | Mensal | Semestral | Anual | Por mês no anual |
|---|---|---|---|---|
| **Pro** (1 pessoa) | R$ 24,90 | R$ 119,90 | **R$ 179,90** | R$ 14,99 (−40%) |
| **Pro Amigos** (você + 5) | — | R$ 329,90 | **R$ 549,90** | R$ 45,82, ou **R$ 7,64 por pessoa** |

- **O Amigos é só semestral ou anual:** período longo segura a turma junta e evita trocar gente todo mês.
- **Preço revisto em 15/10/2026** (antes: R$ 249,90 e R$ 399,90, ou R$ 5,55 por pessoa). A R$ 5,55, cada pessoa do Amigos deixava só R$ 3,21 por mês e mal pagava a própria nuvem e a IA. O preço novo segue três travas:
  - **nunca mais caro que o solo:** R$ 7,64 por pessoa contra R$ 14,99 do Pro anual (−49%). No semestral, R$ 9,16 por pessoa contra R$ 19,98 (−54%);
  - **mais barato por pessoa que o Strava Família:** R$ 389,90/ano para 4 pessoas dá R$ 8,12 por pessoa; o Amigos dá R$ 7,64, com 6 vagas;
  - **abaixo de R$ 8 por pessoa e de R$ 50 por mês para a turma:** R$ 549,90/ano é R$ 45,82 por mês, ou R$ 91,65 por ano para cada um dividir.
- **Argumento de venda:** "o Pro para a turma toda por menos de R$ 8 por pessoa, mais barato que o Strava Família e com 2 vagas a mais".
- **Conta de margem do Amigos anual, na web:**
  - receita de R$ 549,90, menos taxa (~R$ 22), imposto (~R$ 33) e nuvem de 6 × 20 h com margem 2x (~R$ 130/ano);
  - sobram **cerca de R$ 365 por ano (66%)**, contra R$ 230 no preço antigo.
  - Se a nuvem pesar, o Amigos pode ter 10 h por pessoa em vez de 20 h.
- **Teste grátis:** 14 dias de Pro, sem cartão, uma vez por conta. No fim, nada é cobrado e o app volta para o Grátis.
- **Fundador** (lançamento, R$ 119,90/ano) e **Professor/Arena:** continuam como estão em `PRECOS.md`.

## Regras do Pro Amigos
1. **Vagas:** quem paga (dono) + até **5** pessoas. Cada uma entra com a **própria conta** e tem o Pro inteiro, com as suas partidas e estatísticas. Ninguém vê os dados do outro por estar no mesmo plano.
2. **Convite:**
   - pelo perfil (na busca de pessoas) ou por link (`?amigos=AMG-XXXXXX`) para quem ainda não tem conta;
   - o convite nasce **pendente**, e só a própria pessoa aceita.
3. **Uma vaga por vez:** ninguém fica em dois planos Amigos ao mesmo tempo (índice único em `member_id` com status ativo).
4. **Sair e tirar:** a pessoa sai quando quiser, e o dono tira quem quiser. Em ambos os casos, a pessoa só volta para o Grátis e não perde nada.
5. **Contra o abuso:** sugestão de no máximo **5 trocas de pessoa por período** (a fazer na função do servidor; hoje o limite é só o de 5 vagas). Bloqueio entre as contas impede o convite.
6. **Fim da assinatura:**
   - se o dono cancela, todos continuam com o Pro **até o fim do período pago** e depois voltam para o Grátis;
   - se o dono troca o Amigos pelo Pro individual, os convidados saem no fim do período.
7. **Quem tem Pro próprio e entra num Amigos:** o app deve avisar para cancelar a renovação do Pro próprio, para não pagar duas vezes (a fazer junto com a conta na nuvem).

## Como fica o pagamento de verdade (para ligar)
### Web (PWA): primeiro canal, maior margem
- **Provedor:** Mercado Pago (cartão recorrente e Pix) ou Asaas (Pix Automático). Para estimar, use taxa de ~4% + R$ 0,40 (`PRECOS.md`).
- **Função `checkout`** (Supabase Edge Function, com o login da pessoa):
  - recebe `{ plan, period, method }`, confere o preço pela tabela do servidor (nunca pelo valor que veio do app) e cria a cobrança ou assinatura no provedor;
  - devolve o link de pagamento (cartão) ou o QR Code do Pix.
- **Função `pagamento-webhook`** (sem login, com a assinatura do provedor conferida):
  - pagamento aprovado → grava `payments` e cria ou estende `subscriptions` (`status = 'ativa'`, `current_period_end` + período);
  - falhou → `atrasada`, com 3 dias de tolerância, e depois `encerrada`;
  - cancelamento → `cancel_at_period_end = true`, `status = 'cancelada'`;
  - estorno → `payments.status = 'estornado'` e a assinatura termina;
  - tudo idempotente pelo `provider_ref` (o mesmo aviso duas vezes não cobra nem estende duas vezes).
- **Pix na renovação:** sem Pix Automático, o servidor manda um novo Pix 3 dias antes de vencer (notificação e e-mail). Se não for pago, o Pro termina no fim do período.
- **No app:** trocar o bloco "Versão de teste" por "Pagar com Pix" (QR Code e copia-e-cola, com contagem de 30 min) e "Pagar com cartão" (abre o checkout do provedor). O Pro liga quando o webhook confirma; até lá, a tela mostra "Aguardando pagamento".

### Lojas (App Store e Google Play)
- **Compra dentro do app:** nas lojas tem de ser pela compra da própria loja. O mais simples é usar RevenueCat, que unifica Apple e Google e manda webhook para o mesmo `pagamento-webhook`.
- **Assinaturas na loja:**
  - Apple: um grupo de assinaturas com Pro mensal, semestral e anual, e Amigos semestral e anual;
  - Google: produtos equivalentes;
  - mesmo preço da web.
- **Família da Apple:** o "Compartilhamento Familiar" da Apple é outra coisa e não deve ser ligado no Amigos (o Amigos tem as próprias vagas).
- **Taxas:** com a regra do Cade no Brasil (06/2026), a Apple permite link para pagar no site, com 15% sobre essa venda. Ver `PRECOS.md`, seção 5.
- **Restaurar compra:** botão em Seu plano quando o app estiver nas lojas.

## Direitos do consumidor (Brasil)
- **Direito de arrependimento (CDC, art. 49):** em compra pela internet, a pessoa pode desistir em até **7 dias** e receber o valor de volta. O `pagamento-webhook` trata o estorno; a tela Seu plano deve ter "Pedir reembolso" nos 7 primeiros dias.
- **Clareza:** preço total, período e renovação automática aparecem antes de pagar (já estão na tela Assinar). Cancelar tem de ser tão fácil quanto assinar (dois toques em Seu plano).
- **Nota fiscal:** emitida pelo provedor ou por integração com o emissor (ver com o contador).

## Telemetria (sem dados pessoais)
- **Eventos:** `pro_view` (de qual recurso veio), `trial_start`, `sub_start` (plano, período, método), `sub_cancel`, `amigos_invite`.
- **No painel de admin:** funil `pro_view` → `trial_start` → `sub_start`, cancelamentos e MRR pela `plan_prices` (com os planos novos).

## Pendências
- Escolher o provedor (Mercado Pago ou Asaas) e criar as funções `checkout` e `pagamento-webhook`.
- Texto dos Termos: renovação, cancelamento, reembolso de 7 dias e regras do Amigos.
- Validar os preços do Amigos com 5 a 10 turmas (teste A/B entre R$ 499,90 e R$ 549,90 no anual; a partir de R$ 589,90 o Amigos passa do Strava Família por pessoa).
