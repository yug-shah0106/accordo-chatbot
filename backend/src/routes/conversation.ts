import express from "express";
import { getDeal, listMessages } from "../repo/dealsRepo";
import { processConversationTurn } from "../engine/processConversationTurn";

export const conversationRouter = express.Router();

/**
 * POST /api/convo/deals/:dealId/messages
 * Process vendor message in conversation mode
 * Returns conversation-safe messages (no engine metadata)
 */
conversationRouter.post("/deals/:dealId/messages", async (req, res) => {
  try {
    const { dealId } = req.params;
    const { text } = req.body;

    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Hard rule: block if not NEGOTIATING
    if (deal.status !== "NEGOTIATING") {
      const messages = await listMessages(dealId);
      return res.status(409).json({
        error: `Deal is ${deal.status}. Reset or resume to continue.`,
        deal,
        messages: messages.map(m => ({
          id: m.id,
          deal_id: m.deal_id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })),
        revealAvailable: false,
      });
    }

    const result = await processConversationTurn(dealId, text);
    
    if (result.blocked) {
      return res.status(409).json({
        error: result.reason || `Deal is ${result.deal.status}. Cannot process message.`,
        deal: result.deal,
        messages: result.messages,
        revealAvailable: false,
      });
    }

    // Return conversation-safe response
    res.json({
      deal: result.deal,
      messages: result.messages,
      revealAvailable: result.revealAvailable,
    });
  } catch (error) {
    console.error("Error processing conversation turn:", error);
    const deal = await getDeal(req.params.dealId);
    const messages = deal ? await listMessages(req.params.dealId) : [];
    res.status(500).json({ 
      error: "Failed to process message",
      deal: deal ?? null,
      messages: messages.map(m => ({
        id: m.id,
        deal_id: m.deal_id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
      revealAvailable: false,
    });
  }
});

/**
 * GET /api/convo/deals/:dealId/last-explain
 * Returns explainability for the last turn only
 */
conversationRouter.get("/deals/:dealId/last-explain", async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const messages = await listMessages(dealId);
    const lastAccordo = [...messages].reverse().find(m => m.role === "ACCORDO");
    
    if (!lastAccordo || !lastAccordo.explainability_json) {
      return res.status(404).json({ 
        error: "No explainability data available for the last turn" 
      });
    }

    const explain = lastAccordo.explainability_json;
    
    // Return explainability data
    res.json({
      vendorOffer: explain.vendorOffer,
      utilities: explain.utilities,
      decision: explain.decision,
      reasons: explain.decision.reasons,
      counterOffer: explain.decision.counterOffer,
      configSnapshot: explain.configSnapshot,
    });
  } catch (error) {
    console.error("Error fetching explainability:", error);
    res.status(500).json({ 
      error: "Failed to fetch explainability",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

