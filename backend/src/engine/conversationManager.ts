import { Decision, Offer } from "./types";
import type { NegotiationConfig } from "../repo/templatesRepo";

export type ConversationState = {
  phase: "GREET" | "ASK_OFFER" | "NEGOTIATING" | "CLOSED";
  asked_preference: boolean;
  last_prompt_style?: string;
  last_vendor_offer?: Offer | null;
  round?: number;
};

export type ConversationIntent = 
  | "greet"
  | "ask_offer"
  | "ask_clarify"
  | "ask_preference"
  | "counter"
  | "accept"
  | "escalate"
  | "walk_away";

/**
 * Simple seeded hash for deterministic template selection
 */
function seededHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Select a template variation deterministically based on dealId + round + intent
 */
export function selectTemplate(
  dealId: string,
  round: number,
  intent: ConversationIntent,
  templates: string[]
): string {
  const seed = `${dealId}-${round}-${intent}`;
  const index = seededHash(seed) % templates.length;
  return templates[index];
}

/**
 * Template variations for each intent
 */
const TEMPLATES: Record<ConversationIntent, string[]> = {
  greet: [
    "Hi there! Thanks for reaching out. How are you doing today?",
    "Hello! Good to connect. How's everything on your end?",
    "Hi! Thanks for getting in touch. How are things?",
    "Hello there! Appreciate you reaching out. How's your day going?",
    "Hi! Good to hear from you. How are you?",
  ],
  ask_offer: [
    "Great! Could you share your pricing and payment terms for this deal?",
    "Thanks! What pricing and terms are you thinking for this?",
    "Perfect. What's your proposed price and payment terms?",
    "Sounds good. Can you share the unit price and payment terms?",
    "Thanks! What price and terms are you offering?",
  ],
  ask_clarify: [
    "Thanks — quick check: can you confirm the {missing}?",
    "Just to make sure I have everything: could you clarify the {missing}?",
    "Thanks! Can you confirm the {missing} for me?",
    "Quick question: what's the {missing}?",
    "Just need to confirm the {missing} — can you share that?",
  ],
  ask_preference: [
    "Thanks — that's helpful. To make this work, do you have flexibility on price, or would extending payment terms be easier?",
    "If we keep {price}, could you do {better_terms}? If not, can we tighten price closer to our target on {current_terms}?",
    "Thanks for that. To move forward, would you prefer to adjust the price or extend the payment terms?",
    "That works as a starting point. Do you have more room on pricing, or would longer payment terms be more feasible?",
    "Thanks! To make this work, are you able to improve the price, or would better payment terms be easier?",
  ],
  counter: [
    "Thanks for the update. If we proceed at ${price}, we'll need {terms} to make this work on our side. Does that work for you?",
    "Thanks! We'd need {terms} at ${price} to move forward. Can you confirm?",
    "Thanks for sharing. To proceed, we'd need {terms} at ${price}. Does that work?",
    "Thanks! We can move forward at ${price} if we can get {terms}. Can you confirm?",
    "Thanks for that. We'd need {terms} at ${price} to make this work. Does that work for you?",
  ],
  accept: [
    "Confirmed — we can move forward at ${price} on {terms}. Please share next steps and we'll proceed.",
    "Perfect! We're good with ${price} on {terms}. What are the next steps?",
    "Great! We can proceed at ${price} on {terms}. Please let me know how you'd like to move forward.",
    "Confirmed — ${price} on {terms} works for us. What's the next step?",
    "Perfect! We're on board with ${price} on {terms}. How would you like to proceed?",
  ],
  escalate: [
    "Thanks — I need a quick internal review before I can confirm. I'll come back to you shortly with an update.",
    "Thanks for sharing this. Let me review internally and get back to you soon.",
    "Thanks! I need to check with my team on this. I'll follow up shortly.",
    "Thanks for the update. Let me review this internally and I'll get back to you.",
    "Thanks! I need to run this by my team. I'll come back to you with an update soon.",
  ],
  walk_away: [
    "Thanks for sharing this. We won't be able to proceed on these terms. If you can adjust pricing or payment terms, I'm happy to re-open the discussion.",
    "Thanks, but we won't be able to move forward on these terms. If you can revise the pricing or terms, let's reconnect.",
    "Thanks for the offer. Unfortunately, we can't proceed on these terms. If you can adjust, I'm open to continuing the conversation.",
    "Thanks, but we're not able to proceed on these terms. If you can adjust pricing or payment terms, I'm happy to discuss further.",
    "Thanks for sharing. We won't be able to proceed on these terms. If you can adjust, let's reconnect.",
  ],
};

