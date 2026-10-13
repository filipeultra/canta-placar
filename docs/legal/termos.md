# Termos de Uso do ULTRA PLAY

> **RASCUNHO PARA REVISÃO JURÍDICA. Versão de 13/10/2026.** Pontos técnicos conferidos no código pelo desenvolvedor; decisões de negócio continuam entre [colchetes].
> Este texto ainda não foi revisado por advogado e não deve ser publicado antes disso. Os trechos entre [colchetes] dependem de decisão ou de dados do responsável pelo ULTRA PLAY.

**Última atualização:** 13/10/2026
**Responsável pelo serviço:** [RAZÃO SOCIAL / NOME], inscrito(a) no [CNPJ/CPF], com endereço em [ENDEREÇO], e-mail [E-MAIL DE CONTATO] ("ULTRA PLAY", "nós").

Estes Termos explicam as regras de uso do ULTRA PLAY. A forma como tratamos dados pessoais está na **Política de Privacidade**, que faz parte destes Termos. Leia os dois documentos com atenção.

---

## 1. Aceitação

1.1. Ao usar o ULTRA PLAY você declara que leu e concorda com estes Termos e com a Política de Privacidade. Se não concordar, não use o app.

1.2. Se você usa o app em nome de um grupo, turma, escola, clube ou arena, declara que tem autorização para aceitar estes Termos em nome dele.

## 2. Definições

- **App ou ULTRA PLAY:** o aplicativo web progressivo (PWA), ou seja, um site que pode ser instalado na tela do celular e funcionar como app, inclusive as versões que venham a ser distribuídas em lojas de aplicativos.
- **Usuário ou você:** quem usa o app.
- **Partida:** o registro de um jogo feito no app, com placar, lances ponto a ponto, horários, tipo de jogo, local/arena (opcional) e legenda.
- **Conteúdo do Usuário:** tudo o que você digita, grava ou publica no app, como nomes de jogadores e times, legendas, partidas e vídeos.
- **Pro:** conjunto de recursos adicionais descritos na seção 12.
- **Grupo:** turma, grupo ou comunidade de jogadores criada dentro do app, com organizador e/ou moderadores.
- **Aparelho:** o celular, tablet ou computador em que você usa o app.

## 3. O que é o ULTRA PLAY

3.1. O ULTRA PLAY é um app de placar por voz e de estatísticas de partidas de beach tennis, padel, tênis, peteca, vôlei de praia e futevôlei, com recursos de rede social para compartilhar partidas, acompanhar jogadores e participar de grupos.

3.2. **Fase atual (MVP).** Na versão atual, o app **não tem servidor com contas de usuário**. Seu perfil, suas partidas, estatísticas, conquistas, preferências e vídeos ficam guardados **apenas no armazenamento do navegador do seu aparelho** (localStorage e IndexedDB). Por isso:
  - nós não temos acesso a esses dados e não conseguimos recuperá-los se forem perdidos;
  - se você limpar os dados do navegador, desinstalar o app, trocar ou perder o aparelho, os dados podem ser perdidos de forma definitiva, a menos que você tenha feito um backup (seção 15);
  - os dados de um aparelho não aparecem automaticamente em outro.

3.3. **Fase futura (conta na nuvem).** Pretendemos oferecer uma conta na nuvem, que guardará seus dados em servidores para sincronizar aparelhos e viabilizar recursos sociais. Quando isso existir, avisaremos com antecedência, explicaremos o que muda e, quando a lei exigir, pediremos seu consentimento. A migração dos dados do aparelho para a nuvem será [opcional e feita por você / automática após aviso]. Até lá, as cláusulas destes Termos que tratam da nuvem descrevem como ela funcionará, e não um serviço já disponível.

3.4. O app é uma ferramenta de apoio. O placar, as estatísticas e as conquistas dependem do que é registrado (por voz ou toque) e podem conter erros. Eles não são documento oficial de torneio, ranking ou federação, salvo acordo específico com o organizador.

## 4. Perfil e quem pode usar

4.1. Para usar o app você cria um perfil com nome, cidade, esportes praticados e avatar (iniciais ou foto). Use informações verdadeiras e não se passe por outra pessoa.

