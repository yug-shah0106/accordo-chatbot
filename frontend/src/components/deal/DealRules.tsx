import { useState } from "react";
import type { NegotiationConfig } from "../../api/client";
import "./DealRules.css";

interface DealRulesProps {
  config?: NegotiationConfig | null;
}

export default function DealRules({ config }: DealRulesProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fallback to default values if config not loaded
  const anchor = config?.parameters?.unit_price?.anchor ?? 75;
  const target = config?.parameters?.unit_price?.target ?? 85;
  const maxAcceptable = config?.parameters?.unit_price?.max_acceptable ?? 100;
  const options = config?.parameters?.payment_terms?.options;
  const preferredTerms = options && options.length > 0 ? options[options.length - 1] : "Net 90";

  return (
    <div className="deal-rules">
      <button
        className="deal-rules-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="deal-rules-title">Deal Rules</h4>
        <span className="deal-rules-toggle">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isOpen && (
        <div className="deal-rules-content">
          <div className="rule-row">
            <span className="rule-label">Anchor</span>
            <span className="rule-value">${anchor}</span>
          </div>
          <div className="rule-row">
            <span className="rule-label">Target</span>
            <span className="rule-value">${target}</span>
          </div>
          <div className="rule-row">
            <span className="rule-label">Max Acceptable</span>
            <span className="rule-value">${maxAcceptable}</span>
          </div>
          <div className="rule-row">
            <span className="rule-label">Preferred Terms</span>
            <span className="rule-value">{preferredTerms}</span>
          </div>
        </div>
      )}
    </div>
  );
}