/**
 * Get template for an intent with variable substitution
 */
export function getTemplate(
  dealId: string,
  round: number,
  intent: ConversationIntent,
  vars?: Record<string, string | number>
): string {
  const templates = TEMPLATES[intent];
  let template = selectTemplate(dealId, round, intent, templates);
  
  // Substitute variables
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      template = template.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }
  
  return template;
}

/**
 * Determine conversation intent based on decision and state
 */
export function determineIntent(
  decision: Decision,
  state: ConversationState,
  round: number,
  config: NegotiationConfig
): ConversationIntent {
  if (decision.action === "ACCEPT") return "accept";
  if (decision.action === "WALK_AWAY") return "walk_away";
  if (decision.action === "ESCALATE") return "escalate";
  if (decision.action === "ASK_CLARIFY") return "ask_clarify";
  
  if (decision.action === "COUNTER") {
    // Ask preference once early (round 1-2) if not already asked
    if (!state.asked_preference && round <= 2 && decision.utilityScore < config.accept_threshold) {
      return "ask_preference";
    }
    return "counter";
  }
  
  return "counter"; // fallback
}

/**
 * Generate conversation reply based on intent and decision
 */
export function generateConversationReply(
  dealId: string,
  round: number,
  intent: ConversationIntent,
  decision: Decision,
  vendorOffer: Offer,
  config: NegotiationConfig
): string {
  switch (intent) {
    case "greet":
      return getTemplate(dealId, round, "greet");
    
    case "ask_offer":
      return getTemplate(dealId, round, "ask_offer");
    
    case "ask_clarify": {
      const missing: string[] = [];
      if (vendorOffer.unit_price == null) missing.push("unit price");
      if (!vendorOffer.payment_terms) missing.push("payment terms (Net 30/Net 60/Net 90)");
      return getTemplate(dealId, round, "ask_clarify", { missing: missing.join(" and ") });
    }
    
    case "ask_preference": {
      const price = vendorOffer.unit_price ?? 0;
      const currentTerms = vendorOffer.payment_terms ?? "Net 60";
      const betterTerms = config.parameters.payment_terms.options[config.parameters.payment_terms.options.length - 1]; // Net 90
      return getTemplate(dealId, round, "ask_preference", {
        price: `$${price}`,
        current_terms: currentTerms,
        better_terms: betterTerms,
      });
    }
    
    case "counter": {
      if (!decision.counterOffer) {
        return getTemplate(dealId, round, "counter", { price: "TBD", terms: "TBD" });
      }
      const price = decision.counterOffer.unit_price ?? 0;
      const terms = decision.counterOffer.payment_terms ?? "Net 60";
      return getTemplate(dealId, round, "counter", {
        price: `$${price}`,
        terms: terms,
      });
    }
    
    case "accept": {
      const price = vendorOffer.unit_price ?? 0;
      const terms = vendorOffer.payment_terms ?? "Net 60";
      return getTemplate(dealId, round, "accept", {
        price: `$${price}`,
        terms: terms,
      });
    }
    
    case "escalate":
      return getTemplate(dealId, round, "escalate");
    
    case "walk_away":
      return getTemplate(dealId, round, "walk_away");
    
    default:
      return "Thanks — let's continue.";
  }
}

/**
 * Update conversation state based on new turn
 */
export function updateConversationState(
  currentState: ConversationState,
  intent: ConversationIntent,
  round: number,
  vendorOffer: Offer | null
): ConversationState {
  const newState: ConversationState = {
    ...currentState,
    round,
    last_vendor_offer: vendorOffer ?? null,
  };
  
  if (intent === "ask_preference") {
    newState.asked_preference = true;
  }
  
  // Update phase
  if (currentState.phase === "GREET") {
    newState.phase = "ASK_OFFER";
  } else if (currentState.phase === "ASK_OFFER" && vendorOffer) {
    newState.phase = "NEGOTIATING";
  }
  
  return newState;
}

