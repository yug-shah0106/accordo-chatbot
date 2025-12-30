import express from "express";
import {
  createDeal,
  getDeal,
  listMessages,
  listDeals,
  listArchivedDeals,
  listDeletedDeals,
  archiveDeal,
  unarchiveDeal,
  softDeleteDeal,
  restoreDeal,
  archiveFromDeletedDeal,
  permanentlyDeleteDeal,
  resetDeal,
  resumeDeal
} from "../repo/dealsRepo";
import { processVendorTurn } from "../engine/processVendorTurn";
import { vendorRespond } from "../vendor/vendorAgent";
import { getTemplateForDeal } from "../repo/templatesRepo";

export const dealsRouter = express.Router();

dealsRouter.get("/deals", async (req, res) => {
  const deals = await listDeals();
  res.json({ deals });
});

// IMPORTANT: These specific routes MUST come before /deals/:dealId to avoid matching "archived"/"deleted" as dealId
dealsRouter.get("/deals/archived", async (req, res) => {
  try {
    const deals = await listArchivedDeals();
    res.json({ deals });
  } catch (error) {
    console.error("Error fetching archived deals:", error);
    res.status(500).json({ error: "Failed to fetch archived deals" });
  }
});

dealsRouter.get("/deals/deleted", async (req, res) => {
  try {
    const deals = await listDeletedDeals();
    res.json({ deals });
  } catch (error) {
    console.error("Error fetching deleted deals:", error);
    res.status(500).json({ error: "Failed to fetch deleted deals" });
  }
});

dealsRouter.post("/deals", async (req, res) => {
  try {
    const { title, counterparty, templateId, negotiationTemplateId } = req.body;
    const deal = await createDeal({
      title,
      counterparty,
      templateId: templateId ?? null,
      negotiationTemplateId: negotiationTemplateId ?? null
    });
    res.json(deal);
  } catch (error) {
    console.error("Error creating deal:", error);
    res.status(500).json({ error: "Failed to create deal", details: error instanceof Error ? error.message : String(error) });
  }
});

dealsRouter.get("/deals/:dealId", async (req, res) => {
  const deal = await getDeal(req.params.dealId);
  if (!deal) return res.status(404).json({ error: "Not found" });
  const messages = await listMessages(req.params.dealId);
  res.json({ deal, messages });
});

dealsRouter.post("/deals/:dealId/messages", async (req, res) => {
  try {
    const { dealId } = req.params;
    const { text } = req.body;

    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Hard rule: block if not NEGOTIATING (processVendorTurn also checks, but fail fast here)
    if (deal.status !== "NEGOTIATING") {
      const messages = await listMessages(dealId);
      return res.status(409).json({
        error: `Deal is ${deal.status}. Reset or resume to continue.`,
        deal,
        messages,
      });
    }

    const result = await processVendorTurn(dealId, text);
    
    if (result.blocked) {
      return res.status(409).json({
        error: result.reason || `Deal is ${result.deal.status}. Cannot process message.`,
        deal: result.deal,
        messages: result.messages,
      });
    }

    // Return {deal, messages} for UI consistency
    res.json({
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
      error: "Failed to process message",
      deal: deal ?? null,
      messages 
    });
  }
});

