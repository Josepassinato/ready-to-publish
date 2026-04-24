import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "./components/AppLayout";

const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Chat = lazy(() => import("./pages/Chat"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DecisionNew = lazy(() => import("./pages/DecisionNew"));
const DecisionVerdict = lazy(() => import("./pages/DecisionVerdict"));
const History = lazy(() => import("./pages/History"));
const Plans = lazy(() => import("./pages/Plans"));
const Evolution = lazy(() => import("./pages/Evolution"));
const Channels = lazy(() => import("./pages/Channels"));
const ConnectGPT = lazy(() => import("./pages/ConnectGPT"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<AppLayout />}>
                <Route path="/chat" element={<Chat />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/decision/new" element={<DecisionNew />} />
                <Route path="/decision/:id" element={<DecisionVerdict />} />
                <Route path="/history" element={<History />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/evolution" element={<Evolution />} />
                <Route path="/channels" element={<Channels />} />
                <Route path="/connect-gpt" element={<ConnectGPT />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
