import { Decision, Offer } from "../engine/types";
import type { NegotiationConfig } from "../repo/templatesRepo";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(t: string, words: string[]): boolean {
  return words.some(w => t.includes(w));
}

// Tolerant number check: $93, 93, 93.0, 93.00 all pass
function includesMoney(reply: string, value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const t = normalize(reply);
  const v = Number(value);
  if (!Number.isFinite(v)) return false;

  // Match 93, 93.0, 93.00, $93, $93.00
  const re = new RegExp(`\\$?\\b${v}(?:\\.0+)?\\b`);
  return re.test(t);
}

function includesTerms(reply: string, terms: string | null | undefined): boolean {
  if (!terms) return false;
  const t = normalize(reply);
  return t.includes(normalize(terms));
}

export function validateReply(reply: string, decision: Decision, vendorOffer: Offer): boolean {
  const t = normalize(reply);

  // Ban system-ish language
  const banned = ["utility", "algorithm", "engine", "accordo", "ai", "json", "threshold", "score"];
  if (banned.some(b => t.includes(b))) return false;

  // Keep it short-ish (prevents "system paragraphs")
  if (reply.length > 550) return false;

  if (decision.action === "COUNTER") {
    if (!decision.counterOffer) return false;
    return (
      includesMoney(reply, decision.counterOffer.unit_price) &&
      includesTerms(reply, decision.counterOffer.payment_terms)
    );
  }

  if (decision.action === "ACCEPT") {
    if (vendorOffer.unit_price == null || !vendorOffer.payment_terms) return false;
    return (
      includesMoney(reply, vendorOffer.unit_price) &&
      includesTerms(reply, vendorOffer.payment_terms)
    );
  }

  if (decision.action === "ASK_CLARIFY") {
    const missingPrice = vendorOffer.unit_price == null;
    const missingTerms = !vendorOffer.payment_terms;

    if (!missingPrice && !missingTerms) return false;

    const asksPrice = containsAny(t, ["unit price", "price", "per unit", "unit"]);
    const asksTerms = containsAny(t, ["payment terms", "terms", "net 30", "net 60", "net 90", "net"]);

    if (missingPrice && !asksPrice) return false;
    if (missingTerms && !asksTerms) return false;

    // Shouldn't ask for non-missing items
    if (!missingPrice && asksPrice) return false;
    if (!missingTerms && asksTerms) return false;

    return true;
  }

  if (decision.action === "ESCALATE" || decision.action === "WALK_AWAY") {
    // Avoid quoting numbers/offers in these actions (keeps tone clean)
    const hasNumbers = /\b\d+(\.\d+)?\b/.test(t);
    if (hasNumbers) return false;

    // Also ensure it contains a human-like next step cue
    const hasNextStep = containsAny(t, ["review", "internally", "get back", "come back", "unable to proceed", "can't proceed", "cannot proceed"]);
    return hasNextStep;
  }

  return true;
}

export function getFallbackReply(decision: Decision, vendorOffer: Offer): string {
  switch (decision.action) {
    case "COUNTER":
      if (decision.counterOffer?.unit_price != null && decision.counterOffer?.payment_terms) {
        return `Thanks for the update. If we proceed at $${decision.counterOffer.unit_price}, we'll need ${decision.counterOffer.payment_terms} to make this work on our side. Does that work for you?`;
      }
      break;

    case "ACCEPT":
      if (vendorOffer.unit_price != null && vendorOffer.payment_terms) {
        return `Confirmed — we can move forward at $${vendorOffer.unit_price} on ${vendorOffer.payment_terms}. Please share next steps and we'll proceed.`;
      }
      break;

    case "ASK_CLARIFY": {
      const parts: string[] = [];
      if (vendorOffer.unit_price == null) parts.push("unit price");
      if (!vendorOffer.payment_terms) parts.push("payment terms (Net 30/Net 60/Net 90)");
      if (parts.length > 0) {
        return `Thanks — quick check: can you confirm the ${parts.join(" and ")}?`;
      }
      break;
    }

    case "ESCALATE":
      return `Thanks — I need a quick internal review before I can confirm. I'll come back to you shortly with an update.`;

    case "WALK_AWAY":
      return `Thanks for sharing this. We won't be able to proceed on these terms. If you can adjust pricing or payment terms, I'm happy to re-open the discussion.`;
  }

  return `Thanks — let's continue.`;
}

/**
 * Write reply with LLM for conversation mode
 * Uses more natural, conversational prompts that allow greetings and preference questions
 */