// Reset deal endpoint
dealsRouter.post("/deals/:dealId/reset", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    
    const updatedDeal = await resetDeal(dealId);
    const messages = await listMessages(dealId);
    
    // Return {deal, messages} for UI consistency
    res.json({ deal: updatedDeal, messages });
  } catch (error) {
    console.error("Error resetting deal:", error);
    res.status(500).json({ 
      error: "Failed to reset deal",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Resume deal endpoint (for ESCALATED deals)
dealsRouter.post("/deals/:dealId/resume", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    
    const updatedDeal = await resumeDeal(dealId);
    const messages = await listMessages(dealId);
    
    // Return {deal, messages} for UI consistency
    res.json({ deal: updatedDeal, messages });
  } catch (error) {
    console.error("Error resuming deal:", error);
    const status = error instanceof Error && error.message.includes("Cannot resume") ? 409 : 500;
    res.status(status).json({ 
      error: error instanceof Error ? error.message : "Failed to resume deal"
    });
  }
});

// Run demo endpoint
dealsRouter.post("/deals/:dealId/run-demo", async (req, res) => {
  try {
    const { dealId } = req.params;
    const { maxSteps = 10, scenario = "HARD" } = req.body;
    
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    
    // Hard rule: block if not NEGOTIATING
    if (deal.status !== "NEGOTIATING") {
      const messages = await listMessages(dealId);
      return res.status(409).json({
        error: `Deal is ${deal.status}. Cannot run demo.`,
        deal,
        messages,
      });
    }
    
    const steps: Array<{ vendorMessage: string; accordoReply: string; decision: any }> = [];
    
    for (let i = 0; i < maxSteps; i++) {
      // Check current deal status (must be NEGOTIATING to continue)
      const currentDeal = await getDeal(dealId);
      if (currentDeal.status !== "NEGOTIATING") {
        break;
      }
      
      // Get last messages for context
      const currentMessages = await listMessages(dealId);
      const lastAccordo = [...currentMessages].reverse().find((m) => m.role === "ACCORDO");
      
      try {
        // Generate vendor response with scenario
        const vendorResponse = await vendorRespond({
          dealTitle: currentDeal.title,
          round: (currentDeal.round ?? 0) + 1,
          lastAccordoText: lastAccordo?.content || "",
          lastAccordoCounterOffer: lastAccordo?.engine_decision?.counterOffer || null,
          scenario: scenario as "HARD" | "SOFT" | "WALK_AWAY",
        });
        
        // Process vendor turn using shared pipeline
        const result = await processVendorTurn(dealId, vendorResponse.message);
        
        if (result.blocked) {
          // Max rounds or status changed
          break;
        }
        
        steps.push({
          vendorMessage: vendorResponse.message,
          accordoReply: result.reply!,
          decision: result.decision!,
        });
        
        // Stop if deal is no longer negotiating
        if (result.deal.status !== "NEGOTIATING") {
          break;
        }
        
        // Small delay to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (vendorError) {
        console.error("Error in demo step:", vendorError);
        // Continue to next step or break if critical
        break;
      }
    }
    
    const finalDeal = await getDeal(dealId);
    const finalMessages = await listMessages(dealId);
    
    // Return {deal, messages} for UI consistency
    res.json({ deal: finalDeal, messages: finalMessages, steps });
  } catch (error) {
    console.error("Error running demo:", error);
    res.status(500).json({
      error: "Failed to run demo",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ==================== Deal Lifecycle Action Endpoints ====================

// Archive a deal
dealsRouter.post("/deals/:dealId/archive", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const updatedDeal = await archiveDeal(dealId);
    res.json({ deal: updatedDeal });
  } catch (error) {
    console.error("Error archiving deal:", error);
    res.status(500).json({ error: "Failed to archive deal" });
  }
});

// Unarchive a deal (restore from archived to active)
dealsRouter.post("/deals/:dealId/unarchive", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const updatedDeal = await unarchiveDeal(dealId);
    res.json({ deal: updatedDeal });
  } catch (error) {
    console.error("Error unarchiving deal:", error);
    res.status(500).json({ error: "Failed to unarchive deal" });
  }
});

// Soft delete a deal
dealsRouter.post("/deals/:dealId/soft-delete", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const updatedDeal = await softDeleteDeal(dealId);
    res.json({ deal: updatedDeal });
  } catch (error) {
    console.error("Error deleting deal:", error);
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

// Restore a deal from deleted to active
dealsRouter.post("/deals/:dealId/restore", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const updatedDeal = await restoreDeal(dealId);
    res.json({ deal: updatedDeal });
  } catch (error) {
    console.error("Error restoring deal:", error);
    res.status(500).json({ error: "Failed to restore deal" });
  }
});

// Archive a deal from deleted (move to archived)
dealsRouter.post("/deals/:dealId/archive-from-deleted", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const updatedDeal = await archiveFromDeletedDeal(dealId);
    res.json({ deal: updatedDeal });
  } catch (error) {
    console.error("Error archiving deal from deleted:", error);
    res.status(500).json({ error: "Failed to archive deal" });
  }
});

// Permanently delete a deal
dealsRouter.delete("/deals/:dealId/permanent", async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    await permanentlyDeleteDeal(dealId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error permanently deleting deal:", error);
    res.status(500).json({ error: "Failed to permanently delete deal" });
  }
});
