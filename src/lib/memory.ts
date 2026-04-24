import { apiGet, apiPost } from "@/lib/api";

export async function getUserMemoryContext(_userId: string): Promise<string> {
  const [memories, recentMessages] = await Promise.all([
    apiGet<any[]>("/api/db/user_memory?order=category").catch(() => []),
    apiGet<any[]>("/api/db/chat_messages?limit=50").catch(() => []),
  ]);

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
    const recent = recentMessages.slice(0, 10).reverse();
    for (const m of recent) {
      context += `[${m.role}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? "..." : ""}\n`;
    }
  }

  return context;
}

export async function saveChatMessages(
  _userId: string,
  sessionId: string,
  messages: Array<{ role: string; content: string }>
) {
  const rows = messages.map((m) => ({
    session_id: sessionId,
    role: m.role,
    content: m.content,
  }));

  await apiPost("/api/db/chat_messages", rows).catch((err) =>
    console.warn("[memory] saveChatMessages failed:", String(err))
  );
}

export async function upsertMemory(
  _userId: string,
  entries: Array<{ category: string; key: string; value: string; source?: string }>
) {
  const payload = entries.map((e) => ({
    category: e.category,
    key: e.key,
    value: e.value,
    source: e.source || "conversation",
  }));
  await apiPost("/api/db/user_memory", payload).catch((err) =>
    console.warn("[memory] upsertMemory failed:", String(err))
  );
}
