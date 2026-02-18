import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `Você é o LifeOS — um sistema de governo de decisão pessoal e empresarial baseado no Protocolo Luz & Vaso, Constituição Artigos I–VII.

## Sua Personalidade
- Direto, preciso, empático mas nunca permissivo
- Fala como um conselheiro sênior: firme, claro, sem rodeios
- Usa linguagem profissional mas acessível
- Nunca julga a pessoa, mas avalia friamente a situação
- Responde SEMPRE em português brasileiro
- Você tem MEMÓRIA — use as informações que já conhece sobre o usuário para personalizar cada resposta

## Suas Capacidades

### 1. Guiar Decisões
Quando o usuário quer tomar uma decisão, conduza uma avaliação completa coletando dados sobre:
- **Assessment do Líder**: energia (0-100), clareza mental (0-100), estresse (0-100, alto=ruim), confiança (0-100), carga decisória (0-100, alto=ruim)
- **Negócio**: receita, custos, dependência do fundador, frentes ativas, maturidade de processos, delegação
- **Financeiro**: receita, caixa, dívida, custos fixos, alavancagem pretendida
- **Relacional**: conflitos ativos, dependências críticas, alinhamento com parceiros, estabilidade do time, saúde do ecossistema
- **A Decisão**: descrição, tipo (existencial/estrutural/estratégica/tática), impacto, reversibilidade, urgência, recursos

Colete essas informações de forma CONVERSACIONAL — não como formulário. Faça perguntas inteligentes, agrupe quando fizer sentido, e adapte baseado nas respostas.

Quando tiver dados suficientes, use a tool "run_governance" para processar.

### 2. Analisar Padrões
Comente sobre o histórico do usuário, identifique padrões recorrentes, tendências de melhoria ou deterioração.

### 3. Coaching Contínuo
Ofereça orientação proativa baseada no estado atual. Sugira ações concretas.

### 4. Aprendizado Contínuo
Após cada interação significativa, extraia insights sobre o usuário usando a tool "update_memory" para atualizar o perfil evolutivo.

## Regras da Constituição
- **Art. I**: A IA nunca decide fora das regras. Ela executa governo.
- **Art. II**: Estado é classificado por energia, clareza, estresse, confiança e carga
- **Art. III**: Decisões são bloqueadas se o estado não comporta
- **Art. IV**: Hierarquia de decisão: Existencial > Estrutural > Estratégica > Tática
- **Art. V**: Cenários são simulados antes de qualquer veredito
- **Art. VI**: Plano de prontidão é gerado quando decisão é bloqueada
- **Art. VII**: O sistema protege o líder de si mesmo

## Estados de Capacidade
- Falha Estrutural Ativa (0-15): BLOQUEIO total
- Capacidade Insuficiente (16-30): Apenas táticas simples
- Risco de Falha (20-35): Atenção máxima
- Sob Tensão (36-50): Decisões limitadas
- Recuperação (20-40): Foco em reconstruir
- Em Construção (40-60): Crescimento controlado
- Capacidade Estável (55-75): Decisões estratégicas permitidas
- Expansão Controlada (76-100): Todas decisões permitidas

## Formato de Respostas
- Use **markdown** para formatar
- Use emojis com moderação (🟢 🟡 🔴 para indicadores)
- Tabelas para comparações
- Bullet points para ações
- Seja conciso mas completo

## Mensagem Inicial
Quando não há contexto, apresente-se brevemente e pergunte o que o usuário precisa: tomar uma decisão, revisar seu estado atual, ou receber orientação. Se já conhece o usuário, cumprimente-o pelo nome e faça referência ao contexto que já possui.`;

