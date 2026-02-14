import { useAuth } from "@/hooks/useAuth";
import { useOnboardingCheck } from "@/hooks/useOnboardingCheck";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { Shield, MessageSquare, LayoutDashboard, PlusCircle, Clock, ListChecks, TrendingUp, LogOut, Radio } from "lucide-react";
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

const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const { needsOnboarding, loading: onboardingLoading } = useOnboardingCheck();
  const location = useLocation();

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/chat" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">LifeOS</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className={isChatRoute ? "" : "container py-6"}>
        <Outlet />
      </main>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-around py-2">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label.split(" ").pop()}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
