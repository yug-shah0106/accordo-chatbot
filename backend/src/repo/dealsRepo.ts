import { pool } from "../db/db";
import { v4 as uuid } from "uuid";

export async function createTemplate(name: string, configJson: any) {
  const id = uuid();
  await pool.query(
    "INSERT INTO deal_templates(id,name,config_json) VALUES($1,$2,$3)",
    [id, name, configJson]
  );
  return { id, name };
}

export async function createDeal(input: { 
  title: string; 
  counterparty?: string; 
  templateId?: string | null;
  negotiationTemplateId?: string | null;
}) {
  const id = uuid();
  const { title, counterparty, templateId, negotiationTemplateId } = input;
  
  // If no negotiation template specified, get default template
  let finalTemplateId = negotiationTemplateId;
  if (!finalTemplateId) {
    const defaultTemplate = await pool.query(
      "SELECT id FROM negotiation_templates WHERE name = $1 LIMIT 1",
      ["Default Buy-side"]
    );
    if (defaultTemplate.rows.length > 0) {
      finalTemplateId = defaultTemplate.rows[0].id;
    }
  }
  
  await pool.query(
    "INSERT INTO deals(id,title,counterparty,template_id,negotiation_template_id) VALUES($1,$2,$3,$4,$5)",
    [id, title, counterparty ?? null, templateId ?? null, finalTemplateId ?? null]
  );
  return { id };
}

export async function getDeal(dealId: string) {
  const r = await pool.query("SELECT * FROM deals WHERE id=$1", [dealId]);
  return r.rows[0] ?? null;
}

export async function listDeals() {
  // Only return active deals (not archived, not deleted)
  const r = await pool.query(
    "SELECT * FROM deals WHERE archived_at IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC"
  );
  return r.rows;
}

export async function listArchivedDeals() {
  const r = await pool.query(
    "SELECT * FROM deals WHERE archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY archived_at DESC"
  );
  return r.rows;
}

export async function listDeletedDeals() {
  const r = await pool.query(
    "SELECT * FROM deals WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
  );
  return r.rows;
}

export async function archiveDeal(dealId: string) {
  await pool.query(
    "UPDATE deals SET archived_at = NOW(), updated_at = NOW() WHERE id = $1",
    [dealId]
  );
  return getDeal(dealId);
}

export async function unarchiveDeal(dealId: string) {
  await pool.query(
    "UPDATE deals SET archived_at = NULL, updated_at = NOW() WHERE id = $1",
    [dealId]
  );
  return getDeal(dealId);
}

export async function softDeleteDeal(dealId: string) {
  // When soft deleting, also clear archived_at
  await pool.query(
    "UPDATE deals SET deleted_at = NOW(), archived_at = NULL, updated_at = NOW() WHERE id = $1",
    [dealId]
  );
  return getDeal(dealId);
}

export async function restoreDeal(dealId: string) {
  await pool.query(
    "UPDATE deals SET deleted_at = NULL, updated_at = NOW() WHERE id = $1",
    [dealId]
  );
  return getDeal(dealId);
}

export async function archiveFromDeletedDeal(dealId: string) {
  // Move from deleted to archived
  await pool.query(
    "UPDATE deals SET deleted_at = NULL, archived_at = NOW(), updated_at = NOW() WHERE id = $1",
    [dealId]
  );
  return getDeal(dealId);
}

export async function permanentlyDeleteDeal(dealId: string) {
  // First delete all messages
  await deleteMessages(dealId);
  // Then delete the deal
  await pool.query("DELETE FROM deals WHERE id = $1", [dealId]);
}

export async function bumpDeal(dealId: string, patch: { 
  round: number; 
  status: string; 
  latestOfferJson?: any;
  latestVendorOffer?: any;
  latestDecisionAction?: string;
  latestUtility?: number;
}) {
  await pool.query(
    `UPDATE deals SET 
      round=$2, 
      status=$3, 
      latest_offer_json=$4,
      latest_vendor_offer=$5,
      latest_decision_action=$6,
      latest_utility=$7,
      updated_at=NOW() 
    WHERE id=$1`,
    [
      dealId, 
      patch.round, 
      patch.status, 
      patch.latestOfferJson ?? null,
      patch.latestVendorOffer ?? null,
      patch.latestDecisionAction ?? null,
      patch.latestUtility ?? null
    ]
  );
}

export async function addMessage(args: {
  dealId: string;
  role: "VENDOR" | "ACCORDO" | "SYSTEM";
  content: string;
  extractedOffer?: any;
  engineDecision?: any;
  decisionAction?: string;
  utilityScore?: number;
  counterOffer?: any;
  explainabilityJson?: any;
}) {
  const id = uuid();
  await pool.query(
    `INSERT INTO messages(
      id,deal_id,role,content,extracted_offer,engine_decision,
      decision_action,utility_score,counter_offer,explainability_json
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id, 
      args.dealId, 
      args.role, 
      args.content, 
      args.extractedOffer ?? null, 
      args.engineDecision ?? null,
      args.decisionAction ?? null,
      args.utilityScore ?? null,
      args.counterOffer ?? null,
      args.explainabilityJson ?? null
    ]
  );
  return { id };
}

export async function listMessages(dealId: string) {
  const r = await pool.query(
    "SELECT * FROM messages WHERE deal_id=$1 ORDER BY created_at ASC",
    [dealId]
  );
  return r.rows;
}

export async function deleteMessages(dealId: string) {
  await pool.query("DELETE FROM messages WHERE deal_id=$1", [dealId]);
}

export async function resetDeal(dealId: string) {
  await pool.query(
    `UPDATE deals SET 
      status=$1, 
      round=$2, 
      latest_offer_json=$3,
      latest_vendor_offer=$4,
      latest_decision_action=$5,
      latest_utility=$6,
      convo_state_json=$7,
      updated_at=NOW() 
    WHERE id=$8`,
    ["NEGOTIATING", 0, null, null, null, null, null, dealId]
  );
  await deleteMessages(dealId);
  return getDeal(dealId);
}

export async function resumeDeal(dealId: string) {
  const deal = await getDeal(dealId);
  if (!deal) {
    throw new Error("Deal not found");
  }
  if (deal.status !== "ESCALATED") {
    throw new Error(`Cannot resume deal with status ${deal.status}. Only ESCALATED deals can be resumed.`);
  }
  
  await pool.query(
    "UPDATE deals SET status=$1, updated_at=NOW() WHERE id=$2",
    ["NEGOTIATING", dealId]
  );
  return getDeal(dealId);
}

export async function updateConversationState(dealId: string, state: any) {
  await pool.query(
    "UPDATE deals SET convo_state_json=$1, updated_at=NOW() WHERE id=$2",
    [JSON.stringify(state), dealId]
  );
}

export async function updateDealMode(dealId: string, mode: "INSIGHTS" | "CONVERSATION") {
  await pool.query(
    "UPDATE deals SET mode=$1, updated_at=NOW() WHERE id=$2",
    [mode, dealId]
  );
}