export async function writeConversationReplyWithOllama(args: {
  vendorText: string;
  vendorOffer: Offer;
  decision: Decision;
  intent?: "greet" | "ask_offer" | "ask_clarify" | "ask_preference" | "counter" | "accept" | "escalate" | "walk_away";
  config?: NegotiationConfig;
}): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL!;

  const { vendorText, vendorOffer, decision, intent } = args;

  const system = `
You are a senior procurement manager having a natural business conversation with a vendor.

Write a short, conversational message (1–3 lines). Sound human, friendly but professional.
You can include brief greetings or small talk (1 line max) if appropriate.
Do NOT use labels, headings, bullet points, or any system-style text.

Hard rules (must follow):
- Never mention: utility, algorithm, engine, Accordo, AI, model, policy, scoring, thresholds, JSON, deal score.
- Never invent numbers. Use only the numbers explicitly provided.
- Never propose Net terms other than: Net 30, Net 60, Net 90.
- If asking a preference question, ask exactly ONE question (not multiple).

Conversation tone:
- Be natural and conversational, like you're talking to a colleague
- You can start with a brief greeting if it's early in the conversation
- When asking for preferences, ask one clear question
- Keep responses concise and human-like
`;

  let userPrompt = `
Context:
Vendor message: ${vendorText}

Extracted offer:
unit_price=${vendorOffer.unit_price ?? "null"}
payment_terms=${vendorOffer.payment_terms ?? "null"}

Decision:
action=${decision.action}
`;

  // Add intent-specific guidance
  if (intent === "ask_preference") {
    userPrompt += `
Intent: Ask the vendor about their flexibility - do they prefer adjusting price or extending payment terms?
Write a natural question that asks about their preference (one question only).
`;
  } else if (intent === "greet") {
    userPrompt += `
Intent: Greet the vendor naturally and ask how they're doing (1 line max).
`;
  } else if (intent === "ask_offer") {
    userPrompt += `
Intent: Ask the vendor to share their pricing and payment terms.
`;
  } else {
    userPrompt += `
Decision details:
counter_unit_price=${decision.counterOffer?.unit_price ?? "null"}
counter_payment_terms=${decision.counterOffer?.payment_terms ?? "null"}

Write ONLY the message text.
`;
  }

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    const data = await res.json() as { message?: { content?: string } };
    const content = (data.message?.content ?? "").trim();
    
    // Validate reply (same validation as regular mode)
    if (validateReply(content, decision, vendorOffer)) {
      return content;
    }
    
    // Fallback to template if validation fails
    console.warn("LLM conversation reply failed validation, using fallback");
    return getFallbackReply(decision, vendorOffer);
  } catch (error) {
    console.error("Ollama error in conversation mode, using fallback:", error);
    return getFallbackReply(decision, vendorOffer);
  }
}

export async function writeReplyWithOllama(args: {
  vendorText: string;
  vendorOffer: Offer;
  decision: Decision;
  config?: NegotiationConfig; // Optional for backward compatibility
  history?: Array<{ role: string; content: string }>; // Conversation history
}): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL!;

  const { vendorText, vendorOffer, decision, history } = args;

  // Build conversation transcript
  const transcript = (history ?? [])
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

  const system = `
You are a senior procurement manager negotiating with a vendor.

Write a short, natural message (2–4 lines). Sound human, calm, and businesslike.
Do NOT use labels, headings, bullet points, or any system-style text.

Hard rules (must follow):
- Never mention: utility, algorithm, engine, Accordo, AI, model, policy, scoring, thresholds, JSON.
- Never invent numbers. Use only the numbers explicitly provided in the decision or extracted offer.
- Never propose Net terms other than: Net 30, Net 60, Net 90.
- If the vendor uses non-standard terms (e.g. "50 days"), ask them to confirm Net 30/60/90.
- Do NOT repeat the same sentence across turns.
- If vendor message does NOT include an offer change, continue based on the last known offer.

Action rules:
- If action = COUNTER:
  - Include the exact counter unit price and exact counter payment terms.
  - Ask a single closing question like "Can you confirm?"
- If action = ACCEPT:
  - Restate the exact vendor unit price and vendor payment terms.
  - Confirm next step in one sentence.
- If action = ASK_CLARIFY:
  - Ask only for the missing field(s) (unit price or terms).
- If action = ESCALATE:
  - Say you need internal review and give a short next-step expectation.
- If action = WALK_AWAY:
  - Politely decline and suggest escalation to a human point of contact.
`;

  const user = `
Conversation so far:
${transcript ? transcript + "\n" : ""}

Vendor said: "${vendorText}"
Effective offer we are evaluating: ${JSON.stringify(vendorOffer)}
Decision: ${JSON.stringify(decision)}

Write the next reply as a human procurement manager.
`;

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
      }),
    });

    const data = await res.json() as { message?: { content?: string } };
    const content = (data.message?.content ?? "").trim();
    
    // Validate reply contains correct values and no banned words
    if (validateReply(content, decision, vendorOffer)) {
      return content;
    }
    
    // Fallback to template if validation fails
    console.warn("LLM reply failed validation, using fallback");
    return getFallbackReply(decision, vendorOffer);
  } catch (error) {
    console.error("Ollama error, using fallback:", error);
    return getFallbackReply(decision, vendorOffer);
  }
}
