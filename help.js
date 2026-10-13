/* ULTRA PLAY · conteúdo da Ajuda (primeiros passos, dicas e perguntas frequentes).
   Usado pela central de ajuda do app (Ajustes → Ajuda). A página site/ajuda.html tem o mesmo texto:
   ao mudar aqui, rode `node tools/ajuda.mjs` para gerar a página do site de novo. Só texto puro (sem HTML). */
(function (root) {
  'use strict';
  root.CantaHelp = {
    steps: [
      { icon: 'i-plus', title: 'Comece uma partida', text: 'Toque em Nova partida → Marcar ao vivo, escolha o esporte, o formato e os times. Dá para jogar só com as cores (Azul x Laranja) ou pôr o nome de cada um.' },
      { icon: 'i-hand', title: 'Marque com um toque', text: 'Toque no lado do time que fez o ponto. Para estatística de atleta, use Lançar (no centro): um botão para cada lance, como ace, winner e erro. Se quiser, ligue a voz (à direita) e diga “ponto azul”.' },
      { icon: 'i-undo', title: 'Corrija sem parar o jogo', text: 'Errou? Toque em Desfazer, embaixo do placar. Com a voz ligada, diga “desfazer” ou “corrige, ponto laranja”.' },
      { icon: 'i-camera', title: 'Filme, se quiser', text: 'Grave com este celular ou com outro aparelho pelo QR Code. Cada ponto marcado vira um lance em vídeo para rever e mandar.' },
      { icon: 'i-share', title: 'Salve e compartilhe', text: 'No fim, a partida fica no seu histórico com estatísticas, replay animado e a análise do jogo. Mande a imagem ou o vídeo para o grupo.' },
    ],
    tips: [
      { icon: 'i-mic', title: 'Onde deixar o celular', text: 'Na lateral, na altura da rede e perto do meio da quadra. Longe da caixa de som. Com muito barulho, um fone ou lapela sem fio ajuda muito.' },
      { icon: 'i-bolt', title: 'Frase curta, depois do lance', text: 'Fale quando a bola parar, virado para o aparelho. “Ponto azul” funciona melhor que uma frase longa.' },
      { icon: 'i-watch', title: 'Ponto pelo relógio ou fone', text: 'Em Ajustes, ligue Controle pelo relógio ou fone: próxima faixa marca para o 1º time, anterior para o 2º e tocar/pausar desfaz.' },
      { icon: 'i-camera', title: 'Lente 0.5× e brilho na gravação', text: 'Na tela de gravar, escolha 0.5× para pegar a quadra inteira (nos celulares que liberam a lente grande-angular para o navegador), 1× ou 2×. O brilho ajusta um pouco para mais ou para menos, para quadra com sol forte ou à noite.' },
      { icon: 'i-window', title: 'Placar na TV', text: 'No placar, toque no modo TV para letras grandes. No notebook, Abrir placar numa segunda janela e arraste para a TV.' },
      { icon: 'i-sliders', title: 'Formato personalizado e predefinições', text: 'Em Nova partida → Formato → Personalizado, escolha o número de sets, games ou pontos, tiebreak, vantagem, teto e troca de lado. Toque em Salvar predefinição e dê um nome (fica BT1-Amigos de Segunda): da próxima vez é um toque.' },
      { icon: 'i-users', title: 'Jogadores e quem fez o ponto', text: 'Em Times, escolha o perfil de cada jogador (ou escreva o nome de um convidado), até 2 por time. Com 2 no time, o painel Lançar pergunta quem fez o ponto ou quem errou, e cada um ganha as suas estatísticas.' },
      { icon: 'i-chart', title: 'Estatísticas completas', text: 'Em Você → Estatísticas completas: a visão geral ou um esporte, os números dele (aces, break points, saque, ataques, golpes, erros na rede e fora) e o gráfico de evolução de cada um. Filtre por período e tire resenhas e treinos com Só pra valer.' },
      { icon: 'i-target', title: 'Números confiáveis: pontos detalhados', text: 'Ponto marcado só como “ponto” não diz se foi ace, winner ou erro. Lance com detalhe (pelo painel Lançar ou pela voz) e, nas estatísticas, use o filtro 50%+ ou 80%+ para contar só as partidas bem lançadas.' },
      { icon: 'i-swords', title: 'Retrospecto com cada jogador', text: 'Nas estatísticas, Com um jogador: escolha a pessoa e veja as partidas contra ou junto, aproveitamento, a evolução e você × ela em pontos, winners e erros.' },
      { icon: 'i-bolt', title: 'On fire', text: 'Com 3 vitórias seguidas ou mais, aparece um raio com +3, +5, +10 ao lado do seu nome, no perfil e na timeline.' },
      { icon: 'i-activity', title: 'Jogando agora', text: 'Durante a partida, quem segue você vê um anel verde no seu avatar e, se você deixar, o placar ao vivo. Escolha em Ajustes → Jogando agora.' },
      { icon: 'i-users', title: 'Grupos da turma', text: 'Crie um grupo para a turma de sempre: ranking do período, resenha e partidas do grupo num lugar só. Convide pelo link.' },
      { icon: 'i-download', title: 'Guarde um backup', text: 'Suas partidas ficam neste aparelho. Em Ajustes → Exportar meus dados você guarda um arquivo e restaura em outro celular.' },
      { icon: 'i-phone', title: 'Instale na tela inicial', text: 'Instalado, o ULTRA PLAY abre em tela cheia, mais rápido e funciona sem internet na quadra.' },
    ],
    faq: [
      { q: 'O ULTRA PLAY é grátis?', a: 'Sim. Marcar o placar (por toque, painel, relógio ou voz), estatísticas, histórico, imagens para compartilhar, grupos e o replay são grátis. O Pro libera recursos a mais, como as estatísticas completas (com a análise do dia, o filtro de pontos detalhados e o retrospecto com cada jogador), até 3 predefinições de formato por esporte, gravar a partida em vídeo, momento ponto a ponto, vídeo animado em MP4 e GIF e a análise do jogo por IA.' },
      { q: 'Quais esportes ele marca?', a: 'Beach tennis, padel, tênis, peteca, vôlei de praia e futevôlei, cada um com as suas regras: games, sets, tie-break, vantagem ou ponto de ouro, troca de lado e saque.' },
      { q: 'Precisa de internet na quadra?', a: 'Não para marcar o placar: depois de aberto uma vez, o app funciona sem internet. A internet só é usada para conectar o segundo celular como câmera e, quando houver conta na nuvem, para sincronizar.' },
      { q: 'O microfone fica gravando a conversa?', a: 'Não. O reconhecimento de voz só procura os comandos do placar, enquanto o microfone está ligado no placar. Nada do que é falado é guardado ou enviado para a equipe do ULTRA PLAY.' },
      { q: 'A voz não entendeu. O que faço?', a: 'Fale mais perto e numa frase curta, depois do lance. Confira em Ajustes o microfone escolhido e faça o teste de nível. Dá para sempre tocar no lado do time ou digitar o comando.' },
      { q: 'Como uso outro celular como câmera?', a: 'No placar, toque na câmera e escolha Usar outro aparelho como câmera. Aponte o outro celular para o QR Code (ou abra o link): ele vira câmera e você continua marcando os pontos no seu. O placar mostra se a câmera está conectada e gravando.' },
      { q: 'Onde ficam os vídeos?', a: 'Só no aparelho que gravou, em trechos de 5 minutos para não perder nada se o app fechar. Você vê o espaço usado e apaga em Ajustes → Vídeos das partidas.' },
      { q: 'Dá para lançar uma partida que já acabou?', a: 'Sim. Em Nova partida, escolha Lançar partida e registre o resultado do jeito que lembrar: placar final ou de cada set. Ela entra no histórico e no ranking do grupo.' },
      { q: 'Quem vê as minhas partidas?', a: 'Você escolhe em Ajustes → Privacidade do perfil: aberto, personalizado ou privado. Em cada partida também dá para escolher se aparece para todos, só seguidores ou só você.' },
      { q: 'Por que meus aces e erros parecem baixos?', a: 'Provavelmente algumas partidas foram marcadas só com “ponto”, sem dizer se foi ace, winner ou erro. Esses pontos contam no placar, mas não nos números de lance. Nas estatísticas completas, use o filtro Pontos detalhados (50%+ ou 80%+) para olhar só as partidas bem lançadas.' },
      { q: 'O que é a análise do dia?', a: 'Um resumo do seu momento em cada esporte: evolução, erros, acertos, o que treinar e o seu ponto forte. Sai no máximo uma vez por dia por esporte, e só quando há partida nova. Fica nas estatísticas completas (Pro).' },
      { q: 'Quem vê que estou jogando agora?', a: 'Só quem segue você, e só se você deixar em Ajustes → Jogando agora. Dá para mostrar só que está jogando, sem o placar. Se alguém da partida não deixar ver o placar ao vivo, os amigos veem o placar sem os nomes dos outros jogadores.' },
      { q: 'Tem dois jogadores com o mesmo nome. E agora?', a: 'Antes de começar, o app avisa e pede um apelido para um deles só nesta partida (ex.: João Baixinho). O apelido aparece no placar e vale para a voz; o perfil e as estatísticas continuam de cada um. Para evitar isso, use nome e sobrenome em Ajustes → Nome nos pontos.' },
      { q: 'Como ponho foto no perfil?', a: 'Em Você, toque na câmera ao lado do seu avatar (ou em Ajustes → Foto do perfil). Escolha a foto, arraste e use o zoom para enquadrar e toque em Salvar foto. Ela aparece no seu perfil, nas suas partidas e na timeline. Para tirar, volte ali e toque em Remover foto.' },
      { q: 'Como apago uma partida?', a: 'Abra a partida, role até o fim e toque em Excluir partida. Para confirmar, digite “excluir de vez”: ela some do histórico, da timeline, das estatísticas e o vídeo dela sai deste aparelho. Não dá para desfazer.' },
      { q: 'Quanto custa o Pro?', a: 'Pro: R$ 24,90 por mês, R$ 119,90 por semestre ou R$ 179,90 por ano (R$ 14,99 por mês). Pro Amigos, para você e mais 5 pessoas: R$ 249,90 por semestre ou R$ 399,90 por ano (R$ 5,55 por pessoa por mês). Dá para testar 14 dias grátis, sem cartão.' },
      { q: 'Como funciona o Pro Amigos?', a: 'Quem assina convida até 5 pessoas pelo perfil ou por link. Cada uma aceita o convite e usa a própria conta, com as suas partidas e estatísticas, e tem o Pro inteiro enquanto o plano estiver ativo. Dá para tirar ou trocar alguém em Ajustes → Assinatura.' },
      { q: 'Como cancelo a assinatura?', a: 'Em Ajustes → Assinatura → Gerenciar → Cancelar renovação. O Pro continua até o fim do período já pago e nada mais é cobrado. Comprou pela internet e se arrependeu? Em até 7 dias você pode pedir o dinheiro de volta.' },
      { q: 'Troquei de celular. Perco tudo?', a: 'Não, se tiver um backup: em Ajustes → Exportar meus dados no celular antigo, depois Restaurar backup no novo. Com a conta na nuvem (em breve), isso fica automático.' },
      { q: 'Como apago a minha conta?', a: 'Em Ajustes → Excluir conta e dados. Apaga partidas, perfil e rede deste aparelho, de vez.' },
      { q: 'Achei um problema ou tenho uma ideia.', a: 'Em Ajustes → Enviar sugestão ou problema. Cada mensagem é lida pela equipe e muita coisa do app nasceu assim.' },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
