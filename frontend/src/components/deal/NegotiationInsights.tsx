import type { Deal, Message, NegotiationConfig } from "../../api/client";
import DealRules from "./DealRules";
import UtilityBar from "../UtilityBar";
import "./NegotiationInsights.css";

interface NegotiationInsightsProps {
  deal: Deal;
  messages: Message[];
  config?: NegotiationConfig | null;
}

export default function NegotiationInsights({ deal, messages, config }: NegotiationInsightsProps) {
  const lastAccordoMessage = [...messages].reverse().find((m) => m.role === "ACCORDO");
  const lastDecision = lastAccordoMessage?.engine_decision;

  // Build concession timeline - show vendor offers and Accordo decisions per round
  const timeline: Array<{
    round: number;
    vendorOffer?: any;
    decision?: any;
    accordoOffer?: any;
  }> = [];

  // Group messages by round
  const vendorMessages = messages.filter((m) => m.role === "VENDOR");
  const accordoMessages = messages.filter((m) => m.role === "ACCORDO" && m.engine_decision);

  // Match vendor offers with Accordo decisions by order
  const maxRounds = Math.max(vendorMessages.length, accordoMessages.length);
  for (let i = 0; i < maxRounds; i++) {
    const vendorMsg = vendorMessages[i];
    const accordoMsg = accordoMessages[i];
    
    timeline.push({
      round: i + 1,
      vendorOffer: vendorMsg?.extracted_offer,
      decision: accordoMsg?.engine_decision,
      accordoOffer: accordoMsg?.engine_decision?.counterOffer,
    });
  }

  // Get latest utility score from last decision (only show if exists)
  // Ensure we get the actual utility value, not undefined
  const latestUtility = lastDecision?.utilityScore;
  const hasUtility = latestUtility !== null && latestUtility !== undefined && !isNaN(Number(latestUtility));

  return (
    <div className="negotiation-insights">
      <h3 className="insights-title">Negotiation Insights</h3>

      {/* Deal Rules - Collapsible */}
      <DealRules config={config} />

      {/* Current Vendor Offer - Show as package */}
      <div className="insight-section">
        <h4 className="insight-label">Vendor Offer</h4>
        {deal.latest_offer_json ? (
          <div className="offer-package">
            <div className="offer-package-row">
              <span className="offer-package-label">Unit Price:</span>
              <span className="offer-package-value">
                {deal.latest_offer_json.unit_price !== null && deal.latest_offer_json.unit_price !== undefined
                  ? `$${deal.latest_offer_json.unit_price}`
                  : "—"}
              </span>
            </div>
            <div className="offer-package-row">
              <span className="offer-package-label">Terms:</span>
              <span className="offer-package-value">
                {deal.latest_offer_json.payment_terms 
                  ? deal.latest_offer_json.payment_terms.includes('non-standard')
                    ? `${deal.latest_offer_json.payment_terms} → needs mapping`
                    : deal.latest_offer_json.payment_terms
                  : "— (needs clarification)"}
              </span>
            </div>
            <div className="offer-package-status">
              Parsed from vendor message
            </div>
          </div>
        ) : (
          <div className="no-offer">No offer yet</div>
        )}
      </div>

      {/* Current Accordo Counter Offer */}
      {lastDecision?.counterOffer && (
        <div className="insight-section">
          <h4 className="insight-label">Accordo Proposal</h4>
          <div className="offer-package">
            <div className="offer-package-row">
              <span className="offer-package-label">Unit Price:</span>
              <span className="offer-package-value">
                {lastDecision.counterOffer.unit_price !== null && lastDecision.counterOffer.unit_price !== undefined
                  ? `$${lastDecision.counterOffer.unit_price}`
                  : "—"}
              </span>
            </div>
            <div className="offer-package-row">
              <span className="offer-package-label">Terms:</span>
              <span className="offer-package-value">
                {lastDecision.counterOffer.payment_terms || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Utility Bar - Always show if there's a decision, use 0 if utility missing */}
      {lastDecision && (
        <div className="insight-section">
          <UtilityBar utilityScore={hasUtility ? Number(latestUtility) : 0} />
        </div>
      )}

      {/* Concession Timeline - Compact */}
      {timeline.length > 0 && (
        <div className="insight-section">
          <h4 className="insight-label">Concession Timeline</h4>
          <div className="timeline-compact">
            {timeline.map((item, idx) => {
              // Build the display string for this round
              const parts: string[] = [`R${item.round}`];
              
              // Add vendor offer if present
              if (item.vendorOffer) {
                const vendorParts: string[] = [];
                if (item.vendorOffer.unit_price !== null && item.vendorOffer.unit_price !== undefined) {
                  vendorParts.push(`$${item.vendorOffer.unit_price}`);
                }
                if (item.vendorOffer.payment_terms) {
                  vendorParts.push(item.vendorOffer.payment_terms);
                }
                if (vendorParts.length > 0) {
                  parts.push(`Vendor: ${vendorParts.join(' / ')}`);
                }
              }
              
              // Add Accordo decision
              if (item.decision) {
                parts.push(item.decision.action);
                
                if (item.accordoOffer) {
                  const offerParts: string[] = [];
                  if (item.accordoOffer.unit_price !== null && item.accordoOffer.unit_price !== undefined) {
                    offerParts.push(`$${item.accordoOffer.unit_price}`);
                  }
                  if (item.accordoOffer.payment_terms) {
                    offerParts.push(item.accordoOffer.payment_terms);
                  }
                  if (offerParts.length > 0) {
                    parts.push(offerParts.join(' / '));
                  }
                } else if (item.decision.action === "ASK_CLARIFY") {
                  parts.push("missing terms");
                }
              }
              
              return (
                <div key={idx} className="timeline-row">
                  <span className="timeline-round-compact">{parts.join(' • ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
