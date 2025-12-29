import type { Decision, Offer } from "./types";

// Reuse your existing validate + fallback if you want.
// For Conversation Mode we keep it simpler:
// - If intent is COUNTER_DIRECT, we must include counter values.
// - If intent is ASK_PREFERENCE, we must not include numbers.

export async function writeConvoReplyWithOllama(args: {
  vendorText: string;
  intent:
    | "GREET"
    | "ASK_FOR_OFFER"
    | "ASK_CLARIFY"
    | "ASK_PREFERENCE"
    | "COUNTER_DIRECT"
    | "ACCEPT"
    | "ESCALATE"
    | "WALK_AWAY"
    | "SMALL_TALK"
    | "ACKNOWLEDGE_LATER"
    | "NEGOTIATION_RESPONSE"
    | "ACKNOWLEDGE";
  vendorOffer: Offer | null;
  decision: Decision | null;
  counterOffer: Offer | null;
}): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL!;

  const system = `
You are a senior procurement manager negotiating professionally and politely.

Style:
- 2–4 short lines max.
- Warm opener if appropriate.
- Natural, human tone. No robotic phrases.
- Sound like a real person having a business conversation.

Hard rules:
- Never mention: utility, score, engine, algorithm, AI, JSON, thresholds, Accordo.
- If we already received a complete offer earlier in the thread, do NOT ask "share your best price and terms" again.
- If the vendor says "No" / "Can't" / "Already shared", acknowledge and propose ONE next step (a trade-off or a question).
- Avoid repeating the exact same sentence used in the last 2 messages.
- If intent=SMALL_TALK: respond naturally to greetings/small talk, then gently ask for offer when ready.
- If intent=COUNTER_DIRECT: include ONLY counterOffer unit price and payment terms (Net 30/60/90).
- If intent=ACCEPT: confirm vendorOffer exactly (price + terms).
- If intent=ASK_PREFERENCE: ask ONE question offering a choice (price vs payment terms). Do NOT include any numbers.
- If intent=ACKNOWLEDGE_LATER: acknowledge their timing request, then ask to confirm details before pausing.
- If intent=NEGOTIATION_RESPONSE: acknowledge their response and propose ONE next step based on last known offer.
- If intent=ACKNOWLEDGE: acknowledge their message and move forward with negotiation.
- If vendor used non-standard terms, ask to confirm Net 30/60/90.
Return ONLY the message text.
`;

  const user = JSON.stringify(
    {
      vendorText: args.vendorText,
      intent: args.intent,
      vendorOffer: args.vendorOffer,
      decision: args.decision,
      counterOffer: args.counterOffer,
    },
    null,
    2
  );

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `
Write the next message.

Context JSON:
${user}
`,
        },
      ],
    }),
  });

  const data = (await res.json()) as { message?: { content?: string } };
  const content = (data.message?.content ?? "").trim();

  // Minimal safety fallback
  if (!content) return fallback(args);

  // If ASK_PREFERENCE accidentally includes numbers, fallback
  if (args.intent === "ASK_PREFERENCE" && /\b\d+(\.\d+)?\b/.test(content)) return fallback(args);

  // If COUNTER_DIRECT/ACCEPT must contain the required values
  if (args.intent === "COUNTER_DIRECT" && args.counterOffer) {
    const ok =
      content.toLowerCase().includes(String(args.counterOffer.unit_price)) &&
      content.toLowerCase().includes(args.counterOffer.payment_terms.toLowerCase());
    if (!ok) return fallback(args);
  }

  if (args.intent === "ACCEPT" && args.vendorOffer?.unit_price != null && args.vendorOffer.payment_terms) {
    const ok =
      content.toLowerCase().includes(String(args.vendorOffer.unit_price)) &&
      content.toLowerCase().includes(args.vendorOffer.payment_terms.toLowerCase());
    if (!ok) return fallback(args);
  }

  return content;
}

function fallback(args: any) {
  switch (args.intent) {
    case "GREET":
      return `Hi — hope you're doing well. How are things on your end?`;
    case "SMALL_TALK":
      return `Hi — doing well, thanks. Hope you are too. Whenever you're ready, please share your best price and terms (Net 30/60/90).`;
    case "ASK_FOR_OFFER":
      return `Thanks. Could you share your best unit price and payment terms (Net 30/60/90)?`;
    case "ASK_CLARIFY":
      return `Just to align — what unit price can you do, and what payment terms would you prefer (Net 30/60/90)?`;
    case "ASK_PREFERENCE":
      return `Thanks — helpful. To make this work, is it easier for you to move a bit on price, or extend payment terms?`;
    case "COUNTER_DIRECT":
      return args.counterOffer
        ? `Thanks — understood.\nIf we can proceed at ${args.counterOffer.unit_price} per unit, could you do ${args.counterOffer.payment_terms}?`
        : `Thanks — could you share your best unit price and payment terms (Net 30/60/90)?`;
    case "ACCEPT":
      return args.vendorOffer
        ? `Confirmed — we can proceed at $${args.vendorOffer.unit_price} on ${args.vendorOffer.payment_terms}. Please share next steps.`
        : `Confirmed — please share next steps.`;
    case "ESCALATE":
      return `Thanks — I need a quick internal review before confirming. I'll come back shortly with an update.`;
    case "WALK_AWAY":
      return `Thanks for sharing this. We won't be able to proceed on these terms. If you can adjust pricing or payment terms, I'm happy to revisit.`;
    case "ACKNOWLEDGE_LATER":
      return `No problem — when would be a good time? Before we pause, can you confirm the price and Net terms we discussed?`;
    case "NEGOTIATION_RESPONSE":
      if (args.vendorOffer && args.counterOffer) {
        return `Got it — thanks for confirming. Based on ${args.vendorOffer.unit_price != null ? `${args.vendorOffer.unit_price} per unit` : "that price"} on ${args.vendorOffer.payment_terms ?? "those terms"}, could we do ${args.counterOffer.payment_terms} instead?`;
      } else if (args.vendorOffer) {
        return `Understood — thanks for confirming ${args.vendorOffer.unit_price != null ? `${args.vendorOffer.unit_price} per unit` : "the price"} on ${args.vendorOffer.payment_terms ?? "those terms"}. Let's see if we can find a path forward.`;
      } else {
        return `Understood. Let's see if we can find a path forward. What would work best for you?`;
      }
    case "ACKNOWLEDGE":
      return `Thanks — let's continue.`;
    default:
      return `Thanks — let's continue.`;
  }
}

