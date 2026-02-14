import { supabase } from "@/integrations/supabase/client";

export async function getUserMemoryContext(userId: string): Promise<string> {
  // Fetch user memory (evolving profile)
  const { data: memories } = await supabase
    .from("user_memory")
    .select("category, key, value")
    .eq("user_id", userId)
    .order("category");

  // Fetch recent chat history (last 50 messages)
  const { data: recentMessages } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  let context = "";

  if (memories && memories.length > 0) {
    const grouped: Record<string, Record<string, string>> = {};
    for (const m of memories) {
      if (!grouped[m.category]) grouped[m.category] = {};
      grouped[m.category][m.key] = m.value;
    }

    context += "## Memória do Usuário (Perfil Evolutivo)\n";
    for (const [cat, entries] of Object.entries(grouped)) {
      context += `\n### ${cat}\n`;
      for (const [k, v] of Object.entries(entries)) {
        context += `- ${k}: ${v}\n`;
      }
    }
  }

  if (recentMessages && recentMessages.length > 0) {
    context += "\n## Resumo de Conversas Recentes\n";
    // Send last 10 as actual context (reversed to chronological)
    const recent = recentMessages.slice(0, 10).reverse();
    for (const m of recent) {
      context += `[${m.role}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? "..." : ""}\n`;
    }
  }

  return context;
}

export async function saveChatMessages(
  userId: string,
  sessionId: string,
  messages: Array<{ role: string; content: string }>
) {
  const rows = messages.map((m) => ({
    user_id: userId,
    session_id: sessionId,
    role: m.role,
    content: m.content,
  }));

  await supabase.from("chat_messages").insert(rows);
}

export async function upsertMemory(
  userId: string,
  entries: Array<{ category: string; key: string; value: string; source?: string }>
) {
  for (const entry of entries) {
    await supabase
      .from("user_memory")
      .upsert(
        {
          user_id: userId,
          category: entry.category,
          key: entry.key,
          value: entry.value,
          source: entry.source || "conversation",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category,key" }
      );
  }
}
