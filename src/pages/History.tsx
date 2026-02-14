import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const History = () => {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      let query = supabase
        .from("decisions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filter === "SIM" || filter === "NÃO AGORA") {
        query = query.eq("verdict", filter);
      }

      const { data } = await query;
      setDecisions(data || []);
      setLoading(false);
    };
    fetch();
  }, [user, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 bg-muted border-border">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="SIM">SIM</SelectItem>
            <SelectItem value="NÃO AGORA">NÃO AGORA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : decisions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma decisão encontrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {decisions.map((d) => (
                <Link
                  key={d.id}
                  to={`/decision/${d.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{d.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                      <span>·</span>
                      <span className="capitalize">{d.decision_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="font-mono text-sm text-muted-foreground">{d.overall_score}%</span>
                    <Badge variant={d.verdict === "SIM" ? "default" : "destructive"} className={d.verdict === "SIM" ? "bg-success text-success-foreground" : ""}>
                      {d.verdict}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
