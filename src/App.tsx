import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/AppLayout";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import DecisionNew from "./pages/DecisionNew";
import DecisionVerdict from "./pages/DecisionVerdict";
import History from "./pages/History";
import Plans from "./pages/Plans";
import Evolution from "./pages/Evolution";
import Channels from "./pages/Channels";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
