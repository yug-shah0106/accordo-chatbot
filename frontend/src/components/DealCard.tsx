import { useNavigate } from "react-router-dom";
import { Archive, Trash2, RotateCcw } from "lucide-react";
import type { Deal } from "../api/client";
import "./DealCard.css";

type DealCardVariant = "default" | "archived" | "deleted";

interface DealCardProps {
  deal: Deal;
  variant?: DealCardVariant;
  onArchive?: (deal: Deal) => void;
  onUnarchive?: (deal: Deal) => void;
  onDelete?: (deal: Deal) => void;
  onRestore?: (deal: Deal) => void;
  onPermanentDelete?: (deal: Deal) => void;
}

export default function DealCard({
  deal,
  variant = "default",
  onArchive,
  onUnarchive,
  onDelete,
  onRestore,
  onPermanentDelete,
}: DealCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (variant === "deleted") return; // Don't navigate for deleted deals
    navigate(`/deals/${deal.id}`);
  };

  const handleAction = (
    e: React.MouseEvent,
    action: ((deal: Deal) => void) | undefined
  ) => {
    e.stopPropagation();
    if (action) action(deal);
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
    <div
      className={`deal-card ${variant === "deleted" ? "deleted" : ""}`}
      onClick={handleClick}
    >
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
          <div className="deal-round">Round {deal.round}</div>
          <div className="deal-activity">
            {formatLastActivity(deal.updated_at)}
          </div>
        </div>
      </div>

      <div className="deal-card-actions">
        {variant === "default" && (
          <>
            <button
              className="card-action-btn archive"
              onClick={(e) => handleAction(e, onArchive)}
              title="Archive"
            >
              <Archive size={16} />
            </button>
            <button
              className="card-action-btn delete"
              onClick={(e) => handleAction(e, onDelete)}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}

        {variant === "archived" && (
          <>
            <button
              className="card-action-btn unarchive"
              onClick={(e) => handleAction(e, onUnarchive)}
              title="Unarchive"
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="card-action-btn delete"
              onClick={(e) => handleAction(e, onDelete)}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}

        {variant === "deleted" && (
          <>
            <button
              className="card-action-btn restore"
              onClick={(e) => handleAction(e, onRestore)}
              title="Restore"
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="card-action-btn archive"
              onClick={(e) => handleAction(e, onArchive)}
              title="Archive"
            >
              <Archive size={16} />
            </button>
            <button
              className="card-action-btn permanent-delete"
              onClick={(e) => handleAction(e, onPermanentDelete)}
              title="Delete permanently"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
