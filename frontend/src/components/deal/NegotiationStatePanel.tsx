import type { Deal, Message } from "../../api/client";
import UtilityBar from "../UtilityBar";
import "./NegotiationStatePanel.css";

interface NegotiationStatePanelProps {
  deal: Deal;
  messages: Message[];
}

export default function NegotiationStatePanel({ deal, messages }: NegotiationStatePanelProps) {
  // const lastVendorMessage = [...messages].reverse().find((m) => m.role === "VENDOR");
  const lastAccordoMessage = [...messages].reverse().find((m) => m.role === "ACCORDO");
  const lastDecision = lastAccordoMessage?.engine_decision;

  // Build concession timeline
  const accordoMessages = messages.filter((m) => m.role === "ACCORDO" && m.engine_decision);
  const timeline = accordoMessages.map((msg, idx) => ({
    round: idx + 1,
    decision: msg.engine_decision,
    offer: msg.engine_decision?.counterOffer,
  }));

  return (
    <div className="negotiation-state-panel">
      <h3 className="panel-title">Negotiation State</h3>

      {/* Current Vendor Offer */}
      <div className="state-section">
        <h4 className="section-title">Current Vendor Offer</h4>
        {deal.latest_offer_json ? (
          <div className="offer-display">
            {deal.latest_offer_json.unit_price !== null && deal.latest_offer_json.unit_price !== undefined && (
              <div className="offer-row">
                <span className="offer-label">Unit Price:</span>
                <span className="offer-value">${deal.latest_offer_json.unit_price}</span>
              </div>
            )}
            {deal.latest_offer_json.payment_terms && (
              <div className="offer-row">
                <span className="offer-label">Payment Terms:</span>
                <span className="offer-value">{deal.latest_offer_json.payment_terms}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="no-offer">No offer yet</div>
        )}
      </div>

      {/* Current Accordo Counter Offer */}
      {lastDecision?.counterOffer && (
        <div className="state-section">
          <h4 className="section-title">Current Accordo Counter</h4>
          <div className="offer-display">
            {lastDecision.counterOffer.unit_price !== null && lastDecision.counterOffer.unit_price !== undefined && (
              <div className="offer-row">
                <span className="offer-label">Unit Price:</span>
                <span className="offer-value">${lastDecision.counterOffer.unit_price}</span>
              </div>
            )}
            {lastDecision.counterOffer.payment_terms && (
              <div className="offer-row">
                <span className="offer-label">Payment Terms:</span>
                <span className="offer-value">{lastDecision.counterOffer.payment_terms}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Utility Meter */}
      {lastDecision && (
        <div className="state-section">
          <UtilityBar utilityScore={lastDecision.utilityScore || 0} />
        </div>
      )}

      {/* Concession Timeline */}
      {timeline.length > 0 && (
        <div className="state-section">
          <h4 className="section-title">Concession Timeline</h4>
          <div className="timeline">
            {timeline.map((item, idx) => (
              <div key={idx} className="timeline-item">
                <div className="timeline-round">Round {item.round}</div>
                <div className="timeline-action">{item.decision?.action}</div>
                {item.offer && (
                  <div className="timeline-offer">
                    {item.offer.unit_price && <span>${item.offer.unit_price}</span>}
                    {item.offer.payment_terms && <span>{item.offer.payment_terms}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

