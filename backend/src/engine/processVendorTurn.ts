import { getDeal, bumpDeal, addMessage, listMessages } from "../repo/dealsRepo";
import { getTemplateForDeal } from "../repo/templatesRepo";
import { parseOfferRegex } from "./parseOffer";
import { decideNextMove } from "./decide";
import { writeReplyWithOllama } from "../ollama/writeReply";
import { Decision, Offer } from "./types";
import type { NegotiationConfig } from "../repo/templatesRepo";
import { computeExplainability } from "./utility";

function isCompleteOffer(o: Offer | null | undefined): boolean {
  return o?.unit_price != null && o?.payment_terms != null;
}

function mergeWithLastOffer(rawOffer: Offer, lastOffer: Offer | null | undefined): Offer {
  if (!lastOffer) return rawOffer;

  return {
    unit_price: rawOffer.unit_price ?? lastOffer.unit_price ?? null,
    payment_terms: rawOffer.payment_terms ?? lastOffer.payment_terms ?? null,
  };
}

/**
 * Shared pipeline function: processes one vendor turn
 * Enforces status checks and max rounds
 * Returns updated deal and messages
 * 
 * This is the SINGLE SOURCE OF TRUTH for negotiation logic
 */
export async function processVendorTurn(dealId: string, vendorText: string) {
  const deal = await getDeal(dealId);
  if (!deal) {
    throw new Error("Deal not found");
  }

  // ✅ Allow continuing in ESCALATED (don't hard-stop)
  if (deal.status === "ACCEPTED" || deal.status === "WALKED_AWAY") {
    const messages = await listMessages(dealId);
    return { blocked: true, deal, messages, reason: `Deal is ${deal.status}, cannot continue.` };
  }

  // Load negotiation config from DB
  const config = await getTemplateForDeal(dealId);

  // 1) Parse vendor message
  const rawOffer = parseOfferRegex(vendorText);

  // ✅ 1.1 Merge with last known offer when vendor doesn't repeat numbers
  const effectiveOffer = mergeWithLastOffer(rawOffer, deal.latest_vendor_offer);

  // 2) Store vendor message (store raw extraction for traceability)
  await addMessage({ 
    dealId, 
    role: "VENDOR", 
    content: vendorText, 
    extractedOffer: rawOffer 
  });

  // ✅ 3) Round increments only when we have a complete offer
  const currentRound = deal.round ?? 0;
  const nextRound = isCompleteOffer(effectiveOffer) ? currentRound + 1 : currentRound;

  // ✅ Check max rounds AFTER determining if we should increment
  if (nextRound > config.max_rounds) {
    await bumpDeal(dealId, { 
      round: currentRound, 
      status: "ESCALATED",
      latestDecisionAction: "ESCALATE",
      latestUtility: 0
    });
    const updatedDeal = await getDeal(dealId);
    const messages = await listMessages(dealId);
    return { blocked: true, deal: updatedDeal, messages, reason: "Max rounds reached" };
  }

  // 4) Decide
  const decision = decideNextMove(config, effectiveOffer, nextRound);

  // Compute explainability for audit trail
  const explainability = computeExplainability(config, effectiveOffer, decision);

  // ✅ 5) Generate reply (include history so it doesn't repeat)
  const history = await listMessages(dealId);
  const reply = await writeReplyWithOllama({ 
    vendorText, 
    vendorOffer: effectiveOffer, 
    decision, 
    config,
    history: history.slice(-10) // last 10 messages
  });

  // 6) Store Accordo message with derived fields and explainability
  await addMessage({ 
    dealId, 
    role: "ACCORDO", 
    content: reply, 
    engineDecision: decision,
    // Store derived fields explicitly
    decisionAction: decision.action,
    utilityScore: decision.utilityScore,
    counterOffer: decision.counterOffer ?? null,
    explainabilityJson: explainability
  });

  // ✅ 7) Update deal state
  const nextStatus =
    decision.action === "ACCEPT" ? "ACCEPTED" :
    decision.action === "WALK_AWAY" ? "WALKED_AWAY" :
    decision.action === "ESCALATE" ? "ESCALATED" :
    "NEGOTIATING";

  await bumpDeal(dealId, { 
    round: nextRound, 
    status: nextStatus, 
    latestOfferJson: effectiveOffer,
    latestVendorOffer: effectiveOffer, // this is important for "Nope" cases
    latestDecisionAction: decision.action,
    latestUtility: decision.utilityScore
  });

  // Return updated state
  const updatedDeal = await getDeal(dealId);
  const updatedMessages = await listMessages(dealId);

  return {
    blocked: false,
    deal: updatedDeal,
    messages: updatedMessages,
    decision,
    reply,
  };
}

