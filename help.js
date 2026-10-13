/* ULTRA PLAY · conteúdo da Ajuda (primeiros passos, dicas e perguntas frequentes).
   Usado pela central de ajuda do app (Ajustes → Ajuda). A página site/ajuda.html tem o mesmo texto:
   ao mudar aqui, rode `node tools/ajuda.mjs` para gerar a página do site de novo. Só texto puro (sem HTML). */
(function (root) {
  'use strict';
  root.CantaHelp = {
    steps: [
      { icon: 'i-plus', title: 'Comece uma partida', text: 'Toque em Nova partida → Marcar ao vivo, escolha o esporte, o formato e os times. Dá para jogar só com as cores (Azul x Laranja) ou pôr o nome de cada um.' },
      { icon: 'i-mic', title: 'Marque o ponto falando', text: 'Ligue o microfone e diga “ponto azul”, “ponto Bia” ou “ace laranja” depois de cada lance. Um bipe agudo confirma. Se preferir, toque no lado do time.' },
      { icon: 'i-undo', title: 'Corrija sem parar o jogo', text: 'Errou? Diga “desfazer” ou “corrige, ponto laranja”, ou use o botão de voltar embaixo do placar.' },
      { icon: 'i-camera', title: 'Filme, se quiser', text: 'Grave com este celular ou com outro aparelho pelo QR Code. Cada ponto marcado vira um lance em vídeo para rever e mandar.' },
      { icon: 'i-share', title: 'Salve e compartilhe', text: 'No fim, a partida fica no seu histórico com estatísticas, replay animado e a análise do jogo. Mande a imagem ou o vídeo para o grupo.' },
    ],
    tips: [
      { icon: 'i-mic', title: 'Onde deixar o celular', text: 'Na lateral, na altura da rede e perto do meio da quadra. Longe da caixa de som. Com muito barulho, um fone ou lapela sem fio ajuda muito.' },
      { icon: 'i-bolt', title: 'Frase curta, depois do lance', text: 'Fale quando a bola parar, virado para o aparelho. “Ponto azul” funciona melhor que uma frase longa.' },
      { icon: 'i-watch', title: 'Ponto pelo relógio ou fone', text: 'Em Ajustes, ligue Controle pelo relógio ou fone: próxima faixa marca para o 1º time, anterior para o 2º e tocar/pausar desfaz.' },
      { icon: 'i-window', title: 'Placar na TV', text: 'No placar, toque no modo TV para letras grandes. No notebook, Abrir placar numa segunda janela e arraste para a TV.' },
      { icon: 'i-users', title: 'Grupos da turma', text: 'Crie um grupo para a turma de sempre: ranking do período, resenha e partidas do grupo num lugar só. Convide pelo link.' },
      { icon: 'i-download', title: 'Guarde um backup', text: 'Suas partidas ficam neste aparelho. Em Ajustes → Exportar meus dados você guarda um arquivo e restaura em outro celular.' },
      { icon: 'i-phone', title: 'Instale na tela inicial', text: 'Instalado, o ULTRA PLAY abre em tela cheia, mais rápido e funciona sem internet na quadra.' },
    ],
    faq: [
      { q: 'O ULTRA PLAY é grátis?', a: 'Sim. Marcar o placar por voz ou toque, estatísticas, histórico, imagens para compartilhar, grupos e o replay são grátis. O Pro libera recursos a mais, como gravar a partida em vídeo, momento ponto a ponto, vídeo animado em MP4 e GIF, exportar planilha e a análise do jogo por IA.' },
      { q: 'Quais esportes ele marca?', a: 'Beach tennis, padel, tênis, peteca, vôlei de praia e futevôlei, cada um com as suas regras: games, sets, tie-break, vantagem ou ponto de ouro, troca de lado e saque.' },
      { q: 'Precisa de internet na quadra?', a: 'Não para marcar o placar: depois de aberto uma vez, o app funciona sem internet. A internet só é usada para conectar o segundo celular como câmera e, quando houver conta na nuvem, para sincronizar.' },
      { q: 'O microfone fica gravando a conversa?', a: 'Não. O reconhecimento de voz só procura os comandos do placar, enquanto o microfone está ligado no placar. Nada do que é falado é guardado ou enviado para a equipe do ULTRA PLAY.' },
      { q: 'A voz não entendeu. O que faço?', a: 'Fale mais perto e numa frase curta, depois do lance. Confira em Ajustes o microfone escolhido e faça o teste de nível. Dá para sempre tocar no lado do time ou digitar o comando.' },
      { q: 'Como uso outro celular como câmera?', a: 'No placar, toque na câmera e escolha Usar outro aparelho como câmera. Aponte o outro celular para o QR Code (ou abra o link): ele vira câmera e você continua marcando os pontos no seu. O placar mostra se a câmera está conectada e gravando.' },
      { q: 'Onde ficam os vídeos?', a: 'Só no aparelho que gravou, em trechos de 5 minutos para não perder nada se o app fechar. Você vê o espaço usado e apaga em Ajustes → Vídeos das partidas.' },
      { q: 'Dá para lançar uma partida que já acabou?', a: 'Sim. Em Nova partida, escolha Lançar partida e registre o resultado do jeito que lembrar: placar final ou de cada set. Ela entra no histórico e no ranking do grupo.' },
      { q: 'Quem vê as minhas partidas?', a: 'Você escolhe em Ajustes → Privacidade do perfil: aberto, personalizado ou privado. Em cada partida também dá para escolher se aparece para todos, só seguidores ou só você.' },
      { q: 'Troquei de celular. Perco tudo?', a: 'Não, se tiver um backup: em Ajustes → Exportar meus dados no celular antigo, depois Restaurar backup no novo. Com a conta na nuvem (em breve), isso fica automático.' },
      { q: 'Como apago a minha conta?', a: 'Em Ajustes → Excluir conta e dados. Apaga partidas, perfil e rede deste aparelho, de vez.' },
      { q: 'Achei um problema ou tenho uma ideia.', a: 'Em Ajustes → Enviar sugestão ou problema. Cada mensagem é lida pela equipe e muita coisa do app nasceu assim.' },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
