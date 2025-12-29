import "./DecisionBadge.css";

interface DecisionBadgeProps {
  action: string;
}

export default function DecisionBadge({ action }: DecisionBadgeProps) {
  const normalizedAction = action.toUpperCase();
  
  const getActionClass = () => {
    if (normalizedAction === "ACCEPT") return "decision-accept";
    if (normalizedAction === "COUNTER") return "decision-counter";
    if (normalizedAction === "WALK_AWAY") return "decision-walk-away";
    if (normalizedAction === "ESCALATE") return "decision-escalate";
    if (normalizedAction === "ASK_CLARIFY") return "decision-ask-clarify";
    return "decision-default";
  };

  const formatAction = () => {
    return normalizedAction.replace(/_/g, " ");
  };

  return (
    <span className={`decision-badge ${getActionClass()}`}>
      {formatAction()}
    </span>
  );
}