4.2. **Idade.** O ULTRA PLAY não é direcionado a crianças.
  - **Maiores de 18 anos** podem usar o app livremente.
  - **Adolescentes de 12 a 17 anos** só podem usar o app com autorização e acompanhamento dos pais ou responsáveis legais, que, ao permitir o uso, também aceitam estes Termos em nome do adolescente.
  - **Crianças com menos de 12 anos** só podem ter dados registrados no app com o consentimento específico e em destaque de pelo menos um dos pais ou responsável legal, conforme o art. 14 da LGPD, e o uso deve ser feito pelo responsável ou sob a supervisão dele.
  - [DECISÃO: definir a idade mínima para criar perfil próprio (ex.: 12, 16 ou 18 anos), como será coletado e registrado o consentimento dos responsáveis e quais mecanismos de verificação de idade e supervisão parental serão adotados para atender ao Estatuto Digital da Criança e do Adolescente (Lei 15.211/2025), a confirmar na revisão jurídica.]

4.3. Recursos sociais (perfil público, feed, seguir pessoas) para menores de 18 anos ficam [desativados / restritos a grupos aprovados pelo responsável]. [DECISÃO]

4.4. Você é responsável pelo uso do app no seu aparelho. Se outras pessoas usam o mesmo aparelho, elas podem ver seus dados.

## 5. Placar por voz e uso do microfone

5.1. O app usa o microfone **somente** para reconhecer comandos de voz do placar (por exemplo, marcar um ponto). O microfone só é ativado depois que você dá permissão no navegador ou no sistema, e você pode retirar essa permissão a qualquer momento nas configurações do aparelho. Sem ela, o placar pode ser usado por toque.

5.2. O reconhecimento de voz pode funcionar de duas formas, conforme seu aparelho, navegador e configuração:
  - **reconhecimento do navegador/sistema:** o áudio pode ser enviado e processado pelo fornecedor do navegador ou do sistema (por exemplo, Google ou Apple), segundo as regras desse fornecedor;
  - **motor offline (Vosk):** o reconhecimento acontece no próprio aparelho, depois que o modelo de voz é baixado de um CDN (rede de distribuição de conteúdo).

5.3. O ULTRA PLAY **não grava nem guarda o áudio**. O reconhecimento pode errar, sobretudo com ruído, vento ou várias pessoas falando. Confira o placar.

## 6. Gravação de vídeo das partidas (recurso Pro)

6.1. O recurso de vídeo usa a câmera do aparelho para gravar a partida **apenas com imagem, sem som**. O vídeo fica guardado **no aparelho que gravou**.

6.2. **Imagem de outras pessoas.** A gravação pode captar a imagem de outros jogadores, árbitros, alunos e pessoas próximas à quadra. **Você é o responsável por**:
  - avisar as pessoas que serão filmadas antes de começar a gravar;
  - obter o consentimento delas e, no caso de menores de idade, dos pais ou responsáveis;
  - respeitar as regras da arena, clube ou local, que pode proibir ou limitar filmagens;
  - não publicar, enviar ou usar o vídeo de forma que viole direitos de imagem, honra ou privacidade de terceiros.

6.3. Se alguém pedir para não ser filmado ou para ter o vídeo apagado, você deve atender ao pedido.

6.4. **Vídeo na nuvem (futuro).** Quando houver conta na nuvem, assinantes Pro poderão guardar vídeos em nossos servidores, com limite de [X] horas de armazenamento por conta. Após o cancelamento ou fim da assinatura Pro, os vídeos guardados na nuvem serão excluídos em [X] dias. Recomendamos baixar os vídeos que quiser manter antes desse prazo. Vídeos guardados apenas no aparelho não são afetados pelo cancelamento.

## 7. Dados de outros jogadores

7.1. Você pode digitar nomes de outros jogadores, inclusive de pessoas que não usam o app, para registrar partidas. Use apenas nomes, apelidos ou identificações que a pessoa não se oponha a ver associados à partida.

7.2. Não registre informações ofensivas, falsas, discriminatórias ou desnecessárias sobre terceiros. Se a pessoa pedir, corrija ou apague o nome dela das suas partidas.

## 8. Compartilhamento de estatísticas por link

8.1. Você pode gerar um link para compartilhar as estatísticas de uma partida. **Os dados da partida, como nomes dos jogadores e lances, ficam dentro do próprio link.** Qualquer pessoa que receber o link, inclusive se ele for repassado, poderá ver esses dados.

