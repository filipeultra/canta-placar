// ULTRA PLAY · análise do jogo por IA (Supabase Edge Function, Deno).
// Recebe só os FATOS da partida (números; jogadores como J1, J2… e times como T1/T2 — os nomes ficam no aparelho),
// confere se a pessoa é Pro e está dentro da cota do mês, pede o texto ao Claude e devolve { text }.
// Deploy: supabase functions deploy analise  ·  Segredo: supabase secrets set ANTHROPIC_API_KEY=...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODEL = "claude-haiku-5-5";          // modelo pequeno e rápido; trocar aqui se quiser outro
const MONTHLY_LIMIT = 60;                  // análises por mês por pessoa (Pro)
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const SYSTEM = `Você é o treinador do ULTRA PLAY, app de placar e estatística de beach tennis, padel, tênis, peteca, vôlei de praia e futevôlei.
Recebe os números de UMA partida e escreve uma análise curta em português do Brasil, para o jogador ler no celular logo depois do jogo.
Regras:
- Use só os números recebidos. Não invente lance, golpe, clima nem placar.
- Chame os times por T1 e T2 e os jogadores pelos códigos (J1, J2…), exatamente assim: o app troca pelos nomes.
- Se "meu_time" vier preenchido, fale com essa pessoa ("você"). Senão, fale dos dois times.
- Formato: 1 frase de resumo; depois 3 a 4 frases curtas, uma por linha, sobre onde o jogo foi decidido (pontos importantes, erros, saque, reta final, sequências); por fim uma linha começando com "Treino:" com UMA sugestão prática para o próximo jogo.
- Tom de professor amigo: direto, sem exagero, sem emojis, sem markdown. No máximo 110 palavras.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "entre na conta" }, 401);

  // Pro e cota do mês (tabela ai_usage em schema.sql; a leitura respeita as regras por linha)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: prof } = await admin.from("profiles").select("pro_until").eq("id", user.id).single();
  if (!prof || !prof.pro_until || new Date(prof.pro_until) < new Date()) return json({ error: "recurso do Pro" }, 402);
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since.toISOString());
  if ((count || 0) >= MONTHLY_LIMIT) return json({ error: "limite do mês atingido" }, 429);

  let body: { facts?: unknown; match_id?: string };
  try { body = await req.json(); } catch { return json({ error: "corpo inválido" }, 400); }
  const facts = JSON.stringify(body.facts ?? {});
  if (facts.length > 12000) return json({ error: "dados grandes demais" }, 413);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 400,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "Fatos da partida (JSON):\n" + facts }],
    }),
  });
  if (!r.ok) return json({ error: "IA indisponível", status: r.status }, 502);
  const out = await r.json();
  const text = (out.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
  await admin.from("ai_usage").insert({ user_id: user.id, match_id: typeof body.match_id === "string" ? body.match_id.slice(0, 64) : null,
    model: MODEL, input_tokens: out.usage?.input_tokens ?? 0, output_tokens: out.usage?.output_tokens ?? 0 });
  return json({ text });
});

function json(v: unknown, status = 200) { return new Response(JSON.stringify(v), { status, headers: { ...CORS, "content-type": "application/json" } }); }
