import type { ConvoState, Decision, NegotiationConfig, Offer } from "./types";

function detectPreference(text: string): "PRICE" | "TERMS" | "NEITHER" | null {
  const t = text.toLowerCase().trim();

  // If vendor refuses both / says no
  if (
    t === "no" ||
    t.includes("nope") ||
    t.includes("not possible") ||
    t.includes("can't") ||
    t.includes("cannot") ||
    t.includes("no sorry") ||
    t.includes("final") ||
    t.includes("fixed") ||
    t.includes("not flexible")
  ) {
    return "NEITHER";
  }

  // Terms leaning
  if (t.includes("terms") || t.includes("net") || t.includes("days") || t.includes("payment")) return "TERMS";

  // Price leaning
  if (t.includes("price") || t.includes("discount") || t.includes("cost") || t.includes("rate")) return "PRICE";

  return null;
}

function bestTerms(config: NegotiationConfig): Offer["payment_terms"] {
  const opts = config.parameters.payment_terms.options;
  return opts[opts.length - 1]; // last option = best
}

function nextBetterTerms(config: NegotiationConfig, t: Offer["payment_terms"]) {
  const opts = config.parameters.payment_terms.options;
  const idx = t ? opts.indexOf(t) : -1;
  return opts[Math.min(idx + 1, opts.length - 1)];
}

function counterFromPreference(config: NegotiationConfig, lastOffer: Offer, pref: "PRICE" | "TERMS", round: number): Offer {
  const { anchor, target, concession_step, max_acceptable } = config.parameters.unit_price;

  if (pref === "TERMS") {
    // keep price, improve terms (one step)
    const nextTerms = lastOffer.payment_terms ? nextBetterTerms(config, lastOffer.payment_terms) : bestTerms(config);
    return { unit_price: lastOffer.unit_price, payment_terms: nextTerms };
  }

  // pref === "PRICE": keep terms, nudge price toward our position
  const buyerPosition = Math.min(target, anchor + (round - 1) * concession_step);
  const desired = lastOffer.unit_price == null ? buyerPosition : Math.min(lastOffer.unit_price, buyerPosition);
  const clamped = Math.min(desired, max_acceptable);
  return { unit_price: clamped, payment_terms: lastOffer.payment_terms ?? bestTerms(config) };
}

export function decideConvoIntent(args: {
  state: ConvoState;
  round: number;
  vendorText: string;
  vendorOffer: Offer;
  engineDecision: Decision;
  config: NegotiationConfig;
}): { intent: any; counterOffer: Offer | null; nextState: ConvoState } {
  const { state, round, vendorText, vendorOffer, engineDecision, config } = args;

  // Terminal
  if (engineDecision.action === "ACCEPT") {
    return {
      intent: "ACCEPT",
      counterOffer: null,
      nextState: { ...state, phase: "TERMINAL", lastVendorOffer: vendorOffer, pendingCounter: null, awaitingPreference: false },
    };
  }
  if (engineDecision.action === "ESCALATE") {
    return {
      intent: "ESCALATE",
      counterOffer: null,
      nextState: { ...state, phase: "TERMINAL", lastVendorOffer: vendorOffer, pendingCounter: null, awaitingPreference: false },
    };
  }
  if (engineDecision.action === "WALK_AWAY") {
    return {
      intent: "WALK_AWAY",
      counterOffer: null,
      nextState: { ...state, phase: "TERMINAL", lastVendorOffer: vendorOffer, pendingCounter: null, awaitingPreference: false },
    };
  }

  // Missing info
  if (engineDecision.action === "ASK_CLARIFY") {
    return {
      intent: "ASK_CLARIFY",
      counterOffer: null,
      nextState: { ...state, phase: "WAITING_FOR_OFFER", lastVendorOffer: vendorOffer },
    };
  }

  // If we are waiting for preference and vendor replied
  if (state.awaitingPreference && (state.pendingCounter || state.pendingCounterOffer) && state.lastVendorOffer) {
    const pref = detectPreference(vendorText);
    const pendingCounter = state.pendingCounter ?? state.pendingCounterOffer;

    // If vendor refuses to choose, just proceed with the pending counter
    if (pref === "NEITHER" || pref === null) {
      return {
        intent: "COUNTER_DIRECT",
        counterOffer: pendingCounter,
        nextState: {
          ...state,
          phase: "NEGOTIATING",
          askedPreference: true,
          awaitingPreference: false,
          pendingCounter: null,
          pendingCounterOffer: null,
          lastVendorOffer: vendorOffer,
          lastIntent: "COUNTER_DIRECT",
        },
      };
    }

    // If vendor chooses, generate counter accordingly
    const counter = counterFromPreference(config, state.lastVendorOffer, pref, round);

    return {
      intent: "COUNTER_DIRECT",
      counterOffer: counter,
      nextState: {
        ...state,
        phase: "NEGOTIATING",
        askedPreference: true,
        awaitingPreference: false,
        pendingCounter: null,
        pendingCounterOffer: null,
        lastVendorOffer: vendorOffer,
        lastIntent: "COUNTER_DIRECT",
      },
    };
  }

  // Normal counter behavior
  if (engineDecision.action === "COUNTER") {
    // Create offer ID to track if we've asked preference for this exact offer
    const offerId = `${vendorOffer.unit_price}|${vendorOffer.payment_terms}`;
    const hasAskedForThisOffer = state.preferenceAskedForOfferId === offerId;
    
    // Ask preference only once per offer, and only in early rounds
    const shouldAskPreference =
      !hasAskedForThisOffer && 
      !state.awaitingPreference && 
      round <= 2 &&
      vendorOffer.unit_price != null &&
      vendorOffer.payment_terms != null;

    if (shouldAskPreference && engineDecision.counterOffer) {
      return {
        intent: "ASK_PREFERENCE",
        counterOffer: null,
        nextState: {
          ...state,
          phase: "WAITING_FOR_PREFERENCE",
          askedPreference: false,
          awaitingPreference: true,
          pendingCounter: engineDecision.counterOffer,
          pendingCounterOffer: engineDecision.counterOffer,
          preferenceAskedForOfferId: offerId,
          lastVendorOffer: vendorOffer,
          lastIntent: "ASK_PREFERENCE",
        },
      };
    }

    // Preference already asked for this offer, or past round 2 - just present counter
    return {
      intent: "COUNTER_DIRECT",
      counterOffer: engineDecision.counterOffer,
      nextState: {
        ...state,
        phase: "NEGOTIATING",
        awaitingPreference: false,
        pendingCounter: null,
        pendingCounterOffer: null,
        lastVendorOffer: vendorOffer,
        lastIntent: "COUNTER_DIRECT",
      },
    };
  }

  // fallback
  return {
    intent: "ASK_FOR_OFFER",
    counterOffer: null,
    nextState: { ...state, phase: "WAITING_FOR_OFFER", lastVendorOffer: vendorOffer },
  };
}

