import "./UtilityBar.css";

interface UtilityBarProps {
  utilityScore: number;
  threshold?: number;
}

export default function UtilityBar({ utilityScore, threshold = 0.7 }: UtilityBarProps) {
  const percentage = Math.min(100, Math.max(0, utilityScore * 100));

  const getColor = () => {
    if (utilityScore >= 0.7) return "var(--okText)";
    if (utilityScore >= 0.45) return "var(--warnText)";
    return "var(--dangerText)";
  };

  return (
    <div className="utility-bar-container">
      <div className="utility-bar-header">
        <span className="utility-label">Utility Score</span>
        <span className="utility-value">{(utilityScore * 100).toFixed(0)}%</span>
      </div>
      <div className="utility-bar-wrapper">
        <div
          className="utility-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: getColor(),
          }}
        />
        <div
          className="utility-bar-threshold"
          style={{ left: `${threshold * 100}%` }}
        />
      </div>
      <div className="utility-bar-footer">
        <span className="utility-threshold-label">Accept Threshold: {(threshold * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
