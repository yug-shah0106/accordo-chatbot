import express from "express";
import { getDeal, addMessage, listMessages, bumpDeal } from "../repo/dealsRepo";
import { parseOfferRegex } from "../engine/parseOffer";
import { decideNextMove } from "../engine/decide";
import { getTemplateForDeal } from "../repo/templatesRepo";
import type { NegotiationConfig as EngineConfig } from "../repo/templatesRepo";
import { getConvoState, setConvoState, getLastExplainability } from "./convoRepo";
import { computeExplainability } from "./explainability";
import { decideConvoIntent } from "./convoManager";
import { writeConvoReplyWithOllama } from "./writeConvoReplyWithOllama";
import type { Offer as ConvoOffer, Decision as ConvoDecision, NegotiationConfig as ConvoConfig } from "./types";

export const convoRouter = express.Router();

// Start conversation (creates the initial "Hi..." message once)
convoRouter.post("/deals/:dealId/start", async (req, res) => {
  const { dealId } = req.params;
  const deal = await getDeal(dealId);
  if (!deal) return res.status(404).json({ error: "Deal not found" });

  // ✅ Allow start for CREATED and NEGOTIATING statuses
  if (deal.status !== "NEGOTIATING" && deal.status !== "CREATED") {
    return res.status(409).json({ error: `Deal is ${deal.status}` });
  }

  // Check if there's already an ACCORDO message (prevent duplicate greeting)
  const msgs = await listMessages(dealId);
  const hasAccordo = msgs.some(m => m.role === "ACCORDO");
  if (hasAccordo) {
    return res.json({ deal, messages: msgs.map(stripMeta), revealAvailable: true });
  }

  const state = await getConvoState(dealId);

  // ✅ First system reply should be greet + ask_offer combined
  const greet = await writeConvoReplyWithOllama({
    vendorText: "",
    intent: "GREET",
    vendorOffer: null,
    decision: null,
    counterOffer: null,
  });
  
  const askOffer = await writeConvoReplyWithOllama({
    vendorText: "",
    intent: "ASK_FOR_OFFER",
    vendorOffer: null,
    decision: null,
    counterOffer: null,
  });
  
  const reply = `${greet}\n\n${askOffer}`;

  await addMessage({ dealId, role: "ACCORDO", content: reply });

  await setConvoState(dealId, {
    phase: "WAITING_FOR_OFFER",
    askedPreference: false,
    awaitingPreference: false,
    lastVendorOffer: null,
    pendingCounter: null,
    lastIntent: "GREET",
  });

  const messages = await listMessages(dealId);
  res.json({ deal, messages: messages.map(stripMeta), revealAvailable: true });
});