function buildSystemPrompt(memoryContext?: string): string {
  if (!memoryContext) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\n## Contexto do Usuário (Memória de Longo Prazo)\n${memoryContext}`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "run_governance",
      description:
        "Extract all governance assessment data from the conversation to run the decision engine. Call this when you have collected enough data from the user.",
      parameters: {
        type: "object",
        properties: {
          assessment: {
            type: "object",
            properties: {
              energy: { type: "number", description: "0-100" },
              clarity: { type: "number", description: "0-100" },
              stress: { type: "number", description: "0-100, high=bad" },
              confidence: { type: "number", description: "0-100" },
              load: { type: "number", description: "0-100, high=bad" },
            },
            required: ["energy", "clarity", "stress", "confidence", "load"],
          },
          business: {
            type: "object",
            properties: {
              revenue: { type: "number" },
              costs: { type: "number" },
              founderDependence: { type: "number", description: "0-100" },
              activeFronts: { type: "number", description: "1-10" },
              processMaturity: { type: "number", description: "0-100" },
              delegationCapacity: { type: "number", description: "0-100" },
            },
            required: ["revenue", "costs", "founderDependence", "activeFronts", "processMaturity", "delegationCapacity"],
          },
          financial: {
            type: "object",
            properties: {
              revenue: { type: "number" },
              cash: { type: "number" },
              debt: { type: "number" },
              fixedCosts: { type: "number" },
              intendedLeverage: { type: "number" },
            },
            required: ["revenue", "cash", "debt", "fixedCosts", "intendedLeverage"],
          },
          relational: {
            type: "object",
            properties: {
              activeConflicts: { type: "number" },
              criticalDependencies: { type: "number" },
              partnerAlignment: { type: "number", description: "0-100" },
              teamStability: { type: "number", description: "0-100" },
              ecosystemHealth: { type: "number", description: "0-100" },
            },
            required: ["activeConflicts", "criticalDependencies", "partnerAlignment", "teamStability", "ecosystemHealth"],
          },
          decision: {
            type: "object",
            properties: {
              description: { type: "string" },
              type: { type: "string", enum: ["existential", "structural", "strategic", "tactical"] },
              impact: { type: "string", enum: ["transformational", "high", "medium", "low"] },
              reversibility: { type: "string", enum: ["irreversible", "difficult", "moderate", "easy"] },
              urgency: { type: "string", enum: ["critical", "high", "moderate", "low"] },
              resourcesRequired: { type: "string", enum: ["massive", "significant", "moderate", "minimal"] },
            },
            required: ["description", "type", "impact", "reversibility", "urgency", "resourcesRequired"],
          },
        },
        required: ["assessment", "business", "financial", "relational", "decision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_memory",
      description:
        "Extract new insights, patterns, or updated information about the user from the conversation. Call this when you learn something new about the user that should be remembered for future sessions.",
      parameters: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: ["profile", "business", "emotional", "patterns", "preferences", "insights"],
                },
                key: { type: "string", description: "A short key describing the fact" },
                value: { type: "string", description: "The value/content to remember" },
              },
              required: ["category", "key", "value"],
            },
          },
        },
        required: ["entries"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, extractData, memoryContext } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(memoryContext);

    if (extractData) {
      // Non-streaming extraction mode
      const body = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
        tools: [{
          name: "run_governance",
          description: TOOLS[0].function.description,
          input_schema: TOOLS[0].function.parameters,
        }],
        tool_choice: { type: "tool", name: "run_governance" },
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const t = await response.text();
        console.error("Anthropic API error:", response.status, t);
        return new Response(
          JSON.stringify({ error: "Erro no gateway de IA" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      // Transform Anthropic format to OpenAI-compatible format for frontend
      const toolUse = data.content?.find((b: any) => b.type === "tool_use");
      const openAIFormat = {
        choices: [{
          message: {
            tool_calls: toolUse ? [{
              function: {
                name: toolUse.name,
                arguments: JSON.stringify(toolUse.input),
              }
            }] : []
          }
        }]
      };
      return new Response(JSON.stringify(openAIFormat), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming chat mode
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Verifique sua conta na Anthropic." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no gateway de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Anthropic SSE stream to OpenAI-compatible format
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nlIdx;
            while ((nlIdx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nlIdx);
              buffer = buffer.slice(nlIdx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);

              if (!line.startsWith("data: ") || line.trim() === "") continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  const openAIChunk = {
                    choices: [{ delta: { content: event.delta.text } }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
                } else if (event.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch { /* skip non-JSON lines */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
