import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Copy, MessageSquare, Send } from "lucide-react";

interface ChannelStatus {
  telegram: { configured: boolean; botName: string | null; webhookActive: boolean };
  whatsapp: { configured: boolean; phoneId: string | null };
}

const TelegramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.65-2.89 7.99-3.44 3.81-1.59 4.6-1.87 5.12-1.87.11 0 .37.03.53.17.14.12.18.27.2.47-.01.06.01.24 0 .46z" fill="hsl(200, 74%, 55%)"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="hsl(145, 70%, 42%)"/>
  </svg>
);

const Channels = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("channel-status");
      if (error) throw error;
      setStatus(data);
    } catch (e) {
      console.error("Failed to fetch channel status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
  };

  const setupTelegramWebhook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("telegram-webhook", {
        body: null,
        method: "GET",
        headers: {},
      });
      // Use fetch directly for GET with query params
      const res = await fetch(`${webhookUrl}/telegram-webhook?setup=true`, {
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (result.ok) {
        toast({ title: "Webhook configurado!", description: "O Telegram está conectado ao LifeOS." });
        fetchStatus();
      } else {
        throw new Error(result.description || "Falha ao configurar webhook");
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Canais de Mensagem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte Telegram e WhatsApp para interagir com o Motor de Governo direto no chat.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(200,74%,55%)]/10">
              <TelegramIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Telegram</p>
              <p className="text-xs text-muted-foreground">
                {loading ? "Verificando..." : status?.telegram.configured
                  ? status.telegram.botName ? `@${status.telegram.botName}` : "Configurado"
                  : "Não configurado"}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.telegram.configured ? (
              <Badge variant="outline" className="border-[hsl(153,60%,26%)]/30 text-[hsl(153,60%,26%)]">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Ativo
              </Badge>
            ) : (
              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                <AlertCircle className="mr-1 h-3 w-3" /> Inativo
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(145,70%,42%)]/10">
              <WhatsAppIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                {loading ? "Verificando..." : status?.whatsapp.configured ? "Configurado" : "Não configurado"}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.whatsapp.configured ? (
              <Badge variant="outline" className="border-[hsl(153,60%,26%)]/30 text-[hsl(153,60%,26%)]">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Ativo
              </Badge>
            ) : (
              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                <AlertCircle className="mr-1 h-3 w-3" /> Inativo
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="telegram">
        <TabsList className="w-full">
          <TabsTrigger value="telegram" className="flex-1 gap-2">
            <TelegramIcon /> Telegram
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1 gap-2">
            <WhatsAppIcon /> WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurar Telegram Bot</CardTitle>
              <CardDescription>Conecte um bot do Telegram para usar o Motor de Governo via chat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  Criar Bot no BotFather
                </h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Abra o Telegram e converse com <strong>@BotFather</strong>:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Envie <code className="rounded bg-muted px-1 font-mono text-xs">/newbot</code></li>
                    <li>Escolha um nome (ex: "LifeOS Governo")</li>
                    <li>Escolha um username (ex: "lifeos_gov_bot")</li>
                    <li>Copie o <strong>token</strong> gerado</li>
                  </ol>
                  <Button variant="outline" size="sm" className="mt-2 gap-1" asChild>
                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                      Abrir BotFather <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  Adicionar Token como Secret
                </h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Adicione o token do bot como secret <code className="rounded bg-muted px-1 font-mono text-xs">TELEGRAM_BOT_TOKEN</code> nas configurações do projeto.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  Registrar Webhook
                </h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                        {webhookUrl}/telegram-webhook
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(`${webhookUrl}/telegram-webhook`, "Webhook URL")}
                      >
                        {copied === "Webhook URL" ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(153,60%,26%)]" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <Button size="sm" onClick={setupTelegramWebhook} className="gap-2">
                    <Send className="h-3.5 w-3.5" /> Configurar Webhook Automaticamente
                  </Button>
                </div>
              </div>

              {/* Status */}
              {status?.telegram.configured && (
                <div className="rounded-lg border border-[hsl(153,60%,26%)]/20 bg-[hsl(153,60%,26%)]/5 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(153,60%,26%)]" />
                    <span className="text-sm font-medium text-foreground">Telegram Conectado</span>
                  </div>
                  {status.telegram.botName && (
                    <p className="mt-1 text-xs text-muted-foreground">Bot: @{status.telegram.botName}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Webhook: {status.telegram.webhookActive ? "✅ Ativo" : "⚠️ Não registrado"}
                  </p>
                </div>
              )}

              {/* Commands */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Comandos Disponíveis</h4>
                <div className="grid gap-2">
                  {[
                    { cmd: "/decidir", desc: "Inicia avaliação completa de decisão (19 etapas)" },
                    { cmd: "/estado", desc: "Check rápido de capacidade (3 valores)" },
                    { cmd: "/cancelar", desc: "Cancela fluxo em andamento" },
                  ].map((c) => (
                    <div key={c.cmd} className="flex items-start gap-3 rounded border border-border p-2">
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-primary">{c.cmd}</code>
                      <span className="text-xs text-muted-foreground">{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurar WhatsApp Business</CardTitle>
              <CardDescription>Conecte via WhatsApp Cloud API (Meta for Developers).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  Criar App no Meta for Developers
                </h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Acesse <strong>developers.facebook.com</strong></li>
                    <li>Crie um app do tipo "Business"</li>
                    <li>Adicione o produto "WhatsApp"</li>
                    <li>Copie o <strong>Access Token</strong> e o <strong>Phone Number ID</strong></li>
                  </ol>
                  <Button variant="outline" size="sm" className="mt-2 gap-1" asChild>
                    <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer">
                      Abrir Meta Developers <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  Adicionar Secrets
                </h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Adicione como secrets:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li><code className="rounded bg-muted px-1 font-mono text-xs">WHATSAPP_TOKEN</code> — Access Token</li>
                    <li><code className="rounded bg-muted px-1 font-mono text-xs">WHATSAPP_PHONE_ID</code> — Phone Number ID</li>
                    <li><code className="rounded bg-muted px-1 font-mono text-xs">WHATSAPP_VERIFY_TOKEN</code> — Token de verificação (opcional, padrão: lifeos-verify-2026)</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  Configurar Webhook no Meta
                </h4>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No painel Meta, vá em WhatsApp → Configuração e registre:
                  </p>
                  <div>
                    <Label className="text-xs text-muted-foreground">Callback URL</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                        {webhookUrl}/whatsapp-webhook
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(`${webhookUrl}/whatsapp-webhook`, "Callback URL")}
                      >
                        {copied === "Callback URL" ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(153,60%,26%)]" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Verify Token</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                        lifeos-verify-2026
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard("lifeos-verify-2026", "Verify Token")}
                      >
                        {copied === "Verify Token" ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(153,60%,26%)]" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inscreva-se no campo <strong>messages</strong> para receber mensagens.
                  </p>
                </div>
              </div>

              {/* Status */}
              {status?.whatsapp.configured && (
                <div className="rounded-lg border border-[hsl(153,60%,26%)]/20 bg-[hsl(153,60%,26%)]/5 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(153,60%,26%)]" />
                    <span className="text-sm font-medium text-foreground">WhatsApp Conectado</span>
                  </div>
                </div>
              )}

              {/* Commands */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Comandos Disponíveis</h4>
                <div className="grid gap-2">
                  {[
                    { cmd: "decidir", desc: "Inicia avaliação completa" },
                    { cmd: "estado", desc: "Check rápido de capacidade" },
                    { cmd: "cancelar", desc: "Cancela fluxo atual" },
                    { cmd: "ajuda", desc: "Menu de opções" },
                  ].map((c) => (
                    <div key={c.cmd} className="flex items-start gap-3 rounded border border-border p-2">
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-primary">{c.cmd}</code>
                      <span className="text-xs text-muted-foreground">{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Channels;
