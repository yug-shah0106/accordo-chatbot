import { OfferSchema } from "../engine/types";

export async function extractOfferWithOllama(text: string) {
  const base = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL!;

  const prompt = `
Extract negotiation offer from this message.
Return ONLY JSON in this schema:
{"unit_price": number|null, "payment_terms": "Net 30"|"Net 60"|"Net 90"|null}

Message:
"""${text}"""
`;

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  const data = (await res.json()) as { response?: string };
  const raw = data.response?.trim() ?? "{}";

  const parsed = JSON.parse(raw);
  return OfferSchema.parse(parsed);
}

