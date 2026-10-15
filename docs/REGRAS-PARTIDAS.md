# ULTRA PLAY · regras da partida entre várias pessoas

Atualizado em 13/10/2026. O banco aplica estas regras (`supabase/schema.sql`, seção "regras da partida entre várias pessoas") e os testes estão em `supabase/tests/partidas.sql`: 80 verificações, todas passando. A carga e a sobrecarga estão em `supabase/README.md`. O app segue as mesmas regras na rede de demonstração.

## 1. Quem joga e quem registra
- **Você joga sempre no 1º time.** Na Nova partida, o seu nome fica fixo (com cadeado) e não pode ser tirado.
  - **Sem conta ("Explorar sem conta"):** o formulário pede o seu nome e sobrenome antes de começar, e você entra no 1º time do mesmo jeito. Antes de 15/10/2026 dava para registrar uma partida só de outras pessoas por esse caminho (corrigido; ver `reports/QA e segurança 2026-10-15.md`).
  - **No servidor:** o banco recusa uma partida sem o dono entre os jogadores, a não ser que seja de grupo.
- **Partida de grupo:** em Nova partida → "Partida de grupo", escolha um grupo seu.
  - **"Estou jogando":** com ele desligado, você só registra a partida, por exemplo como organizador da rodada. Ela não entra nas suas estatísticas.
  - **Estatísticas do grupo:** a partida fica marcada como do grupo e conta no ranking e nas estatísticas dele.
- **Autorização:** estar no grupo já é a autorização. Qualquer membro pode marcar outro membro nas partidas do grupo, mesmo que a pessoa só aceite marcações de quem ela segue.
  - **Aceite:** a marcação ainda chega nas notificações para a pessoa aceitar, como qualquer outra.
  - **Fim da autorização por horário:** a autorização ao organizador por 1 h ou 3 h saiu.

## 2. Marcar alguém
- **Quem pode marcar você** (Ajustes → Marcações e bloqueios):
  - **Todos:** é o padrão.
  - **Conexões:** quem você segue ou quem segue você.
  - **Quem eu sigo:** só quem você segue.
  - **Membros dos seus grupos:** sempre podem marcar você nas partidas do grupo, qualquer que seja o ajuste.
- **Quem não aceita marcação sua:** a pessoa entra como convidada, só com o nome e sem link. O seletor de jogadores já avisa isso.
- **Contra flood:**
  - no máximo 60 convites por dia, por pessoa;
  - quem recusou 3 convites seus em 30 dias para de receber os seus;
  - bloqueio entre as contas impede a marcação.
- **Partida parecida:** ao aceitar, se você já registrou uma partida do mesmo esporte perto do mesmo horário, o app pergunta se é a mesma, para não contar duas vezes.

## 3. Enquanto a pessoa não aceita
- **Na partida:** o nome dela aparece opaco e não abre o perfil. Assim ninguém é exposto numa partida que ainda não reconheceu.
- **Nas estatísticas dela:** a partida não entra.
- **Nas estatísticas de quem já aceitou:**
  - a partida conta nas estatísticas gerais e detalhadas;
  - não entra nos confrontos nem nas parcerias com essa pessoa ("Com um jogador", "Confrontos", "Parceiros").
- **Recusou:** o nome fica sem link. Recusou sem querer? Há duas saídas:
  - o aviso de 3 segundos tem "Desfazer";
  - depois, a partida mostra "Desfazer recusa e aceitar", por até 30 dias.
- **Várias marcações do mesmo grupo:** viram uma notificação só ("Você foi marcado em 3 partidas no grupo…").
  - "Aceitar todas" e "Recusar todas" resolvem de uma vez.
  - A lista abre com ✓ e ✗ para cada partida.

## 4. Depois de aceita
- **Os números ficam registrados para todos que aceitaram,** inclusive na busca por jogador.
- **Placar travado:** depois que outra pessoa confirmou, o dono não muda mais o placar, os lances, o esporte nem a data.
  - Título, legenda e local continuam editáveis.
  - Para corrigir um erro, use "Corrigir placar" (seção 5).
- **Ninguém tira da partida quem já confirmou,** nem o dono. Só a própria pessoa sai, por "Excluir para mim".

## 5. Corrigir o placar
- **Quem pede:** qualquer pessoa que está na partida (e confirmou) ou o dono. Em "Corrigir placar", ela digita os sets certos e, se quiser, o motivo.
- **Quem aceita:** cada pessoa que confirmou, mais o dono, recebe o pedido nas notificações e vê o placar de agora e o proposto.
  - **Todos aceitaram:** o placar muda, mesmo travado, e a partida ganha o selo "placar corrigido". As estatísticas de todos se refazem.
  - **Um "não":** o pedido acaba e o placar fica como estava.
- **Um pedido por vez** em cada partida. Quem pediu pode cancelar.
- **Limite:** 10 pedidos por dia por pessoa.

