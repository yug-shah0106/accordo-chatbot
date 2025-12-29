import { useState, useEffect } from "react";
import { conversationApi } from "../../api/client";
import DecisionBadge from "../chat/DecisionBadge";
import "./ExplainDrawer.css";

interface ExplainDrawerProps {
  dealId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExplainDrawer({ dealId, isOpen, onClose }: ExplainDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [explain, setExplain] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && dealId) {
      loadExplain();
    }
  }, [isOpen, dealId]);

  const loadExplain = async () => {
    if (!dealId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await conversationApi.getExplain(dealId);
      setExplain(data);
    } catch (err: any) {
      console.error("Failed to load explainability:", err);
      setError(err.response?.data?.error || "Failed to load explanation");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="explain-drawer-overlay" onClick={onClose}>
      <div className="explain-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="explain-drawer-header">
          <h3>Why We Did This</h3>
          <button className="explain-drawer-close" onClick={onClose}>×</button>
        </div>
        
        <div className="explain-drawer-content">
          {loading && (
            <div className="explain-drawer-loading">Loading explanation...</div>
          )}
          
          {error && (
            <div className="explain-drawer-error">{error}</div>
          )}
          
          {!loading && !error && explain && (
            <>
              {/* Extracted Offer */}
              <div className="explain-section">
                <h4>Extracted Offer</h4>
                <div className="explain-info-row">
                  <span>Unit Price:</span>
                  <span>{explain.vendorOffer.unit_price !== null ? `$${explain.vendorOffer.unit_price}` : "—"}</span>
                </div>
                <div className="explain-info-row">
                  <span>Payment Terms:</span>
                  <span>{explain.vendorOffer.payment_terms ?? "—"}</span>
                </div>
              </div>

              {/* Deal Score */}
              <div className="explain-section">
                <h4>Deal Score</h4>
                <div className="explain-score">
                  <div className="explain-score-value">
                    {explain.utilities.total !== null ? explain.utilities.total.toFixed(2) : "—"}
                  </div>
                  <div className="explain-score-breakdown">
                    <div>Price: {explain.utilities.priceUtility !== null ? explain.utilities.priceUtility.toFixed(2) : "—"} × {explain.configSnapshot.weights.price.toFixed(2)} = {explain.utilities.weightedPrice !== null ? explain.utilities.weightedPrice.toFixed(2) : "—"}</div>
                    <div>Terms: {explain.utilities.termsUtility !== null ? explain.utilities.termsUtility.toFixed(2) : "—"} × {explain.configSnapshot.weights.terms.toFixed(2)} = {explain.utilities.weightedTerms !== null ? explain.utilities.weightedTerms.toFixed(2) : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Decision */}
              <div className="explain-section">
                <h4>Decision</h4>
                <div className="explain-decision-badge">
                  <DecisionBadge action={explain.decision.action} />
                </div>
                {explain.reasons && explain.reasons.length > 0 && (
                  <ul className="explain-reasons">
                    {explain.reasons.map((reason: string, idx: number) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Counter Offer */}
              {explain.counterOffer && (
                <div className="explain-section">
                  <h4>Counter Offer</h4>
                  <div className="explain-info-row">
                    <span>Unit Price:</span>
                    <span>{explain.counterOffer.unit_price !== null ? `$${explain.counterOffer.unit_price}` : "—"}</span>
                  </div>
                  <div className="explain-info-row">
                    <span>Payment Terms:</span>
                    <span>{explain.counterOffer.payment_terms ?? "—"}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