8.2. Antes de compartilhar, verifique se os outros jogadores concordam. Não é possível "desfazer" um link já enviado: apagar a partida no app não apaga as cópias do link que estão com outras pessoas.

8.3. Ao colar o link em apps de mensagem ou redes sociais, eles podem gerar uma prévia (título e imagem) a partir do nosso site. A prévia mostra [informações genéricas do ULTRA PLAY / resumo da partida]. [DECISÃO]

## 9. Conexão entre aparelhos (placar e câmera)

9.1. Para usar um celular como placar e outro como câmera, o app troca mensagens entre os dois por meio de um serviço de mensagens de terceiros (ntfy.sh). Essas mensagens contêm **apenas o status da gravação** (gravando ou parado, tempo e tamanho em MB) e o **placar em números** (cores dos times, games e pontos, para aparecer no vídeo), **sem nomes** de jogadores.

9.2. Esse recurso depende do funcionamento do serviço de terceiros e da internet. Não garantimos que a conexão funcione sempre ou sem atrasos.

## 10. Grupos e turmas

10.1. Você pode entrar em grupos e turmas. O organizador e os moderadores do grupo são responsáveis por administrá-lo e por respeitar estes Termos.

10.2. **Autorização temporária ao organizador.** Você pode autorizar o organizador ou moderador de um grupo a registrar partidas em seu nome por um período limitado (por exemplo, 3 horas). Durante esse período, as partidas registradas por ele serão associadas ao seu perfil e às suas estatísticas. Você pode revogar a autorização antes do fim do prazo, na página do grupo (botão "Cancelar" no cartão de autorização).

10.3. O organizador ou moderador que recebe a autorização compromete-se a registrar apenas partidas reais de que você participou e a não usar a autorização para outros fins. Partidas registradas indevidamente podem ser [contestadas / apagadas por você].

10.4. O ULTRA PLAY não organiza, não fiscaliza e não responde pelas aulas, treinos, torneios ou eventos dos grupos, nem por pagamentos feitos entre usuários e organizadores fora do app.

## 11. Rede social, conteúdo e regras de convivência

11.1. **Seu conteúdo é seu.** Você mantém os direitos sobre o Conteúdo do Usuário. Para que o app funcione, você nos concede uma licença gratuita, não exclusiva, pelo tempo em que o conteúdo estiver no app, para armazená-lo, exibi-lo e transmiti-lo a quem você escolher, apenas para operar e melhorar o serviço. Na fase atual (MVP), esse conteúdo fica no seu aparelho e não é recebido por nós.

11.2. **Regras de convivência.** É proibido usar o app para:
  - ofender, ameaçar, assediar, humilhar ou discriminar pessoas (por raça, cor, etnia, religião, origem, gênero, orientação sexual, deficiência, idade ou qualquer outra condição);
  - publicar legendas, nomes de times ou outros conteúdos ilegais, violentos, sexuais, de ódio ou que exponham a intimidade de alguém;
  - se passar por outra pessoa, criar perfis falsos ou registrar partidas falsas para manipular estatísticas, rankings ou conquistas;
  - publicar dados pessoais de terceiros sem autorização;
  - enviar spam, propaganda não autorizada, golpes ou links maliciosos;
  - violar direitos autorais, de marca, de imagem ou outros direitos de terceiros;
  - tentar acessar dados de outros usuários, burlar limites do app, fazer engenharia reversa para fins ilícitos, sobrecarregar ou atacar o serviço;
  - qualquer outra conduta contrária à lei.

11.3. **Denúncias e bloqueios.** Você pode denunciar perfis e bloquear outros usuários no perfil da pessoa ("Bloquear" e "Denunciar perfil"). Quem você bloqueia deixa de aparecer para você e não pode marcar você em partidas. Analisaremos as denúncias em prazo razoável e poderemos remover conteúdos, limitar recursos ou suspender perfis que violem estas regras, observado o direito de você pedir revisão da decisão pelo [E-MAIL DE CONTATO]. Na fase atual (MVP), sem servidor, [denúncias e bloqueios funcionam apenas no seu aparelho / ficam disponíveis quando houver conta na nuvem]. [DECISÃO]

11.4. Você é responsável pelo conteúdo que publica. Podemos cumprir ordens judiciais de remoção ou de fornecimento de dados, nos termos da lei.

