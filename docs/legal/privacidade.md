# Política de Privacidade do ULTRA PLAY

> **RASCUNHO PARA REVISÃO JURÍDICA. Versão de 13/10/2026.** Pontos técnicos conferidos no código pelo desenvolvedor; decisões de negócio continuam entre [colchetes].
> Este texto ainda não foi revisado por advogado e não deve ser publicado antes disso. Os trechos entre [colchetes] dependem de decisão ou de dados do responsável pelo ULTRA PLAY.

**Última atualização:** 13/10/2026

Esta Política explica, em linguagem direta, quais dados pessoais o ULTRA PLAY trata, para quê, com qual base legal, com quem são compartilhados, por quanto tempo ficam guardados e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados Pessoais (LGPD, Lei 13.709/2018). Ela complementa os **Termos de Uso**.

---

## Resumo rápido

- **Hoje (MVP), seus dados ficam só no seu aparelho**, no armazenamento do navegador (localStorage e IndexedDB). Não temos servidor com contas e **não recebemos** seu perfil, suas partidas ou seus vídeos.
- O **microfone** é usado só para os comandos de voz do placar. **Não gravamos nem guardamos áudio.** Dependendo do navegador, o áudio pode ser processado pelo Google ou pela Apple; com o motor offline, é processado no próprio aparelho.
- A **câmera** grava vídeo **sem som**, guardado no aparelho que gravou (recurso Pro).
- O **link de estatísticas** carrega os dados da partida dentro dele: quem recebe o link vê esses dados.
- **Sem anúncios, sem cookies de rastreamento e sem ferramentas de análise (analytics)** no MVP.
- Quando houver **conta na nuvem**, esta Política será atualizada e você será avisado antes.

---

## 1. Quem é o controlador e como falar conosco

- **Controlador:** [RAZÃO SOCIAL / NOME], [CNPJ/CPF]
- **Endereço:** [ENDEREÇO]
- **E-mail de contato:** [E-MAIL DE CONTATO]
- **Encarregado pelo tratamento de dados pessoais (DPO):** [ENCARREGADO/DPO], e-mail [E-MAIL DO ENCARREGADO]

**Observação sobre a fase atual.** No MVP, os dados ficam no seu aparelho e não são enviados a nós. Ainda assim, somos responsáveis pelo modo como o app foi projetado para tratá-los, pelas escolhas de fornecedores (voz, CDN, mensagens) e por atender você. [A revisão jurídica deve avaliar como enquadrar os papéis de controlador na fase local.]

## 2. A quem esta Política se aplica

- a você, usuário do ULTRA PLAY;
- aos **pais ou responsáveis** que autorizam o uso por menores;
- a **outras pessoas** cujos dados são registrados por usuários, como jogadores sem conta que tiveram o nome digitado numa partida ou que aparecem em vídeos.

## 3. Como o app funciona hoje e como funcionará com a nuvem

| Tema | Hoje (MVP, sem servidor) | Futuro (conta na nuvem) |
|---|---|---|
| Onde ficam perfil, partidas, estatísticas, conquistas e preferências | Só no seu aparelho (localStorage e IndexedDB) | No seu aparelho e em servidores de [PROVEDOR DE NUVEM], para sincronizar e permitir recursos sociais |
| Vídeos (Pro) | Só no aparelho que gravou | Opcionalmente na nuvem, com limite de [X] horas por conta |
| Acesso do ULTRA PLAY aos seus dados | Não temos acesso | Teremos acesso para operar o serviço, nos limites desta Política |
| Contas e login | Não existem | [Forma de login: e-mail / Google / Apple] |
| Excluir conta e dados | Apaga os dados do app no aparelho | Apaga também nos servidores, conforme seção 13 |
| Recuperação de dados perdidos | Só por backup que você fez | Pela conta na nuvem |

Quando a conta na nuvem for lançada, atualizaremos esta Política, avisaremos no app antes da mudança e, quando a base legal for o consentimento, pediremos sua autorização antes de enviar seus dados para a nuvem.

