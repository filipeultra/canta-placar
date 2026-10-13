# ULTRA PLAY · App Store (Apple) e Google Play

**Resposta curta:** hoje o ULTRA PLAY é um app de navegador (PWA). Ele já funciona no iPhone e no Android pela tela inicial, sem loja. Para entrar nas lojas:
- **Google Play:** dá para entrar rápido, assim que houver domínio próprio e uma decisão sobre a cobrança.
- **App Store (Apple):** dá para entrar, mas precisa de um "casco" nativo (Capacitor) e de alguns ajustes. Mandar só o site embrulhado costuma ser recusado.

Nada aqui é garantia de aprovação: a revisão é das lojas. Esta lista cobre os motivos mais comuns de recusa.

## O que já está ok (as lojas pedem e o app tem)

- Excluir conta e dados por dentro do app (Ajustes → Excluir conta e dados).
- Bloquear e denunciar perfil (exigência para conteúdo de usuários). As denúncias ainda não chegam a ninguém, ver abaixo.
- Política de privacidade e termos em rascunho (`docs/legal/`), pedido de consentimento para as estatísticas de uso, nada de anúncios ou rastreamento.
- Microfone e câmera só depois da permissão, com explicação na tela. Funciona sem permissão (toque) e sem internet.
- Manifesto completo para o empacotamento: ícones (inclusive o adaptável do Android), atalhos ("Nova partida" e "Meus grupos"), categorias e capturas de tela.
- Acessibilidade sem violações no verificador automático (WCAG AA), tema claro e escuro.

## O que falta: Google Play

1. **Domínio próprio.** O Android verifica o site por um arquivo em `/.well-known/assetlinks.json`, na raiz do domínio. Em `filipeultra.github.io/canta-placar/` não há como pôr esse arquivo na raiz.
2. **Empacotar como app** (Trusted Web Activity) com o PWABuilder ou o Bubblewrap, usando o nome do pacote (ex.: `app.ultraplay`) e a chave de assinatura. O `assetlinks.json` leva a impressão dessa chave.
3. **Cobrança do Pro:** pela regra do Google, assinatura digital vendida dentro do app usa o Google Play Billing (taxa de 15%). Existe o programa de cobrança alternativa ("user choice billing"); confira se vale no Brasil para o seu caso. Até decidir, o app da loja pode ser só grátis.
4. **Formulários do Play Console:**
   - segurança dos dados ("Data safety"): o que coleta, para quê, se é opcional;
   - classificação indicativa;
   - público-alvo (atenção a menores);
   - link da política de privacidade;
   - link para excluir a conta pela web (obrigatório quando houver contas no servidor).
5. **Desligar a rede de exemplo** na versão da loja (`DEMO_NET_DEFAULT = false`). Pessoas e números fictícios podem ser vistos como enganosos.
6. **Moderação de verdade:** com contas na nuvem, as denúncias precisam chegar a alguém (painel ou e-mail) com prazo de resposta.

## O que falta: App Store (Apple)

1. **Casco nativo (Capacitor):** um site só embrulhado costuma cair na regra 4.2 ("funcionalidade mínima" / "é só um site"). Com Capacitor, o mesmo código vira app, com recursos nativos que justificam a loja:
   - push;
   - compartilhar nativo;
   - vibração ao marcar ponto;
   - salvar o vídeo direto em Fotos.
2. **Voz no iPhone dentro do app:** o reconhecimento de voz do Safari não funciona igual dentro do app. Use o motor offline (Vosk, que já existe no app) ou um plugin nativo de reconhecimento (SFSpeechRecognizer). As permissões precisam de texto: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`, `NSSpeechRecognitionUsageDescription`, `NSPhotoLibraryAddUsageDescription`.
3. **Cobrança do Pro:**
   - dentro do app iOS, assinatura digital usa a compra da Apple (In-App Purchase);
   - no Brasil, depois do acordo com o Cade, há a opção de link para pagar no site, com comissão (ver `docs/PRECOS.md`);
   - preço e teste grátis precisam aparecer claros antes da compra, com "Restaurar compras".
4. **Login:** se tiver "Entrar com Google", a Apple exige também **"Entrar com a Apple"**.
5. **Conteúdo de usuários (regra 1.2):** filtro de conteúdo ofensivo, denúncia com resposta em até 24 h, bloqueio, contato visível e termos (EULA) aceitos no cadastro. Hoje o app tem denúncia e bloqueio só no aparelho; falta o lado do servidor.
6. **Informações para a revisão:**
   - privacidade ("nutrition labels");
   - URL de suporte e URL da política;
   - classificação indicativa (com rede social, em geral 12+);
   - notas para o revisor explicando a voz ("fale 'ponto verde'") e o modo câmera com dois aparelhos;
   - conta de demonstração quando houver login.
7. **Rede de exemplo desligada** na versão da loja (ou marcada claramente como exemplo). Números "ao vivo" fictícios na tela de entrada são motivo de recusa por informação enganosa (2.3).
8. **Controle pelo relógio ou fone:** dentro do app iOS, o "tocando agora" depende de áudio em segundo plano (`UIBackgroundModes: audio`). Justifique na revisão; senão, deixe esse recurso só na versão web.

## Ordem sugerida

1. Domínio próprio, servidor (Supabase) e contas.
2. Termos e privacidade revisados por advogado e publicados em páginas do site.
3. **Google Play primeiro** (TWA): mais simples, e o Android domina no Brasil.
4. **App Store** com Capacitor, IAP e "Entrar com a Apple".
5. Enquanto isso, o PWA continua sendo a porta principal: link na bio, QR Code nas arenas e "Instalar na tela inicial".
