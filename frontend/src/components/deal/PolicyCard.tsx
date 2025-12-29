import "./PolicyCard.css";

export default function PolicyCard() {
  // Using the config from backend/src/engine/config.ts
  const config = {
    unit_price: {
      anchor: 75,
      target: 85,
      max_acceptable: 100,
    },
    payment_terms: {
      preferred: "Net 90",
      options: ["Net 30", "Net 60", "Net 90"],
    },
    accept_threshold: 0.70,
  };

  return (
    <div className="policy-card">
      <h3 className="policy-card-title">Policy / Guardrails</h3>
      <div className="policy-section">
        <div className="policy-item">
          <span className="policy-label">Anchor:</span>
          <span className="policy-value">${config.unit_price.anchor}</span>
        </div>
        <div className="policy-item">
          <span className="policy-label">Target:</span>
          <span className="policy-value">${config.unit_price.target}</span>
        </div>
        <div className="policy-item">
          <span className="policy-label">Max Acceptable:</span>
          <span className="policy-value">${config.unit_price.max_acceptable}</span>
        </div>
      </div>
      <div className="policy-section">
        <div className="policy-item">
          <span className="policy-label">Preferred Terms:</span>
          <span className="policy-value">{config.payment_terms.preferred}</span>
        </div>
      </div>
      <div className="policy-section">
        <div className="policy-item">
          <span className="policy-label">Accept Threshold:</span>
          <span className="policy-value">{(config.accept_threshold * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="policy-optimization">
        <span className="optimization-label">What we're optimizing:</span>
        <span className="optimization-text">Minimize price + maximize payment terms</span>
      </div>
    </div>
  );
}