## 4. Quais dados tratamos

| Categoria | Dados | De onde vêm |
|---|---|---|
| Perfil | Nome, cidade, esportes praticados, avatar (iniciais ou foto) | Você |
| Partidas | Placar, lances ponto a ponto, horários, tipo de jogo, local/arena (opcional), legenda | Você ou o organizador autorizado do grupo (seção 10) |
| Outros jogadores | Nomes de outros jogadores digitados por você, inclusive de pessoas sem conta | Você |
| Estatísticas e conquistas | Números e conquistas calculados a partir das partidas | Gerados pelo app |
| Preferências | Configurações do app (por exemplo, esporte padrão, modo de voz) | Você |
| Grupos | Grupos/turmas de que participa e autorizações temporárias concedidas a organizadores | Você |
| Conteúdo social | Legendas, nomes de times, denúncias e bloqueios | Você |
| Voz | Áudio captado pelo microfone durante o uso do placar por voz, **não gravado nem guardado pelo app** | Microfone, com sua permissão |
| Vídeo (Pro) | Imagem da partida, **sem som**, que pode incluir outras pessoas | Câmera, com sua permissão |
| Status da conexão entre aparelhos | Gravando/parado, tempo de gravação, tamanho em MB e placar em números (cores dos times, games, pontos), **sem nomes** | Gerado pelo app |
| Dados técnicos de conexão | Endereço IP, tipo de navegador e aparelho, data e hora, recebidos pelos serviços que o app acessa (hospedagem do site, CDN, ntfy.sh, serviços de voz) | Seu navegador, automaticamente |
| Assinatura (futuro) | Plano, status, datas de cobrança e renovação, identificador da transação. **Não guardamos o número completo do cartão** | Lojas de aplicativos ou [PROCESSADOR DE PAGAMENTO] |

**Dados sensíveis.** O app não pede dados sensíveis (como saúde, origem racial ou religião). Não inclua esse tipo de informação em legendas ou nomes. A imagem de uma pessoa em vídeo pode, em alguns contextos, permitir inferências; por isso o vídeo só deve ser gravado com aviso e consentimento (seção 7). [A revisão jurídica deve avaliar se fotos e vídeos podem ser considerados dado biométrico em algum uso futuro, o que hoje não ocorre: o app não faz reconhecimento facial.]

## 5. Para que usamos os dados e com qual base legal

| Finalidade | Dados | Base legal (LGPD, art. 7º) |
|---|---|---|
| Criar e exibir seu perfil | Perfil | Execução de contrato (inciso V) |
| Registrar partidas, calcular placar, estatísticas e conquistas | Partidas, outros jogadores, estatísticas | Execução de contrato (V) |
| Registrar nomes de outros jogadores nas suas partidas | Nomes digitados por você | Legítimo interesse (IX) seu e dos demais jogadores em registrar o jogo, com dados mínimos e direito de oposição (seção 8) |
| Reconhecer comandos de voz do placar | Áudio da voz | Consentimento (I), dado ao permitir o microfone e ativar o recurso |
| Gravar vídeo da partida | Imagem | Consentimento (I) de quem grava. A obtenção do consentimento das pessoas filmadas cabe a quem grava (seção 7) |
| Gerar o link de estatísticas | Dados da partida | Execução de contrato (V), a seu pedido |
| Ligar o celular do placar ao celular câmera | Status da gravação | Execução de contrato (V) |
| Grupos e autorização temporária ao organizador | Grupos, autorizações, partidas registradas pelo organizador | Execução de contrato (V) e consentimento (I) para a autorização temporária |
| Rede social, denúncias, bloqueios e moderação | Conteúdo social, perfil | Execução de contrato (V) e legítimo interesse (IX) em manter um ambiente seguro |
| Exportar, restaurar e excluir dados | Todos os seus dados | Execução de contrato (V) e cumprimento de obrigação legal (II), no atendimento a direitos do titular |
| Assinatura Pro (futuro) | Dados de assinatura | Execução de contrato (V) e obrigação legal (II), como fiscal e consumidor |
| Guarda de registros de acesso (futuro, com servidor) | IP, data e hora | Obrigação legal (II): art. 15 do Marco Civil da Internet (Lei 12.965/2014), 6 meses |
| Defesa em processos e atendimento a autoridades | Dados necessários ao caso | Exercício regular de direitos (VI) e obrigação legal (II) |
| Dados de crianças (< 12 anos) | Os necessários para o uso | Consentimento específico e em destaque de um dos pais ou responsável (art. 14, § 1º) |
| Medição de uso (analytics), se um dia for adotada | A definir | Consentimento (I), pedido antes de ativar |

