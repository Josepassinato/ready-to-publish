import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Shield, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/chat" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        const { error } = await signUp(email, password, name);
        if (error) {
          toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Conta criada", description: "Verifique seu email para confirmar o cadastro." });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      console.log('Sending recovery email for:', recoveryEmail); // Debugging line
      const { error } = await resetPasswordForEmail(recoveryEmail);
      if (error) {
        toast({ title: "Erro na recuperação", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Email enviado", description: "Verifique seu email para redefinir sua senha." });
        setIsRecoveryModalOpen(false);
        setRecoveryEmail("");
      }
    } finally {
      setSubmitting(false);
    }
  };

// Duplicated handlePasswordRecovery function removed
  const isTestMode = import.meta.env.VITE_TEST_MODE === "true";

  const handleTestBypass = async () => {
    setSubmitting(true);
    try {
      const { error } = await signIn("test@lifeos.dev", "test1234");
      if (error) {
        // If test account doesn't exist, create it
        const { error: signUpError } = await signUp("test@lifeos.dev", "test1234", "Test User");
        if (signUpError) {
          toast({ title: "Erro no modo teste", description: signUpError.message, variant: "destructive" });
        } else {
          await signIn("test@lifeos.dev", "test1234");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">LifeOS</h1>
          <p className="text-sm text-muted-foreground">
            Sistema de Governo de Decisão
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  !isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Criar Conta
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required={!isLogin}
                    className="bg-muted border-border"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-muted border-border"
                />
                <Dialog open={isRecoveryModalOpen} onOpenChange={setIsRecoveryModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" className="h-auto px-0 py-0 text-xs self-end text-muted-foreground hover:text-foreground">
                      Esqueceu a senha?
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Recuperar Senha</DialogTitle>
                      <DialogDescription>
                        Digite seu email para receber um link de recuperação de senha.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordRecovery} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="recovery-email" className="text-foreground">Email</Label>
                        <Input
                          id="recovery-email"
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                          className="bg-muted border-border"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                          ) : (
                            "Enviar Link"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    {isLogin ? "Entrar" : "Criar Conta"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isTestMode && (
          <Button
            variant="outline"
            className="w-full border-dashed border-warning text-warning hover:bg-warning/10"
            onClick={handleTestBypass}
            disabled={submitting}
          >
            ⚡ Entrar em Modo Teste
          </Button>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Protocolo Luz & Vaso · Constituição Artigos I–VII
        </p>
      </div>
    </div>
  );
};

export default Auth;
