# Benchmarks: time to revenue milestones and revenue distribution (consumer subscription apps, SaaS, indie)

> Method note (read first): direct page fetches were blocked by the sandbox's egress policy (revenuecat.com, saastr.com, ppc.land all returned DNS/CONNECT failures), so every figure below comes from web-search result extracts of the cited pages, not from reading the full PDFs. Figures attributed to a primary page (revenuecat.com, chartmogul.com, stripe.com, microconf.com, indiehackers.com) are marked **[primary]**. Figures only seen in secondary write-ups are marked **[secondary]** and should be checked before use in anything public. "Measured" = derived from platform data; "estimate" = analyst or blog estimate.

## 1. RevenueCat "State of Subscription Apps" (2024, 2025, 2026): milestones, concentration, conversion, mix, retention, Health & Fitness, LATAM

### Takeaway
In RevenueCat's measured data, about 17% of new subscription apps reach US$1k/month and about 4.6% reach US$10k/month within two years (2026 edition, apps launched 2023-2025). The median new app makes about US$72/month one year after launch. Revenue is extremely concentrated: the top 5% make hundreds of times what the bottom quartile makes. Health & Fitness converts better than average (median trial-to-paid about 38-40%, D35 download-to-paid about 2.9%) and leans annual (about 59-61% of revenue). Latin America has the fastest MRR growth but among the lowest revenue per install.

### Cited Findings