Não usamos seus dados para publicidade e não os vendemos.

## 6. Microfone e reconhecimento de voz

6.1. O microfone é usado **somente** para reconhecer os comandos de voz do placar e só funciona depois da sua permissão no navegador ou sistema. Você pode revogá-la nas configurações do aparelho e continuar usando o placar por toque.

6.2. O app **não grava, não guarda e não nos envia o áudio**.

6.3. O reconhecimento pode ser feito de duas formas:
  - **Reconhecimento do navegador ou sistema:** o navegador pode enviar o áudio a servidores do seu fornecedor para transformar fala em texto. Por exemplo, o Google (em navegadores como o Chrome) ou a Apple (no Safari/iOS) podem processar o áudio, inclusive fora do Brasil, conforme as políticas de privacidade deles. O ULTRA PLAY não controla esse processamento.
  - **Motor offline (Vosk):** o modelo de voz é baixado uma vez de um CDN (jsDelivr, cdn.jsdelivr.net, para o motor; e GitHub Pages, ccoreilly.github.io, para o modelo de português) e o reconhecimento acontece **dentro do aparelho**, sem enviar o áudio para fora. No download, o CDN recebe dados técnicos de conexão (como IP e navegador).

6.4. [DECISÃO: indicar no app, de forma visível, qual modo está ativo e permitir que o usuário escolha o offline, se o aparelho suportar.]

## 7. Câmera e vídeo das partidas (Pro)

7.1. A câmera grava **apenas imagem, sem som**, e o vídeo fica **no aparelho que gravou**. Hoje não recebemos esses vídeos.

7.2. O vídeo pode captar a imagem de outros jogadores e de pessoas próximas. **Quem grava é responsável** por avisar essas pessoas e obter o consentimento delas (e dos responsáveis, no caso de menores), e por atender pedidos de exclusão. [DECISÃO: incluir um aviso antes de cada gravação lembrando dessa responsabilidade. Hoje o app não exibe esse aviso.]

7.3. **Futuro: vídeo na nuvem.** Quando disponível, o assinante Pro poderá enviar vídeos para a nuvem, com limite de [X] horas por conta. Os vídeos na nuvem serão **excluídos [X] dias após o cancelamento ou fim da assinatura Pro**, salvo se você os apagar antes. Avisaremos antes da exclusão [por e-mail / no app].

## 8. Dados de outros jogadores (inclusive sem conta)

8.1. Quando você digita o nome de outro jogador, esse nome fica associado à partida no seu aparelho e pode aparecer no link de estatísticas que você compartilhar.

8.2. Pedimos que você use apenas o necessário (nome ou apelido) e respeite a vontade da pessoa. Quem não quiser ser identificado pode pedir ao usuário que apague ou troque o nome. No MVP, como os dados estão no aparelho do usuário, **não temos como apagá-los diretamente**; quando houver nuvem, poderemos atender pedidos de terceiros pelo [E-MAIL DE CONTATO].

8.3. Quando um usuário registra dados de terceiros apenas para fins pessoais, sem fins econômicos, esse uso pode estar fora do alcance da LGPD (art. 4º, I). Mesmo assim, aplicamos as boas práticas acima. [A confirmar na revisão jurídica, sobretudo para grupos, turmas e professores que usam o app de forma profissional.]

## 9. Link de estatísticas e prévia de link

