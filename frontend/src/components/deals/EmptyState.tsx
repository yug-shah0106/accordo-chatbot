import { type LucideIcon, SearchX, Briefcase, Archive, Trash2 } from "lucide-react";
import "./EmptyState.css";

type EmptyStateVariant = "no-deals" | "no-results" | "no-archived" | "no-deleted";

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onClearFilters?: () => void;
  hasFilters?: boolean;
}

const VARIANTS: Record<
  EmptyStateVariant,
  { icon: LucideIcon; title: string; message: string }
> = {
  "no-deals": {
    icon: Briefcase,
    title: "No deals yet",
    message: "Create your first deal to get started with negotiations.",
  },
  "no-results": {
    icon: SearchX,
    title: "No deals found",
    message: "No deals match your search or filter criteria.",
  },
  "no-archived": {
    icon: Archive,
    title: "No archived deals",
    message: "Deals you archive will appear here.",
  },
  "no-deleted": {
    icon: Trash2,
    title: "No deleted deals",
    message: "Deals you delete will appear here for recovery.",
  },
};

export default function EmptyState({
  variant,
  onClearFilters,
  hasFilters = false,
}: EmptyStateProps) {
  const { icon: Icon, title, message } = VARIANTS[variant];

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={48} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
      {hasFilters && onClearFilters && (
        <button className="clear-filters-btn" onClick={onClearFilters}>
          Clear filters
        </button>
      )}
    </div>
  );
}
