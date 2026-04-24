import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  KeyRound,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

const MCP_URL = "https://lifeos.12brain.org/mcp/";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rate_limit_per_min: number;
  rate_limit_per_day: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type NewKey = {
  id: string;
  name: string;
  api_key: string;
  prefix: string;
};

const ConnectGPT = () => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("ChatGPT");
  const [justCreated, setJustCreated] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const resp = await fetch("/api/public/keys", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data: ApiKey[] = await resp.json();
      setKeys(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Falha ao carregar chaves", description: message.slice(0, 200), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    const token = getToken();
    if (!token) return;
    const name = newName.trim() || "ChatGPT";
    setCreating(true);
    try {
      const resp = await fetch("/api/public/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ name, scopes: ["evaluate", "read"] }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data: NewKey = await resp.json();
      setJustCreated(data);
      setDialogOpen(false);
      setNewName("ChatGPT");
      await fetchKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Falha ao gerar chave", description: message.slice(0, 200), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Revogar esta chave? Quem estiver usando ela vai parar de funcionar imediatamente.")) return;
    const token = getToken();
    if (!token) return;
    setRevokingId(id);
    try {
      const resp = await fetch(`/api/public/keys/${id}/revoke`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast({ title: "Chave revogada" });
      await fetchKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Falha ao revogar", description: message.slice(0, 200), variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione e copie manualmente.", variant: "destructive" });
    }
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conectar ao ChatGPT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plugue o motor de governo do LifeOS no seu ChatGPT Pro como Custom Connector.
          Chame as decisões pela Constituição Luz & Vaso direto da conversa.
        </p>
      </div>

      {/* Status card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Servidor MCP público</p>
            <p className="text-xs text-muted-foreground">Pronto para conectar no ChatGPT Pro.</p>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : activeKeys.length > 0 ? (
            <Badge variant="outline" className="border-[hsl(153,60%,26%)]/30 text-[hsl(153,60%,26%)]">
              <CheckCircle2 className="mr-1 h-3 w-3" /> {activeKeys.length} chave{activeKeys.length > 1 ? "s" : ""} ativa{activeKeys.length > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
              Sem chaves
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Step 1: MCP URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
            URL do MCP
          </CardTitle>
          <CardDescription>Este é o endereço que o ChatGPT vai chamar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
              {MCP_URL}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(MCP_URL, "mcp-url")}
            >
              {copied === "mcp-url" ? <Check className="h-4 w-4 text-[hsl(153,60%,26%)]" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                Sua chave de API
              </CardTitle>
              <CardDescription>
                Crie uma chave para o ChatGPT autenticar. Você vê a chave só uma vez — copie na hora.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova chave
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando chaves…
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-foreground">Nenhuma chave criada ainda</p>
              <p className="text-xs text-muted-foreground">Clique em "Nova chave" para gerar a primeira.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    k.revoked_at ? "border-border/50 bg-muted/20 opacity-60" : "border-border"
                  }`}
                >
                  <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                      {k.revoked_at && (
                        <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
                          Revogada
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="font-mono">{k.prefix}…</code>
                      <span>·</span>
                      <span>
                        {k.last_used_at
                          ? `último uso: ${new Date(k.last_used_at).toLocaleString()}`
                          : "nunca usada"}
                      </span>
                    </div>
                  </div>
                  {!k.revoked_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeKey(k.id)}
                      disabled={revokingId === k.id}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {revokingId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
            Como plugar no ChatGPT Pro
          </CardTitle>
          <CardDescription>Precisa ser conta ChatGPT Pro (ou Enterprise com Custom Connectors liberado).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Abra <strong>ChatGPT</strong> → <strong>Settings</strong> → <strong>Connectors</strong> → <strong>Build your own</strong>.</li>
            <li>No campo <strong>URL</strong> cole a URL do MCP acima.</li>
            <li>Em <strong>Authentication</strong>, escolha <strong>API Key</strong>.</li>
            <li>No campo <strong>API Key</strong>, cole a chave <code className="rounded bg-muted px-1 font-mono text-xs">lo_sk_…</code> gerada no passo 2.</li>
            <li>Se pedir header, use <code className="rounded bg-muted px-1 font-mono text-xs">Authorization</code> com prefixo <code className="rounded bg-muted px-1 font-mono text-xs">Bearer </code>.</li>
            <li>Salve e teste: peça no chat <em>"use o LifeOS, me dá meu contexto atual"</em>.</li>
          </ol>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">Tools disponíveis</p>
            <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
              <li>• <code className="font-mono">evaluate_decision</code> — motor Luz & Vaso completo</li>
              <li>• <code className="font-mono">list_decisions</code> — histórico recente</li>
              <li>• <code className="font-mono">get_memory</code> — fatos da sua memória</li>
              <li>• <code className="font-mono">get_user_context</code> — overview de perfil + estado</li>
            </ul>
          </div>
          <Button variant="outline" size="sm" className="gap-1" asChild>
            <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">
              Abrir ChatGPT <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Create key dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar nova chave</DialogTitle>
            <DialogDescription>
              Dê um nome pra reconhecer onde está usando. Você só verá a chave uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: ChatGPT pessoal, ChatGPT trabalho…"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={createKey} disabled={creating}>
              {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</> : "Gerar chave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Just-created key dialog */}
      <Dialog open={!!justCreated} onOpenChange={(open) => { if (!open) setJustCreated(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[hsl(153,60%,26%)]" />
              Chave criada — copie agora
            </DialogTitle>
            <DialogDescription>
              Esta é a única vez que você vê a chave completa. Depois, só o prefixo fica visível.
            </DialogDescription>
          </DialogHeader>
          {justCreated && (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">
                  Guarde em local seguro. Se perder, gere outra chave e revogue esta.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <p className="text-sm font-medium text-foreground">{justCreated.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Chave</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
                    {justCreated.api_key}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(justCreated.api_key, "new-key")}
                  >
                    {copied === "new-key" ? <Check className="h-4 w-4 text-[hsl(153,60%,26%)]" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setJustCreated(null)}>Já copiei, fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectGPT;
