import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_ID");

    let telegramStatus = { configured: false, botName: null as string | null, webhookActive: false };
    let whatsappStatus = { configured: false, phoneId: null as string | null };

    if (telegramToken) {
      telegramStatus.configured = true;
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${telegramToken}/getMe`);
        const meData = await meRes.json();
        if (meData.ok) telegramStatus.botName = meData.result.username;

        const whRes = await fetch(`https://api.telegram.org/bot${telegramToken}/getWebhookInfo`);
        const whData = await whRes.json();
        if (whData.ok && whData.result.url) telegramStatus.webhookActive = true;
      } catch { /* ignore */ }
    }

    if (whatsappToken && whatsappPhoneId) {
      whatsappStatus.configured = true;
      whatsappStatus.phoneId = whatsappPhoneId;
    }

    return new Response(JSON.stringify({ telegram: telegramStatus, whatsapp: whatsappStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