// Conversation-safe message endpoint
convoRouter.post("/deals/:dealId/messages", async (req, res) => {
  const { dealId } = req.params;
  const { text } = req.body as { text: string };

  const deal = await getDeal(dealId);
  if (!deal) return res.status(404).json({ error: "Deal not found" });

  // ✅ Allow messages for CREATED and NEGOTIATING statuses
  if (deal.status !== "NEGOTIATING" && deal.status !== "CREATED") {
    return res.status(409).json({ error: `Deal is ${deal.status}. Reset to continue.` });
  }

  const config = await getTemplateForDeal(dealId);
  const state = await getConvoState(dealId);

  // Note: GREET phase is handled by the /start endpoint, not here
  // This endpoint only processes vendor messages after greeting

  // Helper: classify refusal type
  function classifyRefusal(text: string): "NO" | "LATER" | "ALREADY_SHARED" | "CONFUSED" | null {
    const t = text.toLowerCase().trim();
    if (t.includes("already") || t.includes("shared") || t.includes("told you") || t.includes("mentioned")) {
      return "ALREADY_SHARED";
    }
    if (t.includes("later") || t.includes("tomorrow") || t.includes("next week") || t.includes("soon")) {
      return "LATER";
    }
    if (t.includes("no") || t.includes("nope") || t.includes("can't") || t.includes("cannot") || t.includes("final") || t.includes("fixed")) {
      return "NO";
    }
    if (t.includes("?") || t.includes("what") || t.includes("how") || t.includes("confused")) {
      return "CONFUSED";
    }
    return null;
  }

  // Always parse first to see what we have
  const parsed = parseOfferRegex(text);
  const hasAnyOfferSignal = parsed.unit_price != null || parsed.payment_terms != null;
  const hasCompleteOffer = parsed.unit_price != null && parsed.payment_terms != null;

  // Handle non-offer messages based on conversation state
  if (!hasAnyOfferSignal) {
    // No numbers detected - treat as negotiation response or small talk
    if (state.phase === "WAITING_FOR_OFFER") {
      // Still waiting for first offer - this is small talk
      const reply = await writeConvoReplyWithOllama({
        vendorText: text,
        intent: "SMALL_TALK",
        vendorOffer: null,
        decision: null,
        counterOffer: null,
      });

      await addMessage({ dealId, role: "VENDOR", content: text });
      await addMessage({ dealId, role: "ACCORDO", content: reply });

      const messages = await listMessages(dealId);
      const updatedDeal = await getDeal(dealId);
      return res.json({ deal: updatedDeal, messages: messages.map(stripMeta), revealAvailable: false });
    } else {
      // Negotiation already started - this is a refusal/response without new offer
      const refusal = classifyRefusal(text);
      const newRefusalCount = (state.refusalCount ?? 0) + 1;
      
      // Update state with refusal count
      const updatedState = { ...state, refusalCount: newRefusalCount };
      
      let intent: string;
      let counterOffer: ConvoOffer | null = null;
      
      if (refusal === "LATER") {
        intent = "ACKNOWLEDGE_LATER";
        // Don't change deal status or round for "later" responses
      } else if (refusal === "ALREADY_SHARED") {
        // Vendor says they already shared - acknowledge and reference last offer
        intent = "NEGOTIATION_RESPONSE";
        if (state.lastVendorOffer) {
          // Propose next step based on last offer
          if (state.lastVendorOffer.payment_terms && state.lastVendorOffer.payment_terms !== "Net 90") {
            const opts = config.parameters.payment_terms.options;
            const betterTerms = opts[opts.length - 1] as ConvoOffer["payment_terms"];
            counterOffer = {
              unit_price: state.lastVendorOffer.unit_price,
              payment_terms: betterTerms,
            };
          }
        }
      } else if (state.awaitingPreference) {
        // Vendor didn't answer preference question - use pending counter
        intent = "COUNTER_DIRECT";
        counterOffer = state.pendingCounter ?? state.pendingCounterOffer ?? null;
        updatedState.awaitingPreference = false;
        updatedState.askedPreference = true;
        updatedState.pendingCounter = null;
        updatedState.pendingCounterOffer = null;
        updatedState.phase = "NEGOTIATING";
      } else if (state.pendingCounter || state.pendingCounterOffer) {
        // Use pending counter if available
        intent = "COUNTER_DIRECT";
        counterOffer = state.pendingCounter ?? state.pendingCounterOffer ?? null;
        updatedState.pendingCounter = null;
        updatedState.pendingCounterOffer = null;
        updatedState.phase = "NEGOTIATING";
      } else if (state.lastVendorOffer) {
        // Reference last offer and propose next step
        intent = "NEGOTIATION_RESPONSE";
        // Try to generate a reasonable counter based on last offer
        if (state.lastVendorOffer.payment_terms && state.lastVendorOffer.payment_terms !== "Net 90") {
          const opts = config.parameters.payment_terms.options;
          const betterTerms = opts[opts.length - 1] as ConvoOffer["payment_terms"]; // Net 90
          counterOffer = {
            unit_price: state.lastVendorOffer.unit_price,
            payment_terms: betterTerms,
          };
        } else if (state.pendingCounter || state.pendingCounterOffer) {
          counterOffer = state.pendingCounter ?? state.pendingCounterOffer ?? null;
        }
      } else {
        intent = "ACKNOWLEDGE";
      }

      const reply = await writeConvoReplyWithOllama({
        vendorText: text,
        intent: intent as any,
        vendorOffer: state.lastVendorOffer ?? null,
        decision: null,
        counterOffer,
      });

      await addMessage({ dealId, role: "VENDOR", content: text });
      await addMessage({ dealId, role: "ACCORDO", content: reply });
      
      await setConvoState(dealId, updatedState);

      const messages = await listMessages(dealId);
      const updatedDeal = await getDeal(dealId);
      // Don't change deal status or round for non-offer negotiation responses
      return res.json({ deal: updatedDeal, messages: messages.map(stripMeta), revealAvailable: false });
    }
  }

  // Has offer signal - proceed with normal flow
  const vendorOffer = parsed;

  // ✅ If still missing info and we're in ASK_OFFER phase, ask clarify (stay in ASK_OFFER)
  if ((state.phase === "WAITING_FOR_OFFER" || state.phase === "ASK_OFFER") && !hasCompleteOffer) {
    const reply = await writeConvoReplyWithOllama({
      vendorText: text,
      intent: "ASK_CLARIFY",
      vendorOffer: vendorOffer,
      decision: null,
      counterOffer: null,
    });
    
    await addMessage({ dealId, role: "VENDOR", content: text, extractedOffer: vendorOffer });
    await addMessage({ dealId, role: "ACCORDO", content: reply });
    
    // Keep phase as WAITING_FOR_OFFER (don't move to NEGOTIATING yet)
    await setConvoState(dealId, {
      ...state,
      lastVendorOffer: vendorOffer,
      lastIntent: "ASK_CLARIFY",
    });
    
    const messages = await listMessages(dealId);
    const updatedDeal = await getDeal(dealId);
    return res.json({ deal: updatedDeal, messages: messages.map(stripMeta), revealAvailable: false });
  }

  // Store vendor message with extractedOffer
  await addMessage({ dealId, role: "VENDOR", content: text, extractedOffer: vendorOffer });

  // ✅ Now we are in real negotiation - update phase
  const nextState = { ...state };
  if (hasCompleteOffer && (state.phase === "WAITING_FOR_OFFER" || state.phase === "ASK_OFFER")) {
    nextState.phase = "NEGOTIATING";
  }

  // Engine decision (convert engine types to convo types)
  // Only increment round if we have a complete offer or significant change from last offer
  const shouldIncrementRound = hasCompleteOffer || (hasAnyOfferSignal && state.lastVendorOffer && 
    (vendorOffer.unit_price !== state.lastVendorOffer.unit_price || vendorOffer.payment_terms !== state.lastVendorOffer.payment_terms));
  
  // Use current round for decision, but only bump deal.round if we should increment
  const currentRound = deal.round ?? 0;
  const decisionRound = shouldIncrementRound ? currentRound + 1 : currentRound;
  const engineDecision = decideNextMove(config, vendorOffer, decisionRound);
  
  // Convert engine decision to convo decision
  const convoDecision: ConvoDecision = {
    action: engineDecision.action as ConvoDecision["action"],
    utilityScore: engineDecision.utilityScore,
    counterOffer: engineDecision.counterOffer ? {
      unit_price: engineDecision.counterOffer.unit_price,
      payment_terms: engineDecision.counterOffer.payment_terms as ConvoOffer["payment_terms"],
    } : null,
    reasons: engineDecision.reasons,
  };
  
  const convoOffer: ConvoOffer = {
    unit_price: vendorOffer.unit_price,
    payment_terms: vendorOffer.payment_terms as ConvoOffer["payment_terms"],
  };
  
  // Convert config to convo config format
  const convoConfig: ConvoConfig = {
    parameters: {
      unit_price: {
        weight: config.parameters.unit_price.weight,
        direction: "lower_better",
        anchor: config.parameters.unit_price.anchor,
        target: config.parameters.unit_price.target,
        max_acceptable: config.parameters.unit_price.max_acceptable,
        concession_step: config.parameters.unit_price.concession_step,
      },
      payment_terms: {
        weight: config.parameters.payment_terms.weight,
        options: config.parameters.payment_terms.options as readonly ConvoOffer["payment_terms"][],
        utility: config.parameters.payment_terms.utility as Record<ConvoOffer["payment_terms"], number>,
      },
    },
    accept_threshold: config.accept_threshold,
    walkaway_threshold: config.walkaway_threshold,
    max_rounds: config.max_rounds,
  };

  // 5) Decide conversation intent (preference question etc.)
  const { intent, counterOffer, nextState: intentNextState } = decideConvoIntent({
    state: nextState,
    round: decisionRound,
    vendorText: text,
    vendorOffer: convoOffer,
    engineDecision: convoDecision,
    config: convoConfig,
  });
  
  // Merge state updates
  const finalNextState = { ...nextState, ...intentNextState };

  // 6) Compute explainability and store (but do NOT return to convo UI by default)
  const explainability = computeExplainability(convoConfig, convoOffer, convoDecision);

  // 7) Write reply
  const reply = await writeConvoReplyWithOllama({
    vendorText: text,
    intent,
    vendorOffer: convoOffer,
    decision: convoDecision,
    counterOffer,
  });

  // 8) Store accordo message with decision + explainability
  await addMessage({
    dealId,
    role: "ACCORDO",
    content: reply,
    engineDecision: engineDecision, // ok to store
    explainabilityJson: explainability, // store for on-demand reveal
  });

  // 9) Update deal status
  // Only escalate to ESCALATED status for max rounds or true escalation needs
  // Low utility should result in COUNTER or WALK_AWAY, not ESCALATED
  const nextStatus =
    engineDecision.action === "ACCEPT" ? "ACCEPTED" :
    engineDecision.action === "WALK_AWAY" ? "WALKED_AWAY" :
    (engineDecision.action === "ESCALATE" && engineDecision.reasons.some(r => r.includes("Max rounds"))) ? "ESCALATED" :
    "NEGOTIATING";

  // Only bump round if we actually processed a new offer
  const finalRound = shouldIncrementRound ? decisionRound : currentRound;
  
  await bumpDeal(dealId, { 
    round: finalRound, 
    status: nextStatus, 
    latestOfferJson: vendorOffer,
    latestVendorOffer: vendorOffer,
    latestDecisionAction: engineDecision.action,
    latestUtility: engineDecision.utilityScore
  });

  await setConvoState(dealId, finalNextState);

  const messages = await listMessages(dealId);
  const updatedDeal = await getDeal(dealId);

  res.json({ deal: updatedDeal, messages: messages.map(stripMeta), revealAvailable: true });
});

// Explainability on demand
convoRouter.get("/deals/:dealId/last-explain", async (req, res) => {
  const explain = await getLastExplainability(req.params.dealId);
  res.json({ explainability: explain });
});

// helper: hide meta from convo UI
function stripMeta(m: any) {
  return {
    id: m.id,
    dealId: m.deal_id ?? m.dealId,
    role: m.role,
    content: m.content,
    createdAt: m.created_at ?? m.createdAt,
  };
}

