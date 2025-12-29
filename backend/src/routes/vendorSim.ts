import express from "express";
import { getDeal, listMessages } from "../repo/dealsRepo";
import { vendorRespond } from "../vendor/vendorAgent";
import { processVendorTurn } from "../engine/processVendorTurn";

export const vendorSimRouter = express.Router();

vendorSimRouter.post("/deals/:dealId/vendor/next", async (req, res) => {
  try {
    const { dealId } = req.params;
    const { scenario = "HARD" } = req.body;

    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Hard rule: block if not NEGOTIATING (processVendorTurn also checks, but fail fast here)
    if (deal.status !== "NEGOTIATING") {
      const messages = await listMessages(dealId);
      return res.status(409).json({
        error: `Deal is ${deal.status}. Cannot generate vendor reply.`,
        deal,
        messages,
      });
    }

    const messages = await listMessages(dealId);
    const lastAccordo = [...messages].reverse().find(m => m.role === "ACCORDO");
    const lastDecision = lastAccordo?.engine_decision ?? null;
    const lastCounter = lastDecision?.counterOffer ?? null;

    const round = (deal.round ?? 0) + 1;

    // Generate vendor response with scenario
    const vendor = await vendorRespond({
      dealTitle: deal.title,
      round,
      lastAccordoText: lastAccordo?.content ?? "Start negotiation.",
      lastAccordoCounterOffer: lastCounter,
      scenario: scenario as "HARD" | "SOFT" | "WALK_AWAY",
    });

    // Process vendor turn using shared pipeline (no HTTP self-call!)
    const result = await processVendorTurn(dealId, vendor.message);
    
    if (result.blocked) {
      return res.status(409).json({
        error: result.reason || `Deal is ${result.deal.status}. Cannot process vendor reply.`,
        deal: result.deal,
        messages: result.messages,
        vendorGenerated: vendor,
      });
    }

    // Return {deal, messages} for UI consistency
    res.json({
      vendorGenerated: vendor,
      deal: result.deal,
      messages: result.messages,
      decision: result.decision,
      reply: result.reply,
    });
  } catch (error) {
    console.error("Error processing vendor turn:", error);
    const deal = await getDeal(req.params.dealId);
    const messages = deal ? await listMessages(req.params.dealId) : [];
    res.status(500).json({ 
      error: "Failed to process vendor reply",
      deal: deal ?? null,
      messages
    });
  }
});
