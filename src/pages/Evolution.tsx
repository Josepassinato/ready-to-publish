import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell
} from "recharts";

const Evolution = () => {
  const { user } = useAuth();
  const [trend, setTrend] = useState<any[]>([]);
  const [verdicts, setVerdicts] = useState({ sim: 0, nao: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [trendRes, decisionsRes] = await Promise.all([
        supabase.rpc("get_capacity_trend", { p_user_id: user.id, p_limit: 20 }),
        supabase.from("decisions").select("verdict").eq("user_id", user.id),
      ]);

      setTrend(
        (trendRes.data || []).reverse().map((t: any, i: number) => ({
          label: new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          score: t.overall_score,
        }))
      );

      const decs = decisionsRes.data || [];
      setVerdicts({
        sim: decs.filter((d: any) => d.verdict === "SIM").length,
        nao: decs.filter((d: any) => d.verdict === "NÃO AGORA").length,
      });

      setLoading(false);
    };
    fetch();
  }, [user]);

  const pieData = [
    { name: "SIM", value: verdicts.sim },
    { name: "NÃO AGORA", value: verdicts.nao },
  ];
  const COLORS = ["hsl(153 60% 26%)", "hsl(0 72% 51%)"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Evolução</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Score ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length < 2 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Dados insuficientes</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(215 16% 52%)", fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(215 16% 52%)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, color: "hsl(210 40% 92%)" }} />
                    <Line type="monotone" dataKey="score" stroke="hsl(213 58% 45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(213 58% 45%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Distribuição de Vereditos</CardTitle>
          </CardHeader>
          <CardContent>
            {verdicts.sim + verdicts.nao === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, color: "hsl(210 40% 92%)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Evolution;
