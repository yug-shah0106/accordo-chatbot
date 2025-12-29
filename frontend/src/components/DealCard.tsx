import { useNavigate } from "react-router-dom";
import type { Deal } from "../api/client";
import "./DealCard.css";

interface DealCardProps {
  deal: Deal;
}

export default function DealCard({ deal }: DealCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/deals/${deal.id}`);
  };

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadgeClass = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "NEGOTIATING") return "status-negotiating";
    if (normalized === "ACCEPTED") return "status-accepted";
    if (normalized === "ESCALATED") return "status-escalated";
    if (normalized === "WALKED_AWAY") return "status-walked-away";
    return "status-default";
  };

  return (
    <div className="deal-card" onClick={handleClick}>
      <div className="deal-card-content">
        <div className="deal-card-header">
          <div className="deal-title-section">
            <h3 className="deal-title">{deal.title}</h3>
            {deal.counterparty && (
              <p className="deal-counterparty">with {deal.counterparty}</p>
            )}
          </div>
          <span className={`status-badge ${getStatusBadgeClass(deal.status)}`}>
            {deal.status}
          </span>
        </div>
        <div className="deal-card-footer">
          <div className="deal-round">
            Round {deal.round}
          </div>
          <div className="deal-activity">
            {formatLastActivity(deal.updated_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