9.1. Ao gerar um link de estatísticas, **os dados da partida (nomes dos jogadores e lances) ficam dentro do próprio link**. Quem recebe o link, e quem receber o link repassado, vê esses dados. Apagar a partida no app não apaga os links já enviados.

9.2. Quando o link é aberto, o navegador acessa o site do ULTRA PLAY, hospedado hoje no GitHub Pages (GitHub, Inc., EUA). Os dados da partida ficam depois do "#" do endereço, parte que os navegadores **não enviam** ao servidor: a hospedagem recebe só o endereço do site, não a partida. [Confirmado no código em 13/10/2026.]

9.3. **Prévia de link (Open Graph).** Apps de mensagem e redes sociais podem acessar nosso site para montar uma prévia (título, descrição e imagem) do link. A prévia mostra [informações genéricas do ULTRA PLAY / resumo da partida]. [DECISÃO]

## 10. Grupos e autorização temporária ao organizador

10.1. Ao entrar num grupo, o organizador e os moderadores podem ver [seu nome, avatar e as partidas do grupo]. [DECISÃO]

10.2. Você pode autorizar o organizador ou moderador a registrar partidas em seu nome por um tempo limitado (por exemplo, 3 horas). A autorização é baseada no seu consentimento, vale só pelo prazo escolhido e pode ser revogada antes. Partidas registradas nesse período passam a compor seu histórico e suas estatísticas.

## 11. Com quem compartilhamos dados

Não vendemos dados pessoais. Os dados podem chegar aos seguintes terceiros, apenas na medida necessária:

| Terceiro | O que recebe | Por quê | Fase |
|---|---|---|---|
| Fornecedor do reconhecimento de voz do navegador/sistema (ex.: Google, Apple) | Áudio dos comandos de voz e dados técnicos | Transformar fala em texto, se você usa esse modo | Hoje |
| CDNs que distribuem o motor e o modelo de voz offline (jsDelivr e GitHub Pages) | Dados técnicos de conexão (IP, navegador) no download | Entregar o modelo de voz | Hoje |
| ntfy.sh (serviço de mensagens) | Status da gravação (gravando/parado, tempo, MB) e placar em números, **sem nomes**, e dados técnicos de conexão | Ligar o celular do placar ao celular câmera | Hoje |
| Provedor de hospedagem do site (hoje GitHub Pages; depois, o do domínio próprio) | Dados técnicos de conexão ao abrir o app ou um link | Entregar o app | Hoje |
| Quem recebe o link de estatísticas | Dados da partida contidos no link | Compartilhamento feito por você | Hoje |
| Organizadores e membros de grupos | Dados do grupo, conforme seção 10 | Funcionamento do grupo | [Hoje / futuro] |
| Outros usuários da rede social | Perfil e partidas, conforme suas configurações de visibilidade [padrão: DECISÃO] | Recursos sociais | Futuro |
| Provedor de nuvem [PROVEDOR DE NUVEM] | Dados da conta, partidas, vídeos | Armazenar e sincronizar | Futuro |
| Apple App Store, Google Play, [PROCESSADOR DE PAGAMENTO] | Dados da assinatura e do pagamento | Cobrança da assinatura | Futuro |
| Autoridades públicas e Judiciário | Dados exigidos | Cumprimento de lei ou ordem judicial | Quando houver |
| Eventual sucessor (fusão, aquisição) | Dados necessários à continuidade | Continuidade do serviço, com aviso prévio a você | Quando houver |

Sempre que um terceiro tratar dados em nosso nome (operador), exigiremos contratualmente proteção compatível com a LGPD. Fornecedores como Google e Apple, no reconhecimento de voz do navegador, seguem suas próprias políticas.

## 12. Transferência internacional de dados

12.1. Alguns fornecedores podem tratar dados fora do Brasil, em especial:
  - os serviços de reconhecimento de voz do navegador ou do sistema (Google, Apple);
  - o CDN que distribui o modelo de voz offline;
  - o serviço ntfy.sh;
  - no futuro, provedores de nuvem e de pagamento.

