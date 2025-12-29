import { pool } from "../db/db";
import type { ConvoState, Explainability } from "./types";

export async function getConvoState(dealId: string): Promise<ConvoState> {
  const r = await pool.query(`SELECT convo_state_json FROM deals WHERE id=$1`, [dealId]);
  if (r.rows.length === 0) throw new Error("Deal not found");
  const s = r.rows[0].convo_state_json ?? {};
  return {
    phase: s.phase ?? "WAITING_FOR_OFFER",
    askedPreference: s.askedPreference ?? false,
    awaitingPreference: s.awaitingPreference ?? false,
    lastVendorOffer: s.lastVendorOffer ?? null,
    pendingCounter: s.pendingCounter ?? null,
    pendingCounterOffer: s.pendingCounterOffer ?? s.pendingCounter ?? null,
    lastIntent: s.lastIntent ?? null,
    preferenceAskedForOfferId: s.preferenceAskedForOfferId ?? null,
    refusalCount: s.refusalCount ?? 0,
    convoRound: s.convoRound ?? null,
  };
}

export async function setConvoState(dealId: string, next: ConvoState) {
  await pool.query(`UPDATE deals SET convo_state_json=$2 WHERE id=$1`, [dealId, JSON.stringify(next)]);
}

export async function getLastExplainability(dealId: string): Promise<Explainability | null> {
  const r = await pool.query(
    `
    SELECT explainability_json
    FROM messages
    WHERE deal_id=$1 AND role='ACCORDO'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [dealId]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0].explainability_json ?? null;
}

