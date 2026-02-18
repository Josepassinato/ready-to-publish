import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingCheck } from "@/hooks/useOnboardingCheck";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { Shield, MessageSquare, LayoutDashboard, PlusCircle, Clock, ListChecks, TrendingUp, LogOut, Radio, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/decision/new", label: "Nova Decisão", icon: PlusCircle },
  { to: "/history", label: "Histórico", icon: Clock },
  { to: "/plans", label: "Planos", icon: ListChecks },
  { to: "/evolution", label: "Evolução", icon: TrendingUp },
  { to: "/channels", label: "Canais", icon: Radio },
];

const MOBILE_MAIN = NAV_ITEMS.slice(0, 4);
const MOBILE_MORE = NAV_ITEMS.slice(4);

const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const { needsOnboarding, loading: onboardingLoading } = useOnboardingCheck();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (loading || onboardingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  const isChatRoute = location.pathname === "/chat";
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="app-header sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4 md:container">
          <Link to="/chat" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">LifeOS</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className={`${isChatRoute ? "chat-main" : "app-main container py-4 md:py-6"} pb-20 md:pb-0`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-1 py-1.5">
          {MOBILE_MAIN.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                isActive(item.to)
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.to) ? "text-primary" : ""}`} />
              <span className="truncate max-w-[56px]">{item.label.split(" ").pop()}</span>
            </Link>
          ))}

          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
              moreOpen || MOBILE_MORE.some(i => isActive(i.to))
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            <span>Mais</span>
          </button>
        </div>

        {/* More sheet */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 z-50 border-t border-border bg-background rounded-t-2xl p-4 shadow-lg">
              <div className="flex flex-col gap-1">
                {MOBILE_MORE.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive(item.to)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
                <button
                  onClick={() => { signOut(); setMoreOpen(false); }}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Sair
                </button>
              </div>
            </div>
          </>
        )}
      </nav>
    </div>
  );
};

export default AppLayout;
