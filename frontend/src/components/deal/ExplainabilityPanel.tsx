import type { Message, Explainability } from "../../api/client";
import DecisionBadge from "../chat/DecisionBadge";
import "./ExplainabilityPanel.css";

interface ExplainabilityPanelProps {
  messages: Message[];
}

export default function ExplainabilityPanel({ messages }: ExplainabilityPanelProps) {
  // Get latest ACCORDO message with explainability
  const latestAccordo = [...messages].reverse().find((m) => m.role === "ACCORDO");
  const explain: Explainability | null = latestAccordo?.explainability_json ?? null;

  if (!explain) {
    return (
      <div className="explainability-panel">
        <h3 className="explainability-title">Why We Did This</h3>
        <div className="explainability-empty">
          <p>Send a vendor message to see reasoning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="explainability-panel">
      <h3 className="explainability-title">Why We Did This</h3>
      
      {/* Latest Offer Card */}
      <OfferCard offer={explain.vendorOffer} />
      
      {/* Utility Breakdown Card */}
      <UtilityBreakdownCard 
        utilities={explain.utilities}
        thresholds={explain.configSnapshot.thresholds}
        weights={explain.configSnapshot.weights}
      />
      
      {/* Decision Card */}
      <DecisionCard 
        decision={explain.decision}
        action={explain.decision.action}
      />
    </div>
  );
}

// OfferCard Component
function OfferCard({ offer }: { offer: Explainability["vendorOffer"] }) {
  return (
    <div className="explainability-card">
      <h4 className="explainability-card-title">Latest Offer</h4>
      <div className="explainability-info-row">
        <span className="explainability-label">Unit Price:</span>
        <span className="explainability-value">
          {offer.unit_price !== null ? `$${offer.unit_price}` : "—"}
        </span>
      </div>
      <div className="explainability-info-row">
        <span className="explainability-label">Payment Terms:</span>
        <span className="explainability-value">
          {offer.payment_terms ?? "—"}
        </span>
      </div>
    </div>
  );
}

// UtilityBreakdownCard Component
function UtilityBreakdownCard({ 
  utilities, 
  thresholds,
  weights
}: { 
  utilities: Explainability["utilities"];
  thresholds: Explainability["configSnapshot"]["thresholds"];
  weights: Explainability["configSnapshot"]["weights"];
}) {
  const total = utilities.total ?? 0;
  const accept = thresholds.accept;
  const priceUtil = utilities.priceUtility;
  const termsUtil = utilities.termsUtility;
  const weightedPrice = utilities.weightedPrice;
  const weightedTerms = utilities.weightedTerms;
  const wP = weights.price;
  const wT = weights.terms;

  // Check if price utility is available (not null and not undefined)
  const hasPriceUtility = priceUtil !== null && priceUtil !== undefined;
  const hasWeightedPrice = weightedPrice !== null && weightedPrice !== undefined;
  const hasTermsUtility = termsUtil !== null && termsUtil !== undefined;
  const hasWeightedTerms = weightedTerms !== null && weightedTerms !== undefined;

  return (
    <div className="explainability-card">
      <h4 className="explainability-card-title">Deal Score Breakdown</h4>
      <p className="explainability-hint">Higher is better for us (0–1)</p>
      
      {/* Progress bar with threshold marker */}
      <div className="utility-progress-container">
        <div className="utility-progress-bar">
          <div 
            className="utility-progress-fill" 
            style={{ width: `${total * 100}%` }}
          />
          {accept > 0 && (
            <div 
              className="utility-progress-marker" 
              style={{ left: `${accept * 100}%` }}
              title={`Accept threshold: ${accept.toFixed(2)}`}
            />
          )}
        </div>
        <div className="utility-progress-labels">
          <span>0</span>
          <span>1</span>
        </div>
      </div>

      {/* Breakdown details */}
      <div className="utility-breakdown">
        <div className="utility-breakdown-row">
          <span className="utility-breakdown-label">Price:</span>
          <span className="utility-breakdown-value">
            {hasPriceUtility && hasWeightedPrice && typeof priceUtil === 'number' && typeof weightedPrice === 'number'
              ? `${priceUtil.toFixed(2)} × ${wP.toFixed(2)} = ${weightedPrice.toFixed(2)}` 
              : "—"}
          </span>
        </div>
        <div className="utility-breakdown-row">
          <span className="utility-breakdown-label">Terms:</span>
          <span className="utility-breakdown-value">
            {hasTermsUtility && hasWeightedTerms && typeof termsUtil === 'number' && typeof weightedTerms === 'number'
              ? `${termsUtil.toFixed(2)} × ${wT.toFixed(2)} = ${weightedTerms.toFixed(2)}` 
              : "—"}
          </span>
        </div>
        <div className="utility-breakdown-row utility-breakdown-total">
          <span className="utility-breakdown-label">Total Deal Score:</span>
          <span className="utility-breakdown-value">
            {utilities.total !== null && utilities.total !== undefined && typeof utilities.total === 'number'
              ? total.toFixed(2) 
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

// DecisionCard Component
function DecisionCard({ 
  decision,
  action 
}: { 
  decision: Explainability["decision"];
  action: string;
}) {
  return (
    <div className="explainability-card">
      <h4 className="explainability-card-title">Decision & Reasoning</h4>
      
      {/* Action Badge */}
      <div className="decision-badge-container">
        <DecisionBadge action={action} />
      </div>
      
      {/* Reasons */}
      {decision.reasons && decision.reasons.length > 0 && (
        <div className="decision-reasons">
          <ul className="decision-reasons-list">
            {decision.reasons.slice(0, 3).map((reason, idx) => (
              <li key={idx} className="decision-reason-item">{reason}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Counter Offer */}
      {decision.counterOffer && (
        <div className="counter-offer-card">
          <div className="counter-offer-label">Counter Offer:</div>
          <div className="counter-offer-details">
            <div className="counter-offer-row">
              <span>Unit Price:</span>
              <span className="counter-offer-value">
                {decision.counterOffer.unit_price !== null ? `$${decision.counterOffer.unit_price}` : "—"}
              </span>
            </div>
            <div className="counter-offer-row">
              <span>Payment Terms:</span>
              <span className="counter-offer-value">
                {decision.counterOffer.payment_terms ?? "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