## 6. Prazos
- **Pedidos de exclusão e de correção expiram em 14 dias** se alguém não responder. A partida e o placar ficam como estavam, e quem pediu recebe o aviso.
- **Expirado não trava:** um pedido vencido não impede um novo.
- **Limpeza diária:** o servidor fecha os vencidos uma vez por dia (`expire_open_requests`), mesmo que ninguém abra a partida.
- **Voto depois do prazo:** a pessoa vê "Este pedido expirou", e o voto não conta.

## 7. Excluir
| | Para quem excluiu | Para os outros que confirmaram |
|---|---|---|
| **Excluir para mim** | Some do histórico, do perfil, das estatísticas e das conquistas | Continua nas estatísticas gerais; o nome de quem excluiu continua na partida, clicável, porque a pessoa já tinha confirmado. Só sai dos confrontos e parcerias com quem excluiu |
| **Pedir exclusão para todos** | Fica até todos responderem | Cada um aceita ou recusa nas notificações. Todos aceitaram: a partida some de todos os lugares. Um "não" encerra o pedido e a partida fica |

- **Por que é assim:** se um jogador pudesse apagar a partida para todos, quem perdeu uma final poderia sumir com o resultado e com os números dos outros. As estatísticas perderiam credibilidade.
- **Partida sem ninguém mais confirmado** (só você e convidados): "Excluir" apaga de vez, digitando "excluir de vez".
- **Todos excluíram para si:** a partida deixa de existir. No grupo, ela fica no histórico até a exclusão do grupo.
- **Quem sai no meio de um pedido de exclusão ou de correção não trava a votação.** Contam só os que continuam na partida. Vale também para quem apaga a conta.
- **Dois votos no mesmo segundo:** os dois contam (o banco trava o pedido durante o voto).

## 8. Conta apagada
- **Na conta apagada:** a pessoa sai de todas as partidas, como "Excluir para mim" em cada uma.
- **Para os outros:**
  - nas partidas que ela já tinha confirmado, o nome dela fica, sem link, e os números deles continuam;
  - a partida não vai embora junto com a conta de quem marcou o placar.
- **Partida sem mais ninguém com conta:** some de vez.

## 9. Bloquear e denunciar
- **Bloquear** (no perfil da pessoa; a lista fica em Ajustes → Pessoas bloqueadas):
  - quem você bloqueia não acha você na busca;
  - não vê seu perfil, suas partidas nem quando você está jogando;
  - não marca você;
  - nas partidas em comum, vê seu nome como "Jogador", sem link;
  - não é avisada.
- **Denunciar perfil, grupo ou partida:** um motivo da lista e, se quiser, um texto. Os motivos:
  - conteúdo ofensivo;
  - flood de convites;
  - partidas que não aconteceram;
  - se passar por outra pessoa;
  - assédio;
  - spam;
  - menor em risco;
  - outro.

  Ao denunciar um perfil, dá para bloquear junto.
  - **Limites:** uma denúncia aberta por alvo, no máximo 20 por dia, e ninguém denuncia a si mesmo.
  - **Prioridade:** alvo denunciado por 3 pessoas ou mais em 7 dias vai para o topo da fila da equipe (`report_hotlist`, só a equipe lê).
  - **No painel de admin:** aparece o motivo de cada denúncia.

## 10. Casos da vida real que já ficam resolvidos
- **Dois celulares marcaram a mesma partida:** quem aceita a marcação do outro recebe o aviso de partida parecida e pode recusar a cópia.
- **Placar errado depois de todos aceitarem:** use "Corrigir placar". Todos aceitam e o placar muda, com o selo "placar corrigido".
- **Alguém nunca responde um pedido:** em 14 dias ele expira.
- **Organizador registra a rodada inteira sem jogar:** use partida de grupo com "Estou jogando" desligado.
- **Abriu o link de uma partida e tocou em "Só assisti":** ela fica salva só para você ("só eu"), não vai para o feed e não marca ninguém.
- **Revanche de uma partida de grupo:** continua no mesmo grupo.
- **Alguém marca você em partidas falsas:**
  - recuse; depois de 3 recusas, a pessoa para de conseguir marcar você;
  - mude "Quem pode marcar você";
  - bloqueie ou denuncie por "Partidas que não aconteceram".
- **Recusou sem querer:** use "Desfazer" no aviso ou "Desfazer recusa e aceitar" na partida (até 30 dias).
- **Saiu do grupo:** as partidas do grupo continuam no histórico e no ranking do grupo.
- **Quer esconder de alguém que está jogando:** bloqueie, ou desligue "Mostrar quando estou jogando" em Ajustes.

## 11. Ainda para decidir (antes do lançamento)
- **Menores de idade:** idade mínima, consentimento do responsável e marcação de menores (ver `docs/legal`).