12.2. Essas transferências ocorrem para executar o serviço que você pediu e com base nos mecanismos do art. 33 da LGPD, como [cláusulas-padrão contratuais aprovadas pela ANPD / consentimento específico e em destaque / outro mecanismo a definir na revisão jurídica]. Para o reconhecimento de voz do navegador, você pode evitar a transferência usando o motor offline, se disponível no seu aparelho.

## 13. Por quanto tempo guardamos e como apagar

| Dados | Hoje (no aparelho) | Futuro (na nuvem) |
|---|---|---|
| Perfil, partidas, estatísticas, conquistas, preferências | Até você apagar, usar "Excluir conta e dados", limpar os dados do navegador ou desinstalar o app | Enquanto a conta existir; apagados em até [X] dias após a exclusão da conta, e em até [Y] dias nas cópias de segurança |
| Áudio de voz | Não é guardado pelo app | Não é guardado pelo app |
| Vídeos | No aparelho que gravou, até você apagar | Até você apagar ou até [X] dias após o fim do Pro |
| Status de gravação via ntfy.sh | Mensagens temporárias: o ntfy.sh guarda cada mensagem por até 12 horas (padrão do serviço público) | Substituído por canal no próprio servidor |
| Autorização temporária ao organizador | Expira no prazo escolhido (ex.: 3 horas) | Igual; o registro da autorização é guardado por [X] para resolver contestações |
| Registros de acesso (IP, data e hora) | Não guardamos [confirmar com a hospedagem] | 6 meses (Marco Civil da Internet, art. 15) |
| Dados de assinatura | Não se aplica | Pelo prazo exigido pela legislação fiscal e do consumidor [ex.: 5 anos] |
| Denúncias e decisões de moderação | [Não se aplica / no aparelho] | Por [X] meses, para segurança e defesa de direitos |

**Como apagar hoje:** use **Excluir conta e dados** no app. Isso apaga os dados do app no seu aparelho. Não apaga backups em JSON que você salvou, links já enviados, vídeos copiados para outros lugares nem dados em outros aparelhos: apague-os manualmente.

## 14. Seus direitos (art. 18 da LGPD)

Você pode, a qualquer momento:

1. **Confirmar** se tratamos seus dados;
2. **Acessar** seus dados;
3. **Corrigir** dados incompletos, inexatos ou desatualizados;
4. Pedir **anonimização, bloqueio ou eliminação** de dados desnecessários, excessivos ou tratados em desacordo com a lei;
5. Pedir a **portabilidade** dos dados a outro fornecedor;
6. Pedir a **eliminação** dos dados tratados com base no seu consentimento;
7. Saber com quais **entidades públicas e privadas** compartilhamos dados;
8. Ser informado sobre a **possibilidade de não consentir** e as consequências (por exemplo, sem microfone, o placar funciona só por toque; sem câmera, não há vídeo);
9. **Revogar o consentimento**;
10. **Opor-se** a tratamento baseado em legítimo interesse, se houver descumprimento da lei;
11. Pedir **revisão de decisões automatizadas** que afetem seus interesses (art. 20). O app calcula estatísticas e conquistas automaticamente, mas não toma decisões automatizadas com efeitos jurídicos sobre você;
12. **Peticionar à ANPD** (Autoridade Nacional de Proteção de Dados, gov.br/anpd) e aos órgãos de defesa do consumidor.

**Como exercer hoje.** Como os dados ficam no seu aparelho, a maioria dos direitos você exerce direto no app:
  - **acesso e portabilidade:** "Exportar meus dados" (arquivo JSON);
  - **correção:** edite o perfil ou a partida;
  - **eliminação:** apague a partida ou use "Excluir conta e dados";
  - **revogação de consentimento:** desative o microfone ou a câmera nas configurações do aparelho e revogue autorizações de grupo no app (Grupo > "Cancelar" no cartão de autorização).

Para dúvidas ou outros pedidos, escreva para [E-MAIL DE CONTATO] ou para o encarregado [ENCARREGADO/DPO]. Responderemos em até [15] dias. Poderemos pedir informações para confirmar sua identidade. Na fase atual, lembre que não temos acesso aos dados do seu aparelho.

