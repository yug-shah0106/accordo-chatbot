import "./DecisionChips.css";

interface DecisionChipsProps {
  decision: any;
  round?: number;
}

export default function DecisionChips({ decision, round }: DecisionChipsProps) {
  if (!decision) return null;

  const getActionClass = (action: string) => {
    const normalized = action.toUpperCase();
    if (normalized === "ACCEPT") return "chip-accept";
    if (normalized === "COUNTER") return "chip-counter";
    if (normalized === "WALK_AWAY") return "chip-walk-away";
    if (normalized === "ESCALATE") return "chip-escalate";
    return "chip-default";
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, " ");
  };

  // Format utility as percentage for consistency
  const utilityPercent = decision.utilityScore !== null && decision.utilityScore !== undefined
    ? (decision.utilityScore * 100).toFixed(0)
    : null;

  return (
    <div className="decision-chips">
      <span className={`decision-chip ${getActionClass(decision.action)}`}>
        {formatAction(decision.action)}
      </span>
      {utilityPercent !== null && (
        <span className="decision-chip chip-utility">
          UTILITY {utilityPercent}%
        </span>
      )}
      {round !== undefined && (
        <span className="decision-chip chip-round">
          ROUND {round}
        </span>
      )}
    </div>
  );
}
