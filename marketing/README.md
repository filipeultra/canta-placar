# Marketing do lançamento

- **Site (landing page):** `site/index.html`, publicado em https://filipeultra.github.io/canta-placar/site/ . Os prints em `site/img/` são do app de verdade, com dados de exemplo. Quando houver domínio próprio, o site vai na raiz do domínio (ex.: ultraplay.app) e o app em app.ultraplay.app.
- **Plano de conteúdo:** `docs/CONTEUDO-LANCAMENTO.md` (calendário, 15 roteiros, stories, mensagens para professores, influenciadores e arenas, metas).
- **Preços sugeridos:** `docs/PRECOS.md`.

## Artes prontas (`marketing/posts/`)

| Arquivo | Formato | Onde usar (ver o plano de conteúdo) |
|---|---|---|
| `01-teaser.jpg` | Feed 1080×1440 | Capa do R1 "Tava 5-4 ou 4-5?" (D-5) |
| `02-amanha.jpg` | Feed 1080×1440 | Post estático da véspera (D-1). **Confira a data e o horário** antes de postar |
| `03-lancamento.jpg` | Feed 1080×1440 | Capa do reel de lançamento ou 1º card do R6 (D0) |
| `04-turma.jpg` | Feed 1080×1440 | Capa do carrossel R12 (grupos/turmas) |
| `05-numeros.jpg` | Feed 1080×1440 | Capa do R11 (professor lê os números) |
| `06-planos.jpg` | Feed 1080×1440 | Último card do R6 (o que é grátis e o que é Pro) |
| `07-story.jpg` | Story 1080×1920 | Tela 10 da sequência de stories, com a figurinha de link no espaço marcado |
| `08-cartaz.png` | A4 (1240×1754) | Cartaz para as quadras das arenas parceiras. O QR Code abre o app com `utm_source=cartaz` |

As artes saem de `marketing/posts/modelo.html`: para mudar um texto, edite o modelo e gere de novo (instruções no topo do arquivo).

## Reels "vem aí…" (`marketing/reels/`)

| Arquivo | Formato | Uso |
|---|---|---|
| `vem-ai.mp4` | Reels/Story/TikTok 1080×1920, 10 s, 30 fps, com som | Teaser antes do lançamento: "O placar que escuta" → placar ouvindo "ponto verde" (30 vira 40) → estatísticas, timeline e ranking da turma → **VEM AÍ…** → marca e "Em breve" |
| `vem-ai-capa.jpg` | 1080×1920 | Capa do reels (o quadro do "VEM AÍ…") |
| `vem-ai.html` | página animada | A fonte do vídeo: cada quadro é desenhado por `R(t)`, de 0 a 10 s |

- **Som:** batida, o bipe de confirmação do app, os "whoosh" das trocas de tela, o impacto do "vem aí" e um acorde no final, tudo sintetizado (`tools/reel-audio.py`), então não tem direito autoral de música. Se preferir um áudio em alta no Instagram, é só baixar o volume do original no editor.
- **Para gerar de novo** (depois de mudar um texto em `vem-ai.html`): abra a página num servidor local, grave os 300 quadros chamando `R(f / 30)` e tirando uma captura de 1080×1920 de cada um (Playwright), gere o som com `python3 tools/reel-audio.py audio.wav` e junte com `ffmpeg -framerate 30 -i f%04d.png -i audio.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart vem-ai.mp4`.
