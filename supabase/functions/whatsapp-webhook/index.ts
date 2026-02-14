import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Conversation state (keyed by phone number) ──
const sessions: Record<string, {
  step: number;
  data: Record<string, any>;
  lastActivity: number;
}> = {};

const STEPS = [
  { key: "energy", prompt: "⚡ Energia agora? (0-100)" },
  { key: "clarity", prompt: "🧠 Clareza mental? (0-100)" },
  { key: "stress", prompt: "😰 Estresse? (0-100, alto=ruim)" },
  { key: "confidence", prompt: "💪 Confiança? (0-100)" },
  { key: "load", prompt: "📦 Carga decisória? (0-100, alto=ruim)" },
  { key: "revenue", prompt: "💰 Receita mensal (R$)?" },
  { key: "costs", prompt: "📊 Custos mensais (R$)?" },
  { key: "founderDependence", prompt: "👤 Dependência do fundador? (0-100)" },
  { key: "activeFronts", prompt: "🎯 Frentes ativas? (1-10)" },
  { key: "processMaturity", prompt: "⚙️ Maturidade de processos? (0-100)" },
  { key: "delegationCapacity", prompt: "🤝 Capacidade de delegação? (0-100)" },
  { key: "fin_revenue", prompt: "💵 Receita financeira mensal (R$)?" },
  { key: "cash", prompt: "🏦 Caixa disponível (R$)?" },
  { key: "debt", prompt: "📉 Dívida total (R$)?" },
  { key: "fixedCosts", prompt: "🔒 Custos fixos mensais (R$)?" },
  { key: "intendedLeverage", prompt: "📈 Alavancagem pretendida (R$)?" },
  { key: "description", prompt: "📝 Descreva a decisão:" },
  { key: "type", prompt: "🏷️ Tipo: existential, structural, strategic ou tactical?" },
  { key: "impact", prompt: "💥 Impacto: transformational, high, medium ou low?" },
];

async function sendWhatsAppMessage(token: string, phoneId: string, to: string, text: string) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

function processGovernance(data: Record<string, any>) {
  const assessment = {
    energy: Number(data.energy), clarity: Number(data.clarity),
    stress: Number(data.stress), confidence: Number(data.confidence), load: Number(data.load),
  };
  const humanScore = Math.round(
    assessment.energy * 0.25 + assessment.clarity * 0.3 + (100 - assessment.stress) * 0.2 +
    assessment.confidence * 0.15 + (100 - assessment.load) * 0.1
  );
  const businessScore = Math.round(50); // simplified for WhatsApp
  const overallScore = Math.round(humanScore * 0.4 + businessScore * 0.3 + 50 * 0.15 + 50 * 0.15);
  const blocked = overallScore < 35;
  const verdict = blocked ? "NÃO AGORA" : "SIM";

  return { verdict, overallScore, humanScore, businessScore, blocked, description: data.description || "Decisão via WhatsApp" };
}

function formatVerdict(result: any): string {
  const emoji = result.verdict === "SIM" ? "🟢" : "🔴";
  return `${emoji} *Veredito: ${result.verdict}*

📊 Score Geral: ${result.overallScore}%
👤 Score Humano: ${result.humanScore}%

${result.blocked ? "⚠️ Decisão BLOQUEADA — sua capacidade atual não comporta." : "✅ Decisão liberada pelo protocolo."}

📝 ${result.description}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
  const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "lifeos-verify-2026";

  // GET: Meta webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return new Response(JSON.stringify({ error: "WhatsApp credentials not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Extract message from webhook payload
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const messageObj = change?.value?.messages?.[0];

    if (!messageObj?.text?.body) {
      return new Response("ok", { headers: corsHeaders });
    }

    const from = messageObj.from; // phone number
    const text = messageObj.text.body.trim().toLowerCase();

    // Commands
    if (text === "ajuda" || text === "menu" || text === "oi" || text === "olá") {
      await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from,
        "🛡️ LifeOS — Motor de Governo\n\nDigite:\n• *decidir* — Iniciar avaliação\n• *estado* — Check rápido\n• *cancelar* — Cancelar fluxo"
      );
      return new Response("ok", { headers: corsHeaders });
    }

    if (text === "cancelar") {
      delete sessions[from];
      await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from, "❌ Fluxo cancelado.");
      return new Response("ok", { headers: corsHeaders });
    }

    if (text === "decidir") {
      sessions[from] = { step: 0, data: {}, lastActivity: Date.now() };
      await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from,
        `🛡️ Iniciando Avaliação (${STEPS.length} etapas)\n\n${STEPS[0].prompt}`
      );
      return new Response("ok", { headers: corsHeaders });
    }

    if (text === "estado") {
      sessions[from] = { step: -1, data: { quickCheck: true }, lastActivity: Date.now() };
      await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from,
        "⚡ Responda: Energia, Clareza, Estresse (0-100)\n\nExemplo: 70, 80, 30"
      );
      return new Response("ok", { headers: corsHeaders });
    }

    // Quick check
    const session = sessions[from];
    if (session?.data.quickCheck) {
      const parts = messageObj.text.body.split(",").map((s: string) => Number(s.trim()));
      if (parts.length >= 3 && parts.every((n: number) => !isNaN(n))) {
        const [energy, clarity, stress] = parts;
        const score = Math.round(energy * 0.3 + clarity * 0.35 + (100 - stress) * 0.35);
        const emoji = score >= 60 ? "🟢" : score >= 35 ? "🟡" : "🔴";
        await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from,
          `${emoji} Capacidade: ${score}%\n\n⚡ Energia: ${energy}\n🧠 Clareza: ${clarity}\n😰 Estresse: ${stress}\n\n${score >= 60 ? "Boa capacidade." : score >= 35 ? "Atenção — limitada." : "⚠️ Insuficiente. Evite decisões importantes."}`
        );
        delete sessions[from];
      } else {
        await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from, "Formato: 70, 80, 30");
      }
      return new Response("ok", { headers: corsHeaders });
    }

    // Decision flow
    if (session && session.step >= 0 && session.step < STEPS.length) {
      session.data[STEPS[session.step].key] = messageObj.text.body.trim();
      session.step++;
      session.lastActivity = Date.now();

      if (session.step >= STEPS.length) {
        await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from, "⏳ Processando...");
        const result = processGovernance(session.data);
        await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from, formatVerdict(result));
        delete sessions[from];
      } else {
        await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from,
          `✅ (${session.step}/${STEPS.length})\n\n${STEPS[session.step].prompt}`
        );
      }
      return new Response("ok", { headers: corsHeaders });
    }

    // Default
    await sendWhatsAppMessage(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, from,
      "Digite *decidir* para avaliar uma decisão ou *estado* para check rápido."
    );
    return new Response("ok", { headers: corsHeaders });

  } catch (e) {
    console.error("whatsapp-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