**Sample and scope**
- 2026 edition (2025 data): 115,000+ apps, US$16B+ in revenue; almost all mobile, B2C; only apps above a minimum installs/revenue threshold are included, so it skews toward apps that already monetize (measured) [primary/secondary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [SaaStr summary](https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth/); [tasu.ai](https://tasu.ai/library/how-much-money-do-subscription-apps-make)
- 2025 edition covered 75,000+ apps [secondary] — [termsandconditionstemplate.com summary](https://termsandconditionstemplate.com/app-revenue-statistics-2026); [Slashdot "70K apps"](https://developers.slashdot.org/story/25/03/17/1946256/sobering-revenue-stats-of-70k-mobile-apps-show-why-devs-beg-for-subscriptions)

**Share of apps that reach US$1k / US$10k per month (time window: 2 years after launch)**
- 2026 edition: 17.3% of new apps reach US$1,000/month within two years, and 4.6% reach US$10,000/month (cohort: apps launched 2023-2025; measured) [primary page cited by secondary sources] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [tasu.ai](https://tasu.ai/library/how-much-money-do-subscription-apps-make); [DEV Community](https://dev.to/axrisi/app-economy-2026-why-new-apps-get-3-of-subscription-revenue-3cj8)
- Trend: the share reaching US$1k MRR within two years fell from 19% (prior cohort) to 17% (2026 edition). Photo & Video had the highest share at 21.4% [secondary] — [Medium: State of App Monetization 2026](https://chuvak-pavel.medium.com/state-of-app-monetization-2026-key-trends-from-revenuecat-and-adapty-8bdc23a4bb6f); [Data Analysis Journal](https://dataanalysis.substack.com/p/2026-benchmarks-more-apps-less-quality)
- 2025 edition: "nearly 20%" of newly launched apps reach US$1,000 in revenue within two years, and 5% reach US$10,000 [primary] — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- Note: the 2025 wording in some extracts is "$1,000 in revenue" while 2026 extracts say "$1,000 a month". The exact metric definition was not confirmed in the full report text.
- US$100k/month: no share found in any extract (gap).

**Revenue distribution one year after launch**
- 2026 edition, monthly revenue 1 year after launch: median about US$72; top quartile above US$429; top 10% above US$2,574 (measured) [primary page cited by secondary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [tasu.ai](https://tasu.ai/library/how-much-money-do-subscription-apps-make); [termsandconditionstemplate.com](https://termsandconditionstemplate.com/app-revenue-statistics-2026)
- 2025 edition: the top 5% of new apps make over 400x as much as the bottom 25% after their first year; the bottom 25% make no more than US$19 [primary] — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025). A separate summary says that in 2025 the top 5% generate 500x more than the remaining 95%, up from 200x in 2024 [secondary; framing differs from the 400x-vs-bottom-quartile line, conflict noted] — [Slashdot](https://developers.slashdot.org/story/25/03/17/1946256/sobering-revenue-stats-of-70k-mobile-apps-show-why-devs-beg-for-subscriptions)
- 2024 edition: median monthly revenue after 12 months was under US$50; the top 5% of new apps make over 200x the revenue of the bottom quartile 12 months after launch [primary + press] — [RevenueCat SOSA 2024](https://www.revenuecat.com/state-of-subscription-apps-2024); [TechCrunch, 12 Mar 2024](https://techcrunch.com/2024/03/12/most-subscription-mobile-apps-dont-make-money-new-report-shows/); [MacRumors](https://www.macrumors.com/2024/03/13/most-subscription-apps-do-not-make-money/)
- Conflicting "median" figure: one write-up says the median app (all apps, not first-year) earns US$492/month, down 22% YoY from US$627. It measures something different from the US$72 first-year median [secondary] — [Medium](https://chuvak-pavel.medium.com/state-of-app-monetization-2026-key-trends-from-revenuecat-and-adapty-8bdc23a4bb6f)
- Growth concentration (2026): the median app grew MRR 5.3% YoY, while the top 10% grew 306%+ [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [Subscription Insider](https://www.subscriptioninsider.com/blog/revenuecat-data-shows-subscription-app-growth-concentrating-at-the-top-news)
- New apps capture only about 3% of subscription revenue (2026 framing) [secondary] — [DEV Community](https://dev.to/axrisi/app-economy-2026-why-new-apps-get-3-of-subscription-revenue-3cj8)

**Value per payer**
- 2026: median year-1 realized LTV per payer is US$23 globally; US$32 in North America, US$25 in Western Europe, US$14 in India/SEA. No LATAM figure was in the extract [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)

**Conversion**
- 2026: median Day-35 download-to-paid about 2.0% across all apps; top 10% above 9.1% [secondary] — [Data Analysis Journal](https://dataanalysis.substack.com/p/2026-benchmarks-more-apps-less-quality); [arpubrothers](https://arpubrothers.com/blog/revenuecat-subscription-app-report-2026/)
- 2026: D35 download-to-paid is defined as installs with at least one paid subscription within 35 days of install. Category medians range from Gaming 1.0% to **Health & Fitness 2.9% (top quartile above 6.2%)** [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- 2026: hard paywall median D35 conversion 10.7% vs 2.1% for freemium [primary page per secondary extracts] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [buildmvpfast](https://www.buildmvpfast.com/blog/hard-paywall-vs-free-trial-revenuecat-indie-app-2026)
- 2026 trial-to-paid medians by category: Travel 43.5% (top quartile above 62.4%), **Health & Fitness 37.7%**, Gaming 25.0%, Photo & Video 22.2% [secondary] — [tasu.ai](https://tasu.ai/library/trial-to-paid-conversion-rate-benchmark); [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- 2025 Health & Fitness trial-to-paid: median 39.9%, top 10% 68.3% [primary] — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- Download-to-trial-start, Health & Fitness: 6.9% (2026); 6.7% median (2024) [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [RevenueCat SOSA 2024](https://www.revenuecat.com/state-of-subscription-apps-2024)
- Trial length: 17+ day trials have a 42.5% median conversion vs 25.5% for trials of 4 days or less (2026). Health & Fitness, Education and Travel favor 5-9 day trials. 2025: 17-32 day trials had the highest median, 45.7% [primary] — [RevenueCat blog: free trial length](https://www.revenuecat.com/blog/growth/free-trial-length); [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- Aggregate trial conversion fell to about 33% in 2025 from 46% [secondary, unverified] — [termsandconditionstemplate.com](https://termsandconditionstemplate.com/free-trial-statistics-2026)

**Annual vs monthly mix**
- 2026: **Health & Fitness gets 59% of revenue from annual plans**; Productivity gets 91% from monthly. Across geographies, monthly is 36-55% of subscriptions sold and yearly 19-40% [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps). Another summary gives 60.6% annual for Health & Fitness [secondary] — [Medium](https://chuvak-pavel.medium.com/state-of-app-monetization-2026-key-trends-from-revenuecat-and-adapty-8bdc23a4bb6f). A 68% figure also circulates and was not verified.

**Retention / renewal**
- 2025 edition: yearly plans keep the best 1-year retention, 44.1% (down from 47.1%); monthly plans 17.0% (down from 18.8%) [primary] — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- 2025: cheap annual plans keep up to 36% of users after a year; high-priced monthly plans keep 6.7% [primary blog] — [RevenueCat 2025 launch post](https://www.revenuecat.com/blog/company/the-state-of-subscription-apps-2025-launch)
- 2026: annual-plan 1-year retention is about 28% for freemium apps vs 27% for hard-paywall apps [secondary] — [Data Analysis Journal](https://dataanalysis.substack.com/p/2026-benchmarks-more-apps-less-quality)
- 2026 (AI study): 12-month annual retention 21.1% for AI apps vs 30.7% for non-AI apps [press] — [TechCrunch, 10 Mar 2026](https://techcrunch.com/2026/03/10/ai-powered-apps-struggle-with-long-term-retention-new-report-shows); [RevenueCat AI retention study](https://www.revenuecat.com/blog/growth/ai-app-retention-study)
- Category renewal (older 2022 data, 10k+ apps): median first annual renewal 23-31% across the top categories; monthly 58-67%. Health & Fitness was not an outlier [primary, dated] — [RevenueCat renewal rates by category](https://revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category)
- Sept 2026 summary: first-renewal churn about 42-65% weekly, 39-58% monthly, 60-77% annual [secondary aggregator] — [PlushCap summary of RevenueCat blog](https://www.plushcap.com/companies/revenuecat/blog/summaries/2026/09)

**Latin America / Brazil**
- 2026 groups Brazil with Mexico, Argentina, Chile, Colombia and Peru as "Latin America". LATAM had the fastest median MRR growth (17.2%) but monetizes "at significantly lower rates" [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [RevenueCat 10-minute summary 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- 2025: LATAM median trial-to-paid 25.0%, top performers 53.3%. LATAM has more late conversions (week 6+) [primary] — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- 2025: LATAM and India/SEA have the lowest median revenue per install, US$0.06-0.09, vs North America US$0.39 (time window not confirmed in the extract) [primary] — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- Adapty 2026 (16,000+ apps, US$3B+): top LATAM markets by median 1-year LTV are Argentina US$17.9, Mexico US$17.6 and Chile US$15.3, about 35% below top European countries. Brazil's price index is 0.9x the US. An Adapty page claims US$1,000 buys 65 paying subscribers in Brazil vs 15 in the US (no methodology given) [primary vendor] — [Adapty State of In-App Subscriptions](https://adapty.io/state-of-in-app-subscriptions-report/); [Adapty: fastest-growing markets 2026](https://adapty.io/blog/fastest-growing-app-markets-2026/)

### Inferences
- Rough conversion for the comparison app. Assumed FX is R$5.5 = US$1, which is an assumption, not a sourced rate. On that basis US$1k MRR is about R$5,500/month, or about 220 monthly Pro subs at R$24.90, or about 370 annual subs (R$179.90/12 = R$14.99/month). These are gross figures before store/payment fees and taxes. That puts US$1k MRR in reach of a few hundred payers, and RevenueCat says only about 17% of new apps get there within two years.
- At the Health & Fitness D35 median of 2.9% (freemium apps nearer 2.1%), 220-370 payers implies roughly 8k-18k installs/sign-ups in the funnel, before churn. This assumes RevenueCat's mobile funnel applies to a PWA, which is unverified.
- Annual-heavy mix (about 59% of revenue in Health & Fitness) plus the 2025 finding that cheap annual plans retain best (up to 36%) supports pushing the R$179.90 annual plan. Annual revenue counted as MRR (÷12) will grow more slowly than cash.
- LATAM's low revenue per install (US$0.06-0.09) and late conversions suggest a Brazilian app should expect lower per-user value than US benchmarks and give conversion longer than 35 days to show up.

### Gaps
- No RevenueCat share or timeline for US$100k MRR, and no exact "months to US$1k" median, was found; RevenueCat reports shares within fixed windows (1 and 2 years).
- No Brazil-only RevenueCat or Adapty conversion/LTV figures were found; LATAM is aggregated.
- No Health & Fitness-specific renewal/retention rate from the 2025/2026 editions was found in the extracts.
- No RevenueCat data on web/PWA (Stripe web billing) vs App Store conversion was retrieved.
- Full PDFs were not readable (egress blocked), so the 2.0% D35 overall median and 28%/27% retention figures rely on secondary summaries.

## 2. ChartMogul: time to US$1M ARR, growth at early ARR bands, retention

### Takeaway
ChartMogul's 2025 "Against the Odds" report (6,525 companies, 10-year window) finds that almost half of software startups that start monetizing eventually reach US$1M ARR if they last 10 years. Only about 1 in 10 reaches US$10M and 1 in 50 reaches US$25M. The typical path to US$1M takes 2-5 years, and only 3.3% get there in under 12 months. The 2023 report puts the median at about 2 years 9 months to US$1M ARR. Note this is B2B SaaS, not consumer apps.

### Cited Findings
- 2025 report "Against the Odds" (Kyle Poyar, published 15 Oct 2025): dataset of 6,525 companies, 10-year window. Almost half reach US$1M ARR after starting to monetize if they stick around 10 years; 1 in 10 reaches US$10M ARR; 1 in 50 reaches US$25M within 10 years (measured) [primary] — [ChartMogul 2025 SaaS Growth Report](https://chartmogul.com/reports/saas-growth-the-odds-of-making-it/)
- For those reaching US$1M, the typical path takes 2 to 5 years; only 3.3% get there in under 12 months [primary, extract truncated] — [ChartMogul reports](https://chartmogul.com/reports/); [ChartMogul 2025](https://chartmogul.com/reports/saas-growth-the-odds-of-making-it/)
- 2023 report: top-tier startups reach US$1M ARR within about 9 months; the median takes about 2 years 9 months. Only 13% reach US$10M ARR even after 10 years. The median reaches US$10M in about 5 years [primary] — [ChartMogul SaaS Growth Report 2023](https://chartmogul.com/reports/saas-growth-report/); [PDF](https://chartmogul.com/reports/saas-growth-report/saas-growth-report-2023.pdf)
- Conflict: SaaStr reports "the best go from first revenue to $10M ARR in 2 years and 9 months," which attaches 2y9m to US$10M (best performers), not the US$1M median — [SaaStr](https://www.saastr.com/chartmogul-the-best-in-saas-get-to-10m-arr-in-3-years-the-next-best-in-about-5-years)
- Growth rates (2023): median SaaS grows about 30%/year, top quartile 60-70%/year; median about 2-2.5%/month over the lifecycle; top-decile startups grow 10-17%/month early on [primary] — [ChartMogul SaaS Growth Report 2023](https://chartmogul.com/reports/saas-growth-report/)
- Retention (2023): top-quartile NRR 94% for US$1-3M ARR, 99% for US$3-15M; higher ARPA correlates with higher NRR [primary] — [ChartMogul SaaS Retention Report 2023](https://chartmogul.com/reports/saas-retention-report/)
- H1 2024: the median company with NRR of 100% or more grew 48% YoY [primary] — [ChartMogul retention reports](https://chartmogul.com/reports/saas-retention-the-new-normal/)
- Bootstrapped vs VC-backed comparison exists (2024) but no numbers were retrieved — [ChartMogul bootstrapped vs VC 2024](https://chartmogul.com/reports/saas-growth-vc-bootstrapped/)
- Third-party, unclear sourcing: about 24 months (bootstrapped) / about 20 months (VC) to US$1M for top quartile [estimate] — [Founderpath](https://founderpath.com/blog/saas-growth-rate)

### Inferences
- US$1M ARR is about US$83k MRR. For a consumer app at about US$4.5/month (assumed FX), that is about 18k+ paying subs, which is a different league from B2B SaaS, where a few hundred accounts can reach it. ChartMogul timelines are a ceiling reference, not a direct comparable.
- B2B SaaS timelines (median about 2.75 years to US$1M) suggest multi-year horizons are normal even in higher-ARPA businesses.

### Gaps
- No ChartMogul benchmark for the sub-US$1M ARR band (for example, months from first revenue to US$10k or US$100k ARR) was found.
- ChartMogul has no consumer-app breakdown.

## 3. Stripe (Atlas, annual letters, AI data), Baremetrics Open Startups, Paddle / Lemon Squeezy

### Takeaway
Stripe's data shows startups getting to first revenue faster. 20% of 2025 Atlas startups charged their first customer within 30 days of incorporation (8% in 2020). The top 100 AI companies on Stripe reached US$1M annualized revenue in a median of 11.5 months. These are survivorship-heavy, top-of-distribution samples.

### Cited Findings
- 20% of Atlas startups that incorporated in 2025 charged their first customer within 30 days, up from 8% in 2020; about 23,000 companies incorporated via Atlas in 2025 (measured) [primary] — [Stripe Atlas 2025 year in review](https://stripe.com/blog/stripe-atlas-startups-in-2025-year-in-review); [Stripe 2025 annual letter](https://stripe.com/newsroom/news/stripe-2025-update)
- The median Atlas startup incorporated in 2025 made 39% more revenue in its first 6 months than its 2024 counterpart; a growing share reached US$100k revenue within 6 months [primary] — [Patrick Collison, "Atlas Year"](https://patrickcollison.com/dispatches/atlas-year)
- 2025 letter: the 2025 cohort grew about 50% faster than 2024's; the number of companies reaching US$10M ARR within 3 months of launch doubled vs 2024 [primary] — [Stripe 2025 annual letter](https://stripe.com/newsroom/news/stripe-2025-update); [TechCrunch, 24 Feb 2026](https://techcrunch.com/2026/02/24/more-startups-are-hitting-10m-arr-in-3-months-than-ever-before)
- Top 100 AI companies on Stripe reached US$1M annualized revenue in a median of 11.5 months, 4 months ahead of the fastest-growing SaaS companies. Younger AI companies (founded 2020-2023) hit milestones about 3x faster than pre-2020 ones [primary] — [Stripe: Indexing the AI economy](https://stripe.com/guides/indexing-the-ai-economy); [Stripe blog: top AI companies](https://stripe.com/blog/inside-the-growth-of-the-top-ai-companies-on-stripe)
- 2024 letter: top AI startups reached US$5M ARR 13 months faster than comparable earlier software companies [primary] — [Stripe 2024 update](https://stripe.com/newsroom/news/stripe-2024-update)
- Caveat: Stripe's data shows speed but little about churn, payback or retention [secondary commentary] — [buildmvpfast](https://www.buildmvpfast.com/blog/stripe-2025-annual-letter-key-takeaways)

### Inferences
- Stripe's "top 100 AI" medians describe outliers. For a typical small consumer app, the 20%-first-customer-within-30-days figure is the more relevant base rate: early first revenue is common, but it says nothing about reaching scale.

### Gaps
- Baremetrics Open Startups: no aggregate dataset or statistics found in this pass (not searched in depth because of the tool-call budget).
- Paddle / Lemon Squeezy: no time-to-milestone reports found.
- No Stripe figure for median time to US$1M ARR for non-AI or consumer startups.

## 4. Indie Hackers / MicroConf "State of Independent SaaS": time to US$1k / US$10k MRR and share reaching them

### Takeaway
The best indie data are small samples. An Indie Hackers analysis of about 30 Stripe-verified founders found a median of 8 months to US$1k MRR (fastest quartile 5 months, slowest quartile 12 months). MicroConf's 2024 survey finds the largest single group (28%) is under US$1k MRR. There is no rigorous published median for US$10k MRR; blogs repeat "12-18 months" without traceable sourcing.

### Cited Findings
- Indie Hackers (2022), about 30 founders with Stripe-verified revenue: average about 9 months to US$1k MRR; fastest quartile 5 months, median 8 months, slowest quartile 12 months (measured, small n) [primary] — [Indie Hackers: "It takes 5 months to reach $1k in MRR"](https://www.indiehackers.com/post/it-takes-5-months-to-reach-1k-in-mrr-491742f806); [Indie Hackers: "How long does it take to hit $1K MRR?"](https://www.indiehackers.com/post/whats-new-how-long-does-it-take-to-hit-1k-mrr-35bda788b1)
- Indie Hackers community analysis of 290 founders' MRR posts: founders above US$1k MRR took a median of about 10 months, vs about 4 months for the under-US$1k group (self-reported; only 76 of 290 posts gave a price) [primary forum post, user-generated] — [Indie Hackers: 290 founders' MRR posts](https://www.indiehackers.com/post/i-went-through-290-founders-mrr-posts-the-ones-past-10k-got-their-first-customers-a-different-way-ff0f3e5904)
- MicroConf 2024 report: 28% of independent SaaS companies have under US$1,000 MRR, the largest group; benchmarks from 469 surveyed founders (a third-party blog cites 836 respondents, a conflict). 30% grow 1-4% MoM; about 30% are flat or shrinking. Full-time founders grow 2.2x faster than part-time; developer-led teams 1.7x faster. Enterprise-targeting companies grow about 27% MoM vs single digits for SMB/consumer [primary marketing pages] — [MicroConf $0-10K ARR founders](https://microconf.com/founders/0-10k-arr); [MicroConf $10K-100K ARR](https://microconf.com/founders/10k-100k-arr)
- MicroConf 2024 (4th annual) headline: 3-founder teams grow 2-3x faster; 30% fewer hires in 2023; founders planning to raise within 12 months fell from 30% to 23.5% [primary] — [MicroConf on X](https://x.com/MicroConf/status/1811478998217634242); [Startups for the Rest of Us ep. 721](https://www.startupsfortherestofus.com/episodes/episode-721-7-key-takeaways-from-the-2024-state-of-independent-saas-report)
- Secondary estimates, not traceable to MicroConf primary data: median 12-18 months to US$1k MRR; 12-18 months from first paying customer to US$10k MRR; "93% never reach US$10k" (estimate) — [SaaSRanger](https://saasranger.com/blog/micro-saas-revenue-reality-what-1000-founders-actually-earn/); [Superframeworks](https://superframeworks.com/articles/best-micro-saas-ideas-solopreneurs)
- Freemius 2025 micro-SaaS data exists (not read in detail) — [Freemius: State of Micro-SaaS 2025](https://freemius.com/blog/state-of-micro-saas-2025/)

### Inferences
- Indie B2B SaaS founders who reach US$1k MRR typically take about 5-12 months, but these samples are survivors who chose to share. Consumer apps at about US$4.5 ARPU need far more customers for the same MRR than indie SaaS at US$20-100+ ARPU, so consumer timelines plausibly run longer.
- MicroConf's finding that consumer-focused products grow in single digits MoM matches RevenueCat's low median growth (5.3% YoY MRR for the median app).

### Gaps
- No primary MicroConf median for "months to US$1k/US$10k MRR" was retrieved; the full PDF was not readable.
- No rigorous "share that ever reaches US$1k/US$10k" for indie founders beyond MicroConf's distribution snapshot.

## 5. Sensor Tower / Appfigures: how many apps earn more than US$1k or US$10k per month

### Takeaway
No Sensor Tower or Appfigures statistic on the share of apps earning more than US$1k or US$10k/month was found. The figures circulating come from RevenueCat (17.3% / 4.6% within 2 years) and Adapty (top 10% of apps take about 94.5-95% of subscription revenue).

### Cited Findings
- Appfigures 2025 market totals: 106.9B downloads in 2025 (down 2.7% YoY); non-game app consumer spending up 33.9% to US$82.6B (measured, store-wide estimates) — [Appfigures: State of Mobile Apps, Dec 2025](https://appfigures.com/resources/insights/most-downloaded-highest-earning-apps-december-2025)
- Adapty 2026: top 10% of apps take about 94.5-95% of subscription revenue; "8 in 10 new subscription apps never break US$10,000" [primary vendor; title-level extract, methodology not verified] — [Adapty: revenue concentration](https://adapty.io/blog/app-subscription-revenue-concentration/); [PPC Land on Adapty 2026](https://ppc.land/95-of-app-subscription-revenue-goes-to-top-10-adaptys-2026-benchmark-report/)
- Some blogs claim "94% of developers earn less than US$1,000/month" or "top 1% of apps earn 95% of store revenue" with no primary source; unreliable — [forasoft](https://www.forasoft.com/blog/article/app-revenue-potential)

### Inferences
- Across RevenueCat and Adapty, the vendor data agree: about 80-83% of new subscription apps never reach US$1k/month within 2 years, and about 95% never reach US$10k/month in that window.

### Gaps
- No Sensor Tower or Appfigures distribution of developer revenue by threshold was found. These firms publish top-chart and market totals, not long-tail distributions, in the material searched.

## 6. Freemium (free-to-paid) conversion: consumer apps, fitness/sports apps

### Takeaway
For mobile freemium subscription apps, RevenueCat's 2026 median D35 download-to-paid is about 2.1%, vs 10.7% for hard paywalls. Health & Fitness has a 2.9% D35 median (top quartile above 6.2%). The common "2-5% free-to-paid" rule comes mostly from B2B SaaS (OpenView). For Strava, the best estimate is about 2% of registered users paying (Sacra), and the company does not publish the figure.

### Cited Findings
- RevenueCat 2026: freemium D35 median 2.1% vs hard paywall 10.7%; Health & Fitness D35 median 2.9%, top quartile above 6.2% [primary] — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- Consumer freemium free-to-paid typically 1-5% (calculator/blog estimate) — [productgrowth.blog freemium calculator](https://www.productgrowth.blog/calculators/freemium)
- OpenView: typical band 2-5%; B2B SaaS median free-to-paid about 2.6%, top quartile 5-8% (2025) [secondary citing OpenView] — [artisangrowthstrategies](https://www.artisangrowthstrategies.com/blog/freemium-conversion-rate-benchmarks); [Userpilot](https://userpilot.com/blog/freemium-to-premium/)
- Strava: about 2% of registered users on premium; about 90% of revenue from subscriptions (estimate) — [Sacra: Strava](https://sacra.com/c/strava/). Older data points: Strava told Outside 20% of users paid (2013); a 2015 sample found 9 of 384 members (2.3%) premium; a 2019 analysis of pre-2016 accounts found 4.91% paying (estimates; different denominators) — [markslavonia.com "Sampling Strava"](http://markslavonia.com/sampling-strava/); [Cyclocosm](https://cyclocosm.com/2023/01/did-stravas-price-hike-response-reveal-its-business-is-imploding/)
- Strava says it is "nearly 100%" focused on subscriptions (at 50M users) — [Yahoo Finance / TechCrunch](https://finance.yahoo.com/news/strava-hits-50-m-users-and-is-nearly-100-focused-on-subscriptions-215424142.html)
- Adapty 2026: install-to-trial is 10.92% market-wide vs 5.31% for AI apps [primary vendor] — [Adapty State of In-App Subscriptions](https://adapty.io/state-of-in-app-subscriptions-report/)

### Inferences
- A freemium sports-stats PWA should plan around about 2-3% of active sign-ups paying within roughly the first month (RevenueCat freemium/H&F medians). The top quartile reaches about 6%. For LATAM, conversion may arrive later (week 6+).
- Using Strava's about 2% paid share as an upper-bound reference for a social sports app, about 11k-18k registered users would be needed for about 220-370 payers (about US$1k MRR at the assumed FX). This is an inference built on estimates.

### Gaps
- No sports-specific (non-fitness) consumer app conversion benchmarks were found.
- No PWA/web-only freemium conversion benchmark was found; all mobile figures come from App Store/Play SDK data.
