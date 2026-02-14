import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Conversation state (in-memory per instance, keyed by chat_id) ──
const sessions: Record<string, {
  step: number;
  data: Record<string, any>;
  lastActivity: number;
}> = {};

const STEPS = [
  { key: "energy", prompt: "⚡ Qual sua energia agora? (0-100)", group: "assessment" },
  { key: "clarity", prompt: "🧠 Clareza mental? (0-100)", group: "assessment" },
  { key: "stress", prompt: "😰 Nível de estresse? (0-100, alto=ruim)", group: "assessment" },
  { key: "confidence", prompt: "💪 Confiança? (0-100)", group: "assessment" },
  { key: "load", prompt: "📦 Carga decisória? (0-100, alto=ruim)", group: "assessment" },
  { key: "revenue", prompt: "💰 Receita mensal (R$)?", group: "business" },
  { key: "costs", prompt: "📊 Custos mensais (R$)?", group: "business" },
  { key: "founderDependence", prompt: "👤 Dependência do fundador? (0-100)", group: "business" },
  { key: "activeFronts", prompt: "🎯 Quantas frentes ativas? (1-10)", group: "business" },
  { key: "processMaturity", prompt: "⚙️ Maturidade de processos? (0-100)", group: "business" },
  { key: "delegationCapacity", prompt: "🤝 Capacidade de delegação? (0-100)", group: "business" },
  { key: "fin_revenue", prompt: "💵 Receita financeira mensal (R$)?", group: "financial" },
  { key: "cash", prompt: "🏦 Caixa disponível (R$)?", group: "financial" },
  { key: "debt", prompt: "📉 Dívida total (R$)?", group: "financial" },
  { key: "fixedCosts", prompt: "🔒 Custos fixos mensais (R$)?", group: "financial" },
  { key: "intendedLeverage", prompt: "📈 Alavancagem pretendida (R$)?", group: "financial" },
  { key: "description", prompt: "📝 Descreva a decisão:", group: "decision" },
  { key: "type", prompt: "🏷️ Tipo: existential, structural, strategic ou tactical?", group: "decision" },
  { key: "impact", prompt: "💥 Impacto: transformational, high, medium ou low?", group: "decision" },
];

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

async function processGovernance(data: Record<string, any>, supabaseUrl: string, anonKey: string) {
  // Call the chat edge function with extractData mode to run governance
  const assessment = {
    energy: Number(data.energy), clarity: Number(data.clarity),
    stress: Number(data.stress), confidence: Number(data.confidence), load: Number(data.load),
  };
  const business = {
    revenue: Number(data.revenue), costs: Number(data.costs),
    founderDependence: Number(data.founderDependence), activeFronts: Number(data.activeFronts),
    processMaturity: Number(data.processMaturity), delegationCapacity: Number(data.delegationCapacity),
  };
  const financial = {
    revenue: Number(data.fin_revenue), cash: Number(data.cash),
    debt: Number(data.debt), fixedCosts: Number(data.fixedCosts), intendedLeverage: Number(data.intendedLeverage),
  };
  const decision = {
    description: data.description || "Decisão via Telegram",
    type: data.type || "tactical",
    impact: data.impact || "medium",
    reversibility: "moderate", urgency: "moderate", resourcesRequired: "moderate",
  };

  // Use simplified governance scoring (same logic as governance-engine.ts)
  const humanScore = Math.round(
    (assessment.energy * 0.25 + assessment.clarity * 0.3 + (100 - assessment.stress) * 0.2 +
      assessment.confidence * 0.15 + (100 - assessment.load) * 0.1)
  );
  const businessScore = Math.round(
    ((business.revenue > 0 ? Math.min((business.revenue - business.costs) / business.revenue * 100, 100) : 0) * 0.3 +
      (100 - business.founderDependence) * 0.25 +
      (Math.max(0, 100 - (business.activeFronts - 3) * 15)) * 0.15 +
      business.processMaturity * 0.15 + business.delegationCapacity * 0.15)
  );
  const overallScore = Math.round(humanScore * 0.4 + businessScore * 0.3 + 50 * 0.15 + 50 * 0.15);
  const blocked = overallScore < 35;
  const verdict = blocked ? "NÃO AGORA" : "SIM";

  return { verdict, overallScore, humanScore, businessScore, blocked, assessment, decision };
}

