# Brasil: economia de apps de assinatura, cases de tempo até MRR e tamanho do mercado de beach tennis e padel

> Nota de método: as buscas funcionaram, mas o WebFetch e o curl falharam para quase todos os domínios (erro de DNS ou 403 do proxy). Quase todos os números abaixo vêm dos trechos que a ferramenta de busca devolveu a partir das páginas citadas, e não da leitura da página inteira. Cada URL é a página de onde o trecho saiu. Os dados autorreportados, promocionais ou de projeção estão marcados.

## 1. Economia de apps de assinatura para consumidor no Brasil (disposição a pagar, preços em BRL, ARPU vs EUA, conversão, churn, Pix e Pix Automático, receita das lojas)

### Takeaway
No Brasil, cada pagante gera cerca de 4x menos receita que nos EUA: na Adapty, US$ 1.000 em receita vêm de 65 assinantes no Brasil contra 15 nos EUA. A conversão em LatAm também é baixa: trial→pago mediano de 25% e só 1,5% de conversão a pagante. O gasto total nas lojas é pequeno mas cresce rápido (US$ 1,3 bi em 2022, US$ 1,7 bi em 2023). Pix Automático (desde jun/2025) e o acordo Apple–Cade (pagamento alternativo no iOS a partir de 2026) são os dois fatores novos para assinaturas, mas ainda não há dados independentes de adoção.

