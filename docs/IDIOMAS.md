# Idiomas (português e inglês)

O app é escrito em português. O inglês vem de uma camada de tradução que troca o que aparece na tela, sem mexer na lógica do app.

## Como funciona
- `i18n.js` carrega antes do resto e decide o idioma:
  1. `?lang=en` ou `?lang=pt` no endereço (bom para testar e para tirar as imagens das lojas);
  2. a escolha em **Ajustes → Idioma · Language**;
  3. sem escolha: português. Só abre em inglês fora do fuso horário do Brasil e com o aparelho sem português e com inglês (por exemplo, o revisor da Apple nos Estados Unidos). Brasileiro com o celular em inglês continua em português.
- Em inglês, ele traduz textos, títulos, dicas, avisos e até o que é desenhado nas imagens e vídeos (canvas). Datas e horas saem no formato americano.
- O dicionário fica em `i18n-en.js` (cerca de 1.600 frases e pedaços de frase). Frases inteiras são trocadas direto; frases montadas com números e nomes ("Já são 3 partidas") são traduzidas por pedaços.
- **Os comandos de voz continuam em português** (o reconhecimento de voz é em português). O que aparece entre aspas “…” e nos exemplos de comando não é traduzido.

## Quando escrever um texto novo no app
1. Escreva em português, como sempre.
2. Rode `python3 tools/i18n-extrair.py /tmp/textos.json` para listar os textos e veja quais ainda não estão em `i18n-en.js`.
3. Acrescente a tradução em `i18n-en.js` (chave em português, exatamente igual, com os espaços das pontas).
4. Teste com `?lang=en`.

## Limites conhecidos
- Nomes de lugares e textos da rede de exemplo (posts, bios) podem ficar meio em português.
- Textos digitados pelas pessoas (nome de time, legenda, resenha) não são traduzidos de propósito.
- Para um terceiro idioma (espanhol, por exemplo), é só criar `i18n-es.js` no mesmo formato e uma opção a mais em Ajustes.