function formatVerdict(result: any): string {
  const emoji = result.verdict === "SIM" ? "🟢" : "🔴";
  return `${emoji} *Veredito: ${result.verdict}*

📊 *Score Geral:* ${result.overallScore}%
👤 *Score Humano:* ${result.humanScore}%
🏢 *Score Negócio:* ${result.businessScore}%

${result.blocked ? "⚠️ *Decisão BLOQUEADA* — sua capacidade atual não comporta." : "✅ Decisão liberada pelo protocolo."}

📝 _${result.decision.description}_`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!TELEGRAM_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);

    // GET: setup webhook
    if (req.method === "GET" && url.searchParams.get("setup") === "true") {
      const webhookUrl = url.searchParams.get("webhook_url") || `${SUPABASE_URL}/functions/v1/telegram-webhook`;
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: handle Telegram update
    const update = await req.json();
    const message = update.message;
    if (!message?.text) {
      return new Response("ok", { headers: corsHeaders });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Commands
    if (text === "/start" || text === "/help") {
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
        `🛡️ *LifeOS — Motor de Governo*\n\nComandos:\n/decidir — Iniciar avaliação de decisão\n/estado — Check rápido de capacidade\n/cancelar — Cancelar fluxo atual`
      );
      return new Response("ok", { headers: corsHeaders });
    }

    if (text === "/cancelar") {
      delete sessions[chatId];
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fluxo cancelado.");
      return new Response("ok", { headers: corsHeaders });
    }

    if (text === "/decidir") {
      sessions[chatId] = { step: 0, data: {}, lastActivity: Date.now() };
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
        `🛡️ *Iniciando Avaliação de Decisão*\n\nVou coletar dados em ${STEPS.length} etapas.\n\n${STEPS[0].prompt}`
      );
      return new Response("ok", { headers: corsHeaders });
    }

    if (text === "/estado") {
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
        "⚡ Responda rapidamente:\nEnergia (0-100), Clareza (0-100), Estresse (0-100)\n\nExemplo: `70, 80, 30`"
      );
      sessions[chatId] = { step: -1, data: { quickCheck: true }, lastActivity: Date.now() };
      return new Response("ok", { headers: corsHeaders });
    }

    // Quick check mode
    const session = sessions[chatId];
    if (session?.data.quickCheck) {
      const parts = text.split(",").map(s => Number(s.trim()));
      if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
        const [energy, clarity, stress] = parts;
        const score = Math.round(energy * 0.3 + clarity * 0.35 + (100 - stress) * 0.35);
        const emoji = score >= 60 ? "🟢" : score >= 35 ? "🟡" : "🔴";
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
          `${emoji} *Capacidade Atual: ${score}%*\n\n⚡ Energia: ${energy}\n🧠 Clareza: ${clarity}\n😰 Estresse: ${stress}\n\n${score >= 60 ? "Você está em boa capacidade." : score >= 35 ? "Atenção — capacidade limitada." : "⚠️ Capacidade insuficiente. Evite decisões importantes."}`
        );
        delete sessions[chatId];
      } else {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "Formato: `70, 80, 30` (energia, clareza, estresse)");
      }
      return new Response("ok", { headers: corsHeaders });
    }

    // Decision flow
    if (session && session.step >= 0 && session.step < STEPS.length) {
      const currentStep = STEPS[session.step];
      session.data[currentStep.key] = text;
      session.step++;
      session.lastActivity = Date.now();

      if (session.step >= STEPS.length) {
        // All data collected — process
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "⏳ Processando pelo Motor de Governo...");
        const result = await processGovernance(session.data, SUPABASE_URL!, SUPABASE_ANON_KEY!);
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, formatVerdict(result));
        delete sessions[chatId];
      } else {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `✅ (${session.step}/${STEPS.length})\n\n${STEPS[session.step].prompt}`);
      }
      return new Response("ok", { headers: corsHeaders });
    }

    // Default: not in a flow
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
      "Use /decidir para iniciar uma avaliação ou /estado para um check rápido."
    );
    return new Response("ok", { headers: corsHeaders });

  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