### Cited Findings
**Benchmarks de RevenueCat e Adapty (Brasil/LatAm)**
- Adapty, State of In-App Subscriptions 2026 (base de 16.000+ apps e US$ 3 bi+ de receita): "US$ 1.000 compram 65 assinantes pagantes no Brasil e 15 nos EUA" — [Adapty, fastest growing app markets 2026](https://adapty.io/blog/markdown/fastest-growing-app-markets-2026.md) (trecho de busca; a página não abriu)
- Adapty: os mercados de LatAm com maior LTV mediano de 1 ano são Argentina (US$ 17,9), México (US$ 17,6) e Chile (US$ 15,3). O Brasil não aparece no top 3 — [Adapty, fastest growing app markets 2026](https://adapty.io/blog/markdown/fastest-growing-app-markets-2026.md)
- Adapty: índice de preço do Brasil = 0,9, no mesmo grupo de Canadá, Argentina e Coreia do Sul, e acima de Índia (0,6) e Turquia (0,7). Os preços de assinatura variam até 4x entre países — [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions-report/)
- Funil global da Adapty: install→trial 27,8%, trial→pago 59,2%, 1ª renovação 45,1%. Usuários da América do Norte iniciam mais trials e convertem mais. Não há número do Brasil no trecho — [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions-report/)
- Adapty: em Health & Fitness, o free trial aumenta o LTV. Plano semanal com trial chega a US$ 54,50 de LTV em 12 meses, contra US$ 7,40 sem trial (global) — [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions-report/)
- RevenueCat, State of Subscription Apps 2025: trial→pago mediano de **25,0% em Latin America**, com top performers chegando a 53,3% — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025) (via trecho de busca)
- RevenueCat, State of Subscription Apps 2026: **conversão a pagante de 1,5% em Latin America**, perto de Índia e Sudeste Asiático e abaixo de América do Norte e Europa Ocidental — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- RevenueCat: a geografia gera até 5x de diferença em receita por install (RPI) no D60 — [RocketShip HQ, resumo do RevenueCat SOSA](https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/)
- Resumo secundário do RevenueCat 2026: crescimento mediano de MRR em Latin America de 17,2%, o mais alto entre as regiões — [Medium, Chuvak Pavel](https://chuvak-pavel.medium.com/state-of-app-monetization-2026-key-trends-from-revenuecat-and-adapty-8bdc23a4bb6f) (fonte secundária)
- RevenueCat 2026: o app de assinatura mediano teve queda de 22% na receita ano a ano (global) — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps) (via trecho de busca)
- Estimativa antiga da Statista: receita média por download no Brasil de US$ 0,36 (2022), projeção de terceiro — [Statista App Brazil](https://www-statista-com.ezproxy.canberra.edu.au/outlook/dmo/app/brazil)

**Preços típicos em BRL**
- Strava no lançamento do plano pago no Brasil: R$ 119,90/ano ou R$ 15,90/mês (2020, desatualizado) — [NeoFeed](https://neofeed.com.br/blog/home/strava-chega-a-75-milhoes-de-usuarios-no-brasil-e-aposta-em-versao-paga/); [MKT Esportivo, mai/2020](https://www.mktesportivo.com/2020/05/strava-anuncia-novidade-e-ira-concentrar-esforcos-nos-assinantes/). Nos EUA, hoje: US$ 11,99/mês ou US$ 79,99/ano. A Strava diz que está migrando para "preço consistente por país" (página atualizada em 1/jul/2025) — [Strava pricing](https://www.strava.com/pricing?hl=pt-PT)
- O slug da matéria do NeoFeed diz "strava chega a 75 milhoes de usuarios no brasil". O número provavelmente é 7,5 milhões, mas não consegui confirmar — [NeoFeed](https://neofeed.com.br/blog/home/strava-chega-a-75-milhoes-de-usuarios-no-brasil-e-aposta-em-versao-paga/)
- Pesquisa de Assinaturas 2025 (Vindi com Opinion Box; 2.023 consumidores, mai/2025, margem de 2,2 p.p.): 56% dos brasileiros gastam de R$ 51 a R$ 200 por mês com assinaturas, e 26% planejam aumentar o gasto (+3 p.p. vs 2024) — [Mercado & Consumo, ago/2025](https://mercadoeconsumo.com.br/20/08/2025/servicos/servicos-de-streaming-lideram-modelo-de-assinaturas-no-brasil/)
- Mesma pesquisa: o cartão de crédito responde por 69% das assinaturas, o Pix por 13% e o débito por 8%. Só 24% confiam totalmente em cadastrar dados online. 55% acham o Pix uma forma interessante de pagar assinaturas — [Mercado & Consumo](https://mercadoeconsumo.com.br/20/08/2025/servicos/servicos-de-streaming-lideram-modelo-de-assinaturas-no-brasil/); [Grandes Nomes da Propaganda](https://grandesnomesdapropaganda.com.br/?p=213873)

**Receita de App Store e Google Play vinda do Brasil**
- 2022: gasto do consumidor brasileiro em apps de US$ 1,3 bi, alta de 15% sobre US$ 1,1 bi (data.ai) — [Mobile Time](https://www.mobiletime.com.br/?p=746185) (via trecho de busca)
- 2023: gastos de US$ 1,7 bi, alta de 26,2%, 11º lugar global. Receita gerada por apps no país de US$ 4,5 bi (Rocket Lab com Statista) — [Gironews](https://gironews.com/negocios/brasil-e-o-4o-em-downloads-74688/); [IT Forum](https://itforum.com.br/?p=9559135)
- As fontes divergem: uma estimativa da Sensor Tower para 2019 já falava em mais de US$ 2 bi, o que indica metodologias diferentes — [MacMagazine](https://macmagazine.com.br/post/2020/01/14/brasil-e-o-3o-pais-onde-mais-se-baixa-apps-no-mundo/comments:/692772)
- Contexto global de 2025: US$ 155,8 bi em gastos nas lojas (Appfigures, +21,6%), ou cerca de US$ 167 bi (Sensor Tower, +10,6%). Apps não-jogos (US$ 85,6 bi) superaram jogos (US$ 81,8 bi) pela primeira vez — [Paraíba Business](https://paraibabusiness.com.br/downloads-de-aplicativos-caem-em-2025-mas-bate-recorde-de-faturamento/); [Conversion](https://www.conversion.com.br/blog/ia-supera-jogos-em-gastos-mobile); [games.gg](https://games.gg/pt-BR/news/compras-in-app-em-mobile-atingem-us-167-bilh%C3%B5es/)

**Pix, Pix Automático e o acordo Apple–Cade**
- O Pix Automático foi lançado em 16/jun/2025, depois de um adiamento — [Lets Money](https://www.letsmoney.com.br/pix/pix-automatico-dispara-pagamentos-recorrentes/); [Adyen](https://www.adyen.com/pt_BR/centro-de-conhecimento/pix-automatico-promessa-para-2025)
- EBANX (interesse comercial): alta mensal projetada de 34% no número de assinaturas e de 41% no volume via Pix Automático. 64% dos assinantes do 1º ano eram novos na economia de assinaturas. 60 milhões de brasileiros poderiam assinar serviços sem cartão (projeção) — [Lets Money](https://www.letsmoney.com.br/pix-automatico-dispara-pagamentos-recorrentes/)
- PagBrasil (interesse comercial), 4T2025 a 1T2026: +181% em novos usuários e +177% em usuários recorrentes de Pix Automático — [Lets Money, PagBrasil 1 ano](https://www.letsmoney.com.br/noticias/pagbrasil-pix-automatico-um-ano-recorrencia/)
- Caso Weasy (artigo de opinião do CEO da PagBrasil): o Pix Automático respondeu por 25% das novas assinaturas entre ago/2025 e mar/2026, com churn 8% menor que nas assinaturas só com cartão — [Lets Money](https://www.letsmoney.com.br/noticias/pagbrasil-pix-automatico-um-ano-recorrencia/)
- Visão crítica: "Um ano depois, Pix Automático ainda não pegou, e há um motivo". Não consegui ler o texto completo — [Finsiders Brasil](https://finsidersbrasil.com.br/pagamentos/pix/um-ano-depois-pix-automatico-ainda-nao-pegou-e-ha-um-motivo/)
- Apple–Cade: acordo homologado em dez/2025 (após denúncia do Mercado Livre), com vigência de 3 anos e transição de 120 dias. Libera pagamento próprio dentro do app, links externos e lojas alternativas no Brasil. O texto do acordo cita o Pix como meio possível — [MacMagazine, 23/dez/2025](https://macmagazine.com.br/post/2025/12/23/apple-permitira-compras-externas-e-lojas-alternativas-a-app-store-no-brasil/); [Diário do Comércio](https://diariodocomercio.com.br/economia/apple-permitira-baixar-apps-fora-app-store-pagamento-via-pix-apos-acordo-cade/)
- As datas e comissões variam entre as matérias. Uma diz que a comissão máxima cai de 30% para 21%, com taxa menor para pequenos devs. Outra fala de 5% adicionais para quem usa o IAP da Apple. As datas de início citadas são 18/jun/2026 ou 18 de outubro, e as lojas alternativas dependem do iOS 26.5 — [Jornal de Brasília](https://jornaldebrasilia.com.br/noticias/economia/apple-libera-sistema-de-pagamentos-em-aplicativos-no-brasil-apos-acordo-com-o-cade/); [TecMundo](https://www.tecmundo.com.br/mercado/413975-apple-oficializa-lojas-externas-no-brasil-e-outros-meios-de-pagamento-na-app-store.htm); [Portal Tela, jun/2026](https://www.portaltela.com/noticias/politica/2026/06/18/apple-libera-sistema-de-pagamentos-em-apps-no-brasil-apos-acordo-com-o-cade/)

### Inferences
- Pelo dado da Adapty (65 pagantes por US$ 1.000 no Brasil contra 15 nos EUA), a receita por pagante no Brasil fica em torno de US$ 15,4, contra cerca de US$ 66,7 nos EUA, ou seja, cerca de 4,3x menor. Isso supõe que o dado se refere à receita no período do relatório, então é uma inferência e não um número publicado.
- Somando a conversão a pagante de 1,5% em LatAm (RevenueCat) e a receita por pagante cerca de 4x menor, a receita por install no Brasil tende a ficar bem abaixo de 1/4 da dos EUA. Planejar com cerca de 1–2% dos instalados virando pagantes é coerente com os benchmarks.
- O Pix Automático e o pagamento alternativo no iOS podem baixar a taxa da loja (de 15–30% para cerca de 10–21%) e incluir quem não tem cartão de crédito (31% das assinaturas não usam cartão). Em 2026, porém, ainda não há dados independentes do Banco Central sobre adesão a assinaturas.
- Um preço na faixa de R$ 9,90 a R$ 19,90/mês é coerente com a âncora da Strava BR (R$ 15,90/mês em 2020) e com o orçamento de R$ 51 a R$ 200/mês para todas as assinaturas somadas. Isto é inferência e não um benchmark publicado.

### Gaps
- Não encontrei o RPI, o trial→pago ou o churn específicos do Brasil (só agregados de LatAm). Os PDFs da RevenueCat e da Adapty com o corte por país não abriram.
- Não encontrei gasto nas lojas do Brasil em 2024 ou 2025 por fonte primária (Sensor Tower ou Appfigures por país).
- Não encontrei o preço atual da Strava BR, do Duolingo BR nem de outros apps esportivos em BRL de 2025–2026.
- Faltam dados independentes, de fora das processadoras, sobre o efeito do Pix Automático no churn.

## 2. Cases brasileiros (startups, micro-SaaS, indie devs, build in public) e tempo até marcos de MRR

### Takeaway
Os cases brasileiros com números públicos vêm quase todos da newsletter Micro-SaaS (Substack) e do TabNews, e são autorreportados. Eles mostram duas trajetórias. Na maioria, o crescimento é lento e orgânico: cerca de R$ 2,3 mil de MRR em 7 meses. Os outliers usam mídia paga ou afiliados: R$ 150 mil de MRR em 7 meses, ou de R$ 20 mil a R$ 198 mil em 6 meses. Entre as startups de fitness, a Next Fit levou cerca de 4–5 anos até R$ 52 milhões de ARR, e a Tecnofit faturou cerca de R$ 7 milhões no 3º ano.

### Cited Findings
**Micro-SaaS e build in public (autorreportado)**
- Micro-SaaS anônimo no TabNews: **101 assinantes e MRR de R$ 2.282 após 7 meses**, sem anúncios, com custos de R$ 1.010 por mês — [TabNews, "SaaS com 100 assinantes: saiba o lucro"](https://www.tabnews.com.br/microsaas/saas-com-100-assinantes-saiba-o-lucro)
- Persua (Lucas Montano, YouTuber dev): **211 pagantes e cerca de €2.200 de MRR em cerca de 5 meses**, em paralelo a um emprego CLT, 100% bootstrapped — [Micro-SaaS Substack](https://microsaas.substack.com/p/lucas-montano-revela-como-criou-o-persua)
- Voicefy (Mizael Xavier, dublagem com IA): **R$ 150 mil de MRR em 7 meses**, dos quais cerca de R$ 70 mil vieram só de Google Ads, com foco em planos anuais e vitalícios — [Micro-SaaS Substack, "Da roça aos R$ 150k de MRR em 7 meses"](https://microsaas.substack.com/p/da-roca-aos-r-150k-de-mrr-em-7-meses)
- Clonou: de R$ 20 mil para **R$ 198 mil de MRR em 6 meses**, com um canal de afiliados estruturado — [Micro-SaaS Substack, guia definitivo](https://microsaas.substack.com/p/tudo-sobre-micro-saas-o-guia-definitivo)
- ChatADV: começou como micro-SaaS com MRR de R$ 5 a 15 mil, virou startup ao chegar a **R$ 100 mil de MRR** e hoje fatura cerca de R$ 200 mil por mês. Não há prazo informado no trecho — [Micro-SaaS Substack](https://microsaas.substack.com/p/de-funcionario-para-fundador-de-startup?open=false)
- MyGroupMetrics: cerca de R$ 11 a 12 mil por mês com manutenção baixa (lifestyle business) — [Micro-SaaS Substack](https://microsaas.substack.com/p/tudo-sobre-micro-saas-o-guia-definitivo)
- Jonatan Fróes, portfólio com 2 sócios: com 4 micro-SaaS, o MRR beirava R$ 75 mil, com os 3 em tempo integral. Depois, com 8 produtos, chegou a cerca de R$ 130 mil de MRR (R$ 1,3 milhão de ARR) — [Micro-SaaS Substack, "8 micro-SaaS e R$ 1,3M de ARR depois"](https://microsaas.substack.com/p/8-micro-saas-e-r-13m-de-arr-depois?sd=pf)
- Caso "de dono de restaurante a dono de Micro-SaaS que fatura R$ 120k de ARR" (cerca de R$ 10 mil de MRR). A página não abriu, então não tenho o prazo — [Micro-SaaS Substack](https://microsaas.substack.com/p/de-dono-de-restaurante-para-dono)
- Freelup (Tiago Costa): build in public pelo Instagram desde jan/2023 — [Micro-SaaS Substack](https://microsaas.substack.com/p/tudo-sobre-micro-saas-o-guia-definitivo)
- Heat App (relacionamento): "R$ 390.000 por mês, 981 assinantes ativos", com receita no RevenueCat. **É material de venda de curso e não foi verificado.** A conta (981 × cerca de R$ 400) sugere ticket muito alto ou número inconsistente — [App Builders](https://appbuilders.com.br/)
- A newsletter brasileira define micro-SaaS como até R$ 25 mil de MRR — [Micro-SaaS Substack, atualizações e métricas](https://microsaas.substack.com/p/atualizacoes-e-metricas-do-mercado?open=false)
- Cuidado de método: um PR público mostra um MRR exibido de R$ 475 caindo para R$ 79 quando só pagantes reais foram contados (sem trial nem bônus) — [GitHub leonfpontes/Senhas PR #51](https://github.com/leonfpontes/Senhas/pull/51)

**Startups (fitness e SaaS B2B)**
- Next Fit (Criciúma, SC; ERP fitness): fundada em 2019, dobrou de tamanho a cada 12 meses. Perdeu cerca de 70% dos clientes na pandemia e mesmo assim bateu a meta de 500 clientes em 24/dez/2020. **ARR de R$ 52 milhões na Série A de R$ 50 milhões**, com pouco mais de 200 funcionários — [Startups.com.br](https://startups.com.br/negocios/rodada-de-investimento/next-fit-capta-r-50m-em-serie-a-para-expandir-seu-erp-fitness/); [NSC Total](https://www.nsctotal.com.br/?p=8015070)
- Next Fit depois: mais de 250 funcionários, mais de 2 milhões de alunos ativos na plataforma, plano de dobrar até 2028, valuation de "até R$ 250 milhões" (manchete) — [NSC Total](https://www.nsctotal.com.br/?p=8015070)
- Tecnofit (Curitiba, gestão de academias e boxes): fundada em 2016. **Faturou mais de R$ 7 milhões em 2019 (+200% a/a)**, tinha 3.000 clientes em 2020 e mais de 4.000 em 2021, quando captou R$ 13 milhões com a Honey Island (sócios do EBANX) — [Exame](https://exame.com/pme/startup-de-gestao-de-academias-de-socio-do-ebanx-cresce-200-ao-ano); [Startupi, set/2021](https://startupi.com.br/2021/09/startup-especialista-em-sistemas-de-gestao-para-academias-recebe-aporte-de-r-13-milhoes/)
- RD Station: 5 fundadores sem investimento inicial, R$ 1 milhão de ARR (cerca de R$ 83 mil de MRR) em cerca de 2,5 anos — [TechCrunch, 2017](https://techcrunch.com/2017/08/08/the-new-wave-of-brazilian-saas-innovators/) (dado antigo, fora da janela 2022–2026)
- 71% das empresas SaaS brasileiras eram bootstrapped (pesquisa de 2017) — [Meio & Mensagem](https://www.meioemensagem.com.br/proxxima/arquivo/how-to/brasil-saas-landscape-2017-primeira-pesquisa-sobre-mercado-saas-do-brasil) (dado antigo)
- Wellhub: 4 milhões de usuários e 22 mil empresas no Brasil no início de 2025 (+15% desde dez) — [Startups.com.br](https://startups.com.br/unicornio/wellhub-chega-a-3-milhoes-de-usuarios-e-aumenta-rede-de-parceiros/)
- TotalPass (Smart Fit): de 5 mil para 15 mil empresas clientes em 2024, depois 39 mil CNPJs. MAU de cerca de 4 milhões (+75%, BTG e Sensor Tower, citado como 2T2026). A meta era dobrar a receita em 2025 (meta, não resultado) — [Bloomberg Línea](https://www.bloomberglinea.com.br/estilo-de-vida/totalpass-do-grupo-smart-fit-triplica-base-de-empresas-e-quer-ser-mais-conhecida/); [Eu Quero Investir](https://euqueroinvestir.com/acoes/totalpass-acelera-crescimento-e-ganha-espaco-sobre-wellhub)

### Inferences
- Para um app de consumidor brasileiro bootstrapped e sem mídia paga, o relato mais parecido (101 assinantes e R$ 2,3 mil de MRR em 7 meses) sugere que R$ 10 mil de MRR leva mais de 12 meses. Os casos de R$ 100–150 mil em menos de 12 meses dependeram de Google Ads ou afiliados e de produto B2C de IA com ticket alto. É uma estimativa a partir de poucos casos autorreportados, com viés de sobrevivência forte.
- Os SaaS B2B de fitness (Next Fit, Tecnofit) cresceram vendendo para academias e arenas, não para o atleta amador. Isso sugere que o modelo B2B2C, em que a arena paga e o amador usa, é uma rota comprovada no Brasil.

### Gaps
- Não achei nenhum app esportivo B2C brasileiro com MRR público mês a mês.
- Não confirmei os prazos até R$ 10 mil, R$ 50 mil e R$ 100 mil para a maioria dos casos (as páginas do Substack não abriram).
- Não achei dados de comunidades como Comunidade Sem Codar nem de criadores do X ou LinkedIn com MRR verificável.
- Não encontrei números de Atleta.app nem de outras startups de "app do atleta amador".

## 3. Mercado de beach tennis e padel no Brasil (praticantes, quadras, crescimento 2020–2026), mais peteca e vôlei amador

### Takeaway
Beach tennis: a CBT estima cerca de 1,1 milhão de praticantes em 2023, contra 400 mil em 2021, com cerca de 5 mil filiados. Um estudo citado fala em só 300 mil praticantes regulares. Padel: a Cobrapa estima mais de 600 mil praticantes, com crescimento de 15 a 20% ao ano, e entre 770 e mais de 2 mil quadras. Os federados de padel subiram de cerca de 5 mil (2020) para cerca de 25 mil (2023). Não há levantamento oficial de quadras de beach tennis. Todos os números são estimativas das entidades, sem metodologia publicada.

### Cited Findings
**Beach tennis**
- CBT: 400 mil praticantes em 2021 e **1,1 milhão em 2023** — [IESB Jornalismo](https://jornalismo.iesb.br/destaque3/brasil-tem-11-milhao-de-praticantes-de-beach-tennis/); [Insper, dez/2023](https://www.insper.edu.br/pt/noticias/2023/12/estudantes-do-insper-desenvolvem-app-para-facilitar-agendamento-)
- Mais de 1 milhão de praticantes (filiados e informais), com cerca de 5 mil filiados à CBT — [Diário do Comércio](https://diariodocomercio.com.br/negocios/entenda-por-que-o-beach-tennis-vem-ganhando-espaco-mg/)
- FPT (abr/2025): o país passou de 1 milhão de praticantes e concentra cerca de 60% dos jogadores do mundo — [Federação Paulista de Tênis](https://fpt.com.br/Noticias/Info/3827/o-beach-venceu-brasil-vira-potencia-do-beach-tennis)
- Dado conflitante: cerca de 300 mil praticantes (Agência Einstein, set/2024), provavelmente só os regulares — [Tribuna de Minas](https://tribunademinas.com.br/?p=686010)
- O Brasil sediou 180 torneios internacionais ITF em 2025, mais que qualquer outro país (FPT com calendário ITF). O beach tennis brasileiro ainda não tem levantamento oficial de praticantes, e as estimativas variam muito — [Brazil Journal](https://braziljournal.com/od2q)
- Copa das Federações 2025 (Fortaleza): 38 quadras montadas e R$ 35 milhões de impacto estimado (promocional) — [Mixvale](https://www.mixvale.com.br/2025/09/01/copa-das-federacoes-de-beach-tennis-2025-promete-movimentar-r-35-mi-em-fortaleza/)
- Mercado brasileiro de beach tennis de "US$ 140 milhões", sem fonte primária (blog de fornecedor) — [Tecnofit blog](https://www.tecnofit.com.br/blog/app-beach-tennis/)

**Padel**
- Cobrapa: **mais de 600 mil praticantes**, crescimento de 15 a 20% ao ano (estimativa interna) — [Gazeta SP](https://www.gazetasp.com.br/esportes/mais-de-600-mil-praticantes-padel-dispara-no-brasil-e-e-o-esporte-que/)
- Conflito: "mais de 1 milhão de praticantes", sem metodologia — [NSC Total](https://www.nsctotal.com.br/?p=8027016)
- Quadras: mais de 2 mil quadras em 16 estados (Cobrapa, estimativa mais citada) — [Gazeta SP](https://www.gazetasp.com.br/esportes/mais-de-600-mil-praticantes-padel-dispara-no-brasil-e-e-o-esporte-que/). AFP (abr/2026): **mais de 770 quadras em 2025, +100% em 1,5 ano** — [O Povo](https://www.opovo.com.br/noticias/mundo/2026/04/03/da-argentina-a-miami-febre-do-padel-cruza-fronteiras.html)
- Federados: cerca de 5 mil (2020), cerca de 25 mil (2023), projeção de 30 a 40 mil em 2025 — [Band](https://www.band.com.br/esportes/padel-o-que-e-202511131202)
- Santa Catarina: cerca de 90 mil praticantes e cerca de 350 quadras — [ABC do ABC](https://www.abcdoabc.com.br/padel-cresce-brasil-polo-talentos-esporte/)
- Mundo (FIP): cerca de 35 milhões de jogadores, +42% em 2025, com a América do Sul em cerca de 19% — [Gazeta SP](https://www.gazetasp.com.br/esportes/mais-de-600-mil-praticantes-padel-dispara-no-brasil-e-e-o-esporte-que/)
- Padel visto como "esporte que supera o beach tennis e vira febre entre ricos" — [TNH1](https://www.tnh1.com.br/tnh1-variedades/novo-esporte-supera-o-beach-tennis-e-vira-febre-entre-ricos-no-brasil/); [Seu Dinheiro, 2026](https://www.seudinheiro.com/2026/lifestyle/padel-o-novo-tenis-que-ja-conquistou-a-europa-e-as-marcas-de-luxo-edvl/)

**Peteca e vôlei**
- Peteca: os números divergem em ordem de grandeza. Uma fonte diz "mais de 10 mil praticantes, a maioria em MG" — [Guia da Semana](https://www.guiadasemana.com.br/turismo/noticia/de-recreativa-a-oficial). Outra diz "cerca de 7 milhões de petequeiros" — [Tribuna PR](https://www.tribunapr.com.br/esportes/curitiba-sedia-liga-brasileira-de-peteca/). As duas são antigas e não citam metodologia.

### Inferences
- **Estimativa** de teto do público: beach tennis (cerca de 0,3 a 1,1 milhão) mais padel (cerca de 0,6 a 1 milhão), com sobreposição desconhecida, dá cerca de 1 a 2 milhões de amadores, dos quais só algumas dezenas de milhares são federados (cerca de 5 mil na CBT e cerca de 25 a 40 mil no padel). Com 0,5% a 1% virando pagantes a cerca de R$ 15/mês, o teto fica entre cerca de R$ 75 mil e R$ 300 mil de MRR bruto, antes da taxa da loja. É uma conta ilustrativa, não um dado.
- Os federados (cerca de 30 a 45 mil somando os dois esportes) são o núcleo de maior disposição a pagar por estatísticas e ranking.

### Gaps
- Não há contagem oficial nacional de quadras ou arenas de beach tennis.
- A metodologia das estimativas da CBT e da Cobrapa não foi publicada.
- Não encontrei dados atuais confiáveis de vôlei amador nem de futevôlei.

## 4. Apps esportivos no Brasil que já monetizam amadores (reserva de arenas, ranking, estatísticas)

### Takeaway
O mercado brasileiro tem muitos apps de gestão e reserva de arena, quase todos B2B ou marketplaces: Kourt, DUPLA, ArenaAi, Arena Manager, TPC Matchpoint, ArenaGo e Bora Pro Play. Nenhum divulga usuários ou receita. Não achei números públicos da Playtomic no Brasil.

### Cited Findings
- Kourt: reserva de quadras de padel, beach tennis e outros esportes, com arenas verificadas, pagamento online e lado do gestor — [Kourt](https://kourt.com.br/)
- DUPLA: beach tennis, com ranking, mapa de arenas, gestão de quadras e WhatsApp automatizado — [DUPLA](https://site.appdupla.com/)
- ArenaAi: gestão de arenas de beach tennis, futevôlei, padel e society, com app do aluno e cobrança por créditos — [ArenaAi](https://arenai.com.br/)
- Arena Manager: padel, com pagamento antecipado de reservas para reduzir no-show — [Arena Manager](https://arenamanager.com.br/gestao/arena-de-padel)
- TPC Matchpoint Brasil: apps white-label por arena (reserva, ranking, campeonatos) — [Ponto Padel, App Store](https://apps.apple.com/us/app/ponto-padel/id6740764742?l=pt-BR); [Padel Sports Center, Google Play](https://play.google.com/store/apps/details?id=es.tpc.matchpoint.appclient.padelsportscenter&hl=en_US)
- ArenaGo (pickleball, beach tennis, padel, tênis) — [ArenaGo](https://arenagobr.com/); Kourty — [Google Play](https://play.google.com/store/apps/details?id=app.kourty.mobile&hl=pt_BR); Bora Pro Play — [App Store](https://apps.apple.com/app/id6470311831)
- Insper (dez/2023): estudantes criaram um app de agendamento de beach tennis — [Insper](https://www.insper.edu.br/pt/noticias/2023/12/estudantes-do-insper-desenvolvem-app-para-facilitar-agendamento-)
- Playtomic: os dados encontrados são globais e antigos (cerca de 650 clubes e 3 mil quadras, por volta de 2019), além do uso para "partidas abertas" sociais. Não há números do Brasil — [Silicon Canals](https://siliconcanals.com/want-to-play-this-spanish-startup-allows-you-to-book-courts-instantly-via-an-app/); [Fast Company](https://fastcompany.com/91526714/playtomic-padel-app-dating)
- Arenas de beach tennis aparecem como parceiras do Wellhub, outro canal de monetização do amador via benefício corporativo — [Wellhub parceiros](https://wellhub.com/pt-br/search/partners/play-tennis-beach-tennis-tatuape/)

### Inferences
- Os concorrentes cobram da arena (SaaS ou taxa de reserva). Estatística individual para o atleta amador, com assinatura B2C, parece um espaço menos ocupado, mas também menos validado em disposição a pagar.

### Gaps
- Não achei usuários, arenas ou receita de nenhum desses apps, nem rodadas de investimento.
- Não confirmei Atacante, Lets/LetzPlay nem BT Tracker nas buscas.
- Não confirmei a presença ativa da Playtomic no Brasil.
