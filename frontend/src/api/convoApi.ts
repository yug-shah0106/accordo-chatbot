const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export async function convoStart(dealId: string) {
  const r = await fetch(`${API}/convo/deals/${dealId}/start`, { method: "POST" });
  return r.json();
}

export async function convoSendMessage(dealId: string, text: string) {
  const r = await fetch(`${API}/convo/deals/${dealId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return r.json();
}

export async function convoExplainLast(dealId: string) {
  const r = await fetch(`${API}/convo/deals/${dealId}/last-explain`);
  return r.json();
}

