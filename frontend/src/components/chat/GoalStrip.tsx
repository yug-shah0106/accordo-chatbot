import type { NegotiationConfig } from "../../api/client";
import "./GoalStrip.css";

interface GoalStripProps {
  config?: NegotiationConfig | null;
}

export default function GoalStrip({ config }: GoalStripProps) {
  // Fallback to default values if config not loaded
  const targetPrice = config?.parameters?.unit_price?.target ?? 85;
  const maxPrice = config?.parameters?.unit_price?.max_acceptable ?? 100;
  const options = config?.parameters?.payment_terms?.options;
  const preferredTerms = options && options.length > 0 ? options[options.length - 1] : "Net 90";

  return (
    <div className="goal-strip">
      <span className="goal-label">Goal:</span>
      <span className="goal-text">
        Reach ≤ ${targetPrice} with {preferredTerms} (max allowed ${maxPrice})
      </span>
    </div>
  );
}

