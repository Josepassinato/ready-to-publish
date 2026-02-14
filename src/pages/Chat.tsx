import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { streamChat, extractGovernanceData } from "@/lib/chat-stream";
import { govern } from "@/lib/governance-engine";
import { saveDecision, saveStateClassification } from "@/lib/supabase-utils";
import { recordPipelineAudit } from "@/lib/audit-logger";
import { isLLMEnabled, setFeatureFlag, FLAGS } from "@/lib/feature-flags";
import { getUserMemoryContext, saveChatMessages } from "@/lib/memory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, Send, Loader2, Zap, BarChart3, Clock, ShieldOff, Mic, MicOff, Volume2, VolumeX, Loader } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";
import { useToast } from "@/hooks/use-toast";
import type { Msg } from "@/lib/chat-stream";
import ReactMarkdown from "react-markdown";

interface ChatMessage extends Msg {
  id: string;
  governanceResult?: any;
}

const QUICK_ACTIONS = [
  { label: "Nova Decisão", icon: Zap, prompt: "Preciso tomar uma decisão importante. Me ajude a avaliar." },
  { label: "Meu Estado", icon: BarChart3, prompt: "Como está minha capacidade de decisão agora? Faça uma avaliação rápida." },
  { label: "Revisar Histórico", icon: Clock, prompt: "Analise meu histórico de decisões e me diga o que você observa." },
];

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [memoryContext, setMemoryContext] = useState<string>("");
  const [llmEnabled, setLlmEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const { isPlaying, isRecording, currentTranscript, speak, stopPlaying, startRecording, stopRecording } = useVoice();

  // Load memory context and feature flags on mount
  useEffect(() => {
    if (user) {
      getUserMemoryContext(user.id).then(setMemoryContext);
      isLLMEnabled(user.id).then(setLlmEnabled);
    }
  }, [user]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleToggleLLM = async () => {
    if (!user) return;
    const newValue = !llmEnabled;
    setLlmEnabled(newValue);
    await setFeatureFlag(user.id, FLAGS.LLM_ENABLED, newValue);
    toast({
      title: newValue ? "IA Ativada" : "Kill-Switch Ativado",
      description: newValue
        ? "A IA voltou a operar normalmente."
        : "Modo rules-only ativo. Vereditos serão puramente estruturados.",
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Kill-switch: block AI chat when LLM is disabled
    if (!llmEnabled) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };
      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `🛡️ **Kill-Switch Ativo** — A IA está desativada. O sistema opera em modo rules-only.\n\nVocê pode:\n- **Processar decisões** pelo botão abaixo (motor determinístico)\n- **Reativar a IA** pelo toggle no canto superior\n\nNenhuma IA é consultada neste modo. Apenas as regras da Constituição Art. I–VII são executadas.`,
      };
      setMessages((prev) => [...prev, userMsg, systemMsg]);
      setInput("");
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const assistantId = crypto.randomUUID();

    const allMessages: Msg[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: userMsg.role, content: userMsg.content },
    ];

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id === assistantId) {
          return prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantSoFar } : m
          );
        }
        return [
          ...prev,
          { id: assistantId, role: "assistant" as const, content: assistantSoFar },
        ];
      });
    };

    try {
      await streamChat({
        messages: allMessages,
        memoryContext,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsLoading(false);
          if (user && assistantSoFar) {
            saveChatMessages(user.id, sessionIdRef.current, [
              { role: "user", content: text.trim() },
              { role: "assistant", content: assistantSoFar },
            ]);
          }
        },
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro",
        description: e.message || "Falha na comunicação",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleRunGovernance = async () => {
    if (!user) return;
    setIsExtracting(true);

    try {
      let extracted;

      if (llmEnabled) {
        // Normal mode: use AI to extract data from conversation
        const allMsgs: Msg[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        extracted = await extractGovernanceData(allMsgs);
      } else {
        // Kill-switch mode: prompt user that extraction requires manual data
        // For now, try to extract from the last messages without AI
        toast({
          title: "Modo Rules-Only",
          description: "A IA está desativada. Utilize o fluxo completo de decisão para inserir dados manualmente.",
        });
        setIsExtracting(false);
        navigate("/decision/new");
        return;
      }

      const result = govern(
        extracted.assessment,
        extracted.business,
        extracted.financial,
        extracted.relational,
        extracted.decision
      );

      (result as any)._description = extracted.decision.description;
      (result as any)._impact = extracted.decision.impact;
      (result as any)._reversibility = extracted.decision.reversibility;
      (result as any)._urgency = extracted.decision.urgency;
      (result as any)._resourcesRequired = extracted.decision.resourcesRequired;

      // Audit Logger: record full pipeline (non-blocking)
      recordPipelineAudit(user.id, {
        assessment: extracted.assessment,
        business: extracted.business,
        financial: extracted.financial,
        relational: extracted.relational,
        decision: extracted.decision,
      }, result).catch(err => console.error("[AuditLogger]", err));

      await saveStateClassification(
        user.id,
        extracted.assessment,
        result.overallScore,
        result.state.id,
        result.state.label,
        result.state.severity,
        result.stateConfidence
      );

      const saved = await saveDecision(result, user.id);

      const verdictEmoji = result.verdict === "SIM" ? "🟢" : "🔴";
      const resultMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `## ${verdictEmoji} Veredito: **${result.verdict}**

**Score Geral:** ${result.overallScore}%  
**Estado:** ${result.state.label} (severidade ${result.state.severity})

| Domínio | Score |
|---------|-------|
${result.domainDetails.map((d: any) => `| ${d.label} | ${d.score}% |`).join("\n")}

${result.blocked ? "⚠️ **Decisão BLOQUEADA** — sua capacidade atual não comporta esta decisão." : "✅ Decisão liberada pelo protocolo."}

${result.readinessPlan ? `### Plano de Prontidão\n${result.readinessPlan.actions.map((a: any) => `- ${a.action}`).join("\n")}` : ""}

[Ver análise completa →](/decision/${saved.id})`,
        governanceResult: result,
      };

      setMessages((prev) => [...prev, resultMsg]);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao processar",
        description: e.message || "Não foi possível extrair os dados da conversa",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasEnoughContext = messages.filter((m) => m.role === "user").length >= 3;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-3.5rem)]">
      {/* Kill-Switch Banner */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 px-4 py-2">
        <div className="flex items-center gap-2">
          {!llmEnabled && (
            <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
              <ShieldOff className="h-3 w-3" />
              Rules-Only
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{llmEnabled ? "IA Ativa" : "Kill-Switch"}</span>
          <Switch
            checked={llmEnabled}
            onCheckedChange={handleToggleLLM}
            className="data-[state=unchecked]:bg-destructive/50"
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mx-auto max-w-3xl space-y-6 pt-6">
          {!llmEnabled && messages.length === 0 && (
            <div className="mx-auto max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
              <ShieldOff className="mx-auto mb-2 h-8 w-8 text-destructive" />
              <h3 className="font-semibold text-foreground">Modo Rules-Only</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A IA está desativada. O motor de governança opera exclusivamente pelas regras da Constituição Art. I–VII. Use o fluxo de decisão para processar vereditos determinísticos.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate("/decision/new")}
              >
                <Zap className="mr-2 h-4 w-4" />
                Iniciar Decisão Manual
              </Button>
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8">
              <div className="space-y-3 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">LifeOS</h1>
                <p className="text-sm text-muted-foreground max-w-md">
                  Sistema de Governo de Decisão. Me diga o que você precisa — tomar uma decisão, avaliar seu estado ou receber orientação.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="h-auto flex-col items-start gap-1 px-4 py-3 text-left border-border hover:bg-muted"
                    onClick={() => sendMessage(action.prompt)}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <action.icon className="h-4 w-4 text-primary" />
                      {action.label}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div>
                    <div className="prose prose-sm prose-invert max-w-none [&_table]:text-sm [&_th]:text-left [&_th]:pr-4 [&_td]:pr-4 [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              onClick={(e) => {
                                if (href?.startsWith("/")) {
                                  e.preventDefault();
                                  navigate(href);
                                }
                              }}
                              className="text-primary hover:underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => isPlaying ? stopPlaying() : speak(msg.content)}
                        title={isPlaying ? "Parar" : "Ouvir"}
                      >
                        {isPlaying ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-3xl space-y-3">
          {hasEnoughContext && !isExtracting && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleRunGovernance}
              >
                <Zap className="mr-2 h-4 w-4" />
                Processar Decisão pelo Protocolo
              </Button>
            </div>
          )}

          {isExtracting && (
            <div className="flex justify-center">
              <Badge variant="outline" className="gap-2 border-primary/30 text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Extraindo dados e executando motor de governança...
              </Badge>
            </div>
          )}

          {/* Live transcript preview */}
          {isRecording && currentTranscript && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground animate-pulse">
              🎙️ {currentTranscript}
            </div>
          )}

          <div className="relative flex items-end gap-2">
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className={`h-10 w-10 shrink-0 ${isRecording ? "animate-pulse" : ""}`}
              onClick={() => {
                if (isRecording) {
                  const text = stopRecording();
                  if (text) sendMessage(text);
                } else {
                  startRecording();
                }
              }}
              disabled={isLoading}
              title={isRecording ? "Parar e enviar" : "Falar em tempo real"}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <div className="relative flex-1">
              <Textarea
                ref={undefined}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva sua decisão, peça orientação, ou avalie seu estado..."
                className="min-h-[52px] max-h-40 resize-none bg-muted border-border pr-12"
                rows={1}
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Protocolo Luz & Vaso · Constituição Artigos I–VII
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