## 15. Crianças e adolescentes

15.1. O ULTRA PLAY **não é direcionado a crianças**.

15.2. **Menores de 18 anos** só devem usar o app com autorização e acompanhamento dos pais ou responsáveis. O tratamento de dados de adolescentes é feito no seu melhor interesse (art. 14 da LGPD).

15.3. **Crianças com menos de 12 anos:** dados só podem ser tratados com **consentimento específico e em destaque de pelo menos um dos pais ou responsável legal** (art. 14, § 1º). Coletamos apenas os dados estritamente necessários e não condicionamos a participação em jogos ou recursos ao fornecimento de dados além do necessário.

15.4. Se soubermos que dados de criança foram tratados sem esse consentimento, [orientaremos a exclusão / excluiremos os dados da nuvem, quando houver].

15.5. [DECISÃO: idade mínima para perfil próprio, forma de coleta e registro do consentimento parental, verificação de idade, restrições de recursos sociais e de vídeo para menores e adequação ao Estatuto Digital da Criança e do Adolescente, Lei 15.211/2025.]

15.6. Quem filmar menores em quadra deve ter autorização dos pais ou responsáveis (seção 7).

## 16. Cookies, armazenamento local, analytics e anúncios

16.1. O app usa o **armazenamento do navegador (localStorage e IndexedDB)** para guardar seus dados e preferências no aparelho e para funcionar offline. Isso é necessário para o app funcionar.

16.2. **Não usamos cookies de rastreamento, não exibimos anúncios e não usamos ferramentas de análise (analytics)** no MVP.

16.3. Se um dia adotarmos analytics, cookies não essenciais ou anúncios, **pediremos seu consentimento antes**, com opção de recusar sem perder as funções principais, e atualizaremos esta Política.

## 17. Segurança

17.1. **Hoje:** como os dados ficam no seu aparelho, a segurança depende também de você. Recomendamos usar bloqueio de tela, manter o navegador e o sistema atualizados, não emprestar o aparelho desbloqueado e guardar backups JSON em local seguro, pois eles não são criptografados. O app é servido só por conexão segura (HTTPS) e tem política de segurança de conteúdo (CSP) que impede a execução de código de fora.

17.2. **Na nuvem:** adotaremos medidas técnicas e administrativas compatíveis com o risco, como criptografia em trânsito, controle de acesso restrito, registros de acesso e [criptografia em repouso / outras medidas a definir].

17.3. Nenhum sistema é totalmente imune a falhas. Por isso tratamos o mínimo de dados necessário.

## 18. Incidentes de segurança

Se ocorrer um incidente de segurança que possa causar risco ou dano relevante a você, comunicaremos a você e à ANPD, conforme o art. 48 da LGPD e a regulamentação da ANPD [Resolução CD/ANPD nº 15/2024, a confirmar na revisão jurídica], informando o que aconteceu, quais dados foram afetados, os riscos e as medidas adotadas. No MVP, como não guardamos seus dados em servidores, os riscos principais estão no aparelho e nos serviços de terceiros listados na seção 11.

## 19. Alterações desta Política

Podemos atualizar esta Política, por exemplo quando lançarmos a conta na nuvem, a assinatura paga ou novos recursos. Mudanças relevantes serão avisadas no app antes de entrar em vigor e, quando exigirem novo consentimento, só valerão depois que você concordar. A data da última atualização aparece no topo.

## 20. Contato

- **Controlador:** [RAZÃO SOCIAL / NOME], [CNPJ/CPF]
- **Endereço:** [ENDEREÇO]
- **E-mail:** [E-MAIL DE CONTATO]
- **Encarregado (DPO):** [ENCARREGADO/DPO]
- **Autoridade Nacional de Proteção de Dados (ANPD):** www.gov.br/anpd
- **Foro:** [FORO/CIDADE], ressalvado o foro do domicílio do consumidor.
