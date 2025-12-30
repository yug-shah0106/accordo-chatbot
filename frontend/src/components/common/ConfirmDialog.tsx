import { AlertTriangle, Trash2, RotateCcw } from "lucide-react";
import "./ConfirmDialog.css";

type DialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  icon?: "delete" | "restore" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS = {
  delete: Trash2,
  restore: RotateCcw,
  warning: AlertTriangle,
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  icon = "warning",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const Icon = ICONS[icon];

  return (
    <>
      <div className="dialog-overlay" onClick={onCancel} />
      <div className={`confirm-dialog ${variant}`}>
        <div className="dialog-icon">
          <Icon size={24} />
        </div>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="dialog-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`dialog-btn confirm ${variant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
