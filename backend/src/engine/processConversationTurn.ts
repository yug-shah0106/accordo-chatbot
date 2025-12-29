import { getDeal, bumpDeal, addMessage, listMessages, updateConversationState } from "../repo/dealsRepo";
import { getTemplateForDeal } from "../repo/templatesRepo";
import { parseOfferRegex } from "./parseOffer";
import { decideNextMove } from "./decide";
import { Decision, Offer } from "./types";
import type { NegotiationConfig } from "../repo/templatesRepo";
import { computeExplainability } from "./utility";
import {
  ConversationState,
  determineIntent,
  generateConversationReply,
  updateConversationState as updateState,
} from "./conversationManager";

/**
 * Process one vendor turn in conversation mode
 * Returns conversation-safe messages (no engine metadata)
 */
export async function processConversationTurn(dealId: string, vendorText: string) {
  const deal = await getDeal(dealId);
  if (!deal) {
    throw new Error("Deal not found");
  }

  // Hard rule: block if not NEGOTIATING
  if (deal.status !== "NEGOTIATING") {
    const messages = await listMessages(dealId);
    return { 
      blocked: true, 
      deal, 
      messages: sanitizeMessagesForConversation(messages), 
      reason: `Deal is ${deal.status}. Reset or resume to continue.` 
    };
  }

  // Load negotiation config from DB
  const config = await getTemplateForDeal(dealId);

  // Get or initialize conversation state
  let convoState: ConversationState = deal.convo_state_json 
    ? (deal.convo_state_json as any)
    : { phase: "GREET", asked_preference: false };

  // Hard rule: enforce max rounds BEFORE processing
  const round = (deal.round ?? 0) + 1;
  if (round > config.max_rounds) {
    await bumpDeal(dealId, { 
      round: deal.round, 
      status: "ESCALATED",
      latestDecisionAction: "ESCALATE",
      latestUtility: 0
    });
    const updatedDeal = await getDeal(dealId);
    const messages = await listMessages(dealId);
    return { 
      blocked: true, 
      deal: updatedDeal, 
      messages: sanitizeMessagesForConversation(messages), 
      reason: "Max rounds reached" 
    };
  }

  // Extract offer
  const vendorOffer = parseOfferRegex(vendorText);

  // Store vendor message
  await addMessage({ 
    dealId, 
    role: "VENDOR", 
    content: vendorText, 
    extractedOffer: vendorOffer 
  });

  // Decide (engine logic)
  const decision = decideNextMove(config, vendorOffer, round);

  // Compute explainability (stored but not returned in conversation mode)
  const explainability = computeExplainability(config, vendorOffer, decision);

  // Determine conversation intent
  const intent = determineIntent(decision, convoState, round, config);

  // Generate conversation reply (using templates, not LLM for consistency)
  const reply = generateConversationReply(
    dealId,
    round,
    intent,
    decision,
    vendorOffer,
    config
  );

  // Update conversation state
  const newConvoState = updateState(convoState, intent, round, vendorOffer);
  await updateConversationState(dealId, newConvoState);

  // Store Accordo message with all metadata (for explain endpoint)
  await addMessage({ 
    dealId, 
    role: "ACCORDO", 
    content: reply, 
    engineDecision: decision,
    decisionAction: decision.action,
    utilityScore: decision.utilityScore,
    counterOffer: decision.counterOffer ?? null,
    explainabilityJson: explainability
  });

  // Update deal status and derived fields
  const nextStatus =
    decision.action === "ACCEPT" ? "ACCEPTED" :
    decision.action === "WALK_AWAY" ? "WALKED_AWAY" :
    decision.action === "ESCALATE" ? "ESCALATED" :
    "NEGOTIATING";

  await bumpDeal(dealId, { 
    round, 
    status: nextStatus, 
    latestOfferJson: vendorOffer,
    latestVendorOffer: vendorOffer,
    latestDecisionAction: decision.action,
    latestUtility: decision.utilityScore
  });

  // Return updated state (conversation-safe)
  const updatedDeal = await getDeal(dealId);
  const updatedMessages = await listMessages(dealId);
  const sanitizedMessages = sanitizeMessagesForConversation(updatedMessages);

  // Check if explainability is available (last ACCORDO message has it)
  const lastAccordo = [...updatedMessages].reverse().find(m => m.role === "ACCORDO");
  const revealAvailable = !!lastAccordo?.explainability_json;

  return {
    blocked: false,
    deal: updatedDeal,
    messages: sanitizedMessages,
    revealAvailable,
  };
}

/**
 * Remove engine metadata from messages for conversation mode
 */
function sanitizeMessagesForConversation(messages: any[]) {
  return messages.map(msg => ({
    id: msg.id,
    deal_id: msg.deal_id,
    role: msg.role,
    content: msg.content,
    created_at: msg.created_at,
    // Explicitly exclude: extracted_offer, engine_decision, decision_action, utility_score, counter_offer, explainability_json
  }));
}

