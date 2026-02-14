import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { streamChat, extractGovernanceData } from "@/lib/chat-stream";
import { govern } from "@/lib/governance-engine";
import { saveDecision, saveStateClassification } from "@/lib/supabase-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, Send, Loader2, Zap, BarChart3, Clock } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

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
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
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
      const allMsgs: Msg[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const extracted = await extractGovernanceData(allMsgs);
      const result = govern(
        extracted.assessment,
        extracted.business,
        extracted.financial,
        extracted.relational,
        extracted.decision
      );

      // Augment for saving
      (result as any)._description = extracted.decision.description;
      (result as any)._impact = extracted.decision.impact;
      (result as any)._reversibility = extracted.decision.reversibility;
      (result as any)._urgency = extracted.decision.urgency;
      (result as any)._resourcesRequired = extracted.decision.resourcesRequired;

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

      // Add result summary to chat
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
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mx-auto max-w-3xl space-y-6 pt-6">
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

          <div className="relative">
            <Textarea
              ref={textareaRef}
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

          <p className="text-center text-xs text-muted-foreground">
            Protocolo Luz & Vaso · Constituição Artigos I–VII
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