## 12. Plano Pro

12.1. **Fase atual: demonstração gratuita.** Hoje os recursos Pro estão disponíveis em demonstração gratuita, sem cobrança. A demonstração pode ser alterada ou encerrada a qualquer momento, com aviso no app. Nenhuma cobrança será feita sem que você contrate expressamente uma assinatura.

12.2. **Fase futura: assinatura paga.** Quando o Pro passar a ser pago, as condições abaixo valerão. Antes da contratação, mostraremos de forma clara o preço, a periodicidade, os recursos incluídos e as regras de renovação e cancelamento.
  - **Planos e preço:** [mensal / anual / outros], no valor de [R$ X], com impostos [incluídos].
  - **Período de teste:** [haverá / não haverá] período de teste de [X] dias. [Se houver: ao final, a assinatura passa a ser cobrada automaticamente, salvo cancelamento antes do fim do teste.]
  - **Formas de contratação:** pelas lojas de aplicativos (Apple App Store, Google Play) e/ou por pagamento na web, por meio de [PROCESSADOR DE PAGAMENTO]. Não guardamos os dados completos do seu cartão.

12.3. **Renovação automática.** A assinatura é renovada automaticamente ao fim de cada período, pelo mesmo prazo e pelo preço vigente, até que você a cancele. Em caso de reajuste, avisaremos com pelo menos [30] dias de antecedência, e você poderá cancelar antes que o novo valor seja cobrado.

12.4. **Cancelamento.** Você pode cancelar quando quiser, de forma simples:
  - compras na **App Store** ou **Google Play**: pelas configurações de assinatura da loja;
  - compras na **web**: [no app, em Configurações > Assinatura / pelo E-MAIL DE CONTATO].
  O cancelamento impede as próximas renovações. Você continua com acesso ao Pro até o fim do período já pago, salvo nos casos de reembolso abaixo.

12.5. **Direito de arrependimento (7 dias).** Conforme o art. 49 do Código de Defesa do Consumidor e o Decreto 7.962/2013, nas contratações feitas pela internet você pode desistir em até **7 (sete) dias corridos** contados da contratação, com reembolso integral do valor pago, inclusive na primeira cobrança após período de teste [a confirmar na revisão jurídica].
  - Compras na **web**: peça pelo [E-MAIL DE CONTATO] ou [no app]; o estorno será feito pelo mesmo meio de pagamento, em até [X] dias.
  - Compras nas **lojas**: o pagamento é processado pela Apple ou pelo Google, e o reembolso é solicitado e concedido conforme os procedimentos da loja. Se você tiver dificuldade, fale conosco pelo [E-MAIL DE CONTATO] e ajudaremos no que estiver ao nosso alcance, sem prejuízo dos seus direitos como consumidor.

12.6. **Outros reembolsos.** Fora do prazo de arrependimento, não há reembolso proporcional de períodos já iniciados, exceto [em caso de falha grave do serviço, cobrança indevida ou quando a lei exigir]. Cobranças indevidas serão devolvidas conforme o CDC.

12.7. **Fim do Pro.** Ao fim da assinatura, os recursos Pro deixam de funcionar. Os dados que estão no seu aparelho permanecem nele. Os vídeos na nuvem seguem a regra da seção 6.4.

12.8. **Regras das lojas.** Quando você contrata pela App Store ou Google Play, também valem os termos da respectiva loja. Apple e Google não são responsáveis pelo ULTRA PLAY nem pelo seu suporte, exceto no que diz respeito ao processamento do pagamento. [Incluir cláusulas obrigatórias exigidas pelas lojas na revisão jurídica.]

## 13. Propriedade intelectual

13.1. O app, sua marca, nome, logotipo, layout, textos, código e demais elementos criados por nós são protegidos por lei e pertencem a [RAZÃO SOCIAL / NOME] ou a seus licenciantes. Concedemos a você uma licença pessoal, gratuita (ou vinculada à assinatura Pro), não exclusiva e intransferível para usar o app conforme estes Termos.

13.2. Componentes de terceiros (por exemplo, bibliotecas de código aberto e o motor de voz Vosk) são usados conforme as licenças de cada um.

## 14. Serviços de terceiros

O app depende de serviços de terceiros, como o reconhecimento de voz do navegador ou do sistema (Google, Apple), o CDN que fornece o modelo de voz offline, o serviço de mensagens ntfy.sh, as lojas de aplicativos e, no futuro, provedores de nuvem e de pagamento. Esses serviços têm termos e políticas próprios. Não controlamos sua disponibilidade, mas escolhemos fornecedores com cuidado e respondemos perante você nos limites da lei.

## 15. Seus dados: backup, exportação e exclusão

15.1. **Exportar meus dados:** você pode baixar uma cópia dos seus dados em arquivo JSON a qualquer momento.

15.2. **Restaurar backup:** você pode importar um arquivo de backup para recuperar seus dados no mesmo ou em outro aparelho. Importe apenas arquivos gerados pelo ULTRA PLAY e de origem confiável. Guarde seus backups em local seguro: eles contêm seus dados e nomes de outros jogadores.

15.3. **Excluir conta e dados:** na fase atual, essa opção **apaga os dados do app no seu aparelho**. Ela não apaga cópias que você tenha feito (backups, links compartilhados, vídeos copiados para outros lugares) nem dados que estejam em outros aparelhos. Quando houver conta na nuvem, a exclusão também apagará os dados nos nossos servidores, conforme a Política de Privacidade.

15.4. Como, no MVP, os dados ficam só no seu aparelho, **fazer backups é responsabilidade sua**. Não conseguimos recuperar dados perdidos.

## 16. Disponibilidade e mudanças no app

16.1. Trabalhamos para manter o app funcionando, mas ele pode ter falhas, ficar indisponível, ou funcionar de modo diferente conforme o aparelho e o navegador (por exemplo, em relação a microfone, câmera e instalação como app).

16.2. Podemos alterar, incluir ou remover funcionalidades. Se uma mudança retirar recurso essencial de uma assinatura paga em andamento, avisaremos com antecedência e você poderá cancelar com reembolso proporcional do período não usado. [a confirmar]

16.3. Se decidirmos encerrar o serviço, avisaremos com pelo menos [30] dias de antecedência para que você exporte seus dados.

## 17. Responsabilidades

17.1. Respondemos pelos danos causados por falhas do serviço nos termos do Código de Defesa do Consumidor e da legislação aplicável. Nada nestes Termos limita direitos que a lei garante a você como consumidor.

17.2. Observado o item anterior, não somos responsáveis por:
  - perda de dados guardados no seu aparelho causada por limpeza do navegador, desinstalação, defeito, perda ou troca do aparelho, ou falta de backup;
  - conteúdo publicado, gravado ou compartilhado por usuários, inclusive vídeos e links, e por violações de direito de imagem cometidas por quem filmou;
  - erros de placar ou estatística decorrentes de registro incorreto, falha de reconhecimento de voz ou uso indevido;
  - indisponibilidade de serviços de terceiros, da internet ou do aparelho;
  - lesões ou acidentes durante a prática esportiva. O app não dá orientação médica ou de treinamento.

## 18. Suspensão e encerramento

18.1. Você pode parar de usar o app e excluir seus dados quando quiser.

18.2. Podemos suspender ou encerrar o acesso de quem violar estes Termos ou a lei, de forma proporcional à gravidade, informando o motivo sempre que possível e permitindo pedido de revisão. Se a assinatura Pro for encerrada por violação grave, [não haverá / haverá] reembolso do período restante, observado o CDC.

## 19. Alterações destes Termos

Podemos atualizar estes Termos. Mudanças relevantes serão avisadas no app com pelo menos [15] dias de antecedência, salvo quando a mudança for exigida por lei com prazo menor. Se você não concordar, poderá parar de usar o app, cancelar a assinatura e exportar seus dados. A data da última atualização aparece no topo.

## 20. Lei aplicável e foro

Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca de [FORO/CIDADE], ressalvado o direito do consumidor de propor ação no foro do seu domicílio, conforme o CDC. Antes de recorrer à Justiça, recomendamos falar conosco; você também pode usar a plataforma consumidor.gov.br [se a empresa estiver cadastrada] e os Procons.

## 21. Contato

- **Responsável:** [RAZÃO SOCIAL / NOME], [CNPJ/CPF]
- **Endereço:** [ENDEREÇO]
- **E-mail:** [E-MAIL DE CONTATO]
- **Encarregado pelo tratamento de dados (DPO):** [ENCARREGADO/DPO]
