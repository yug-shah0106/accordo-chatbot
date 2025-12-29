import type { Deal, Message } from "../../api/client";
import "./OutcomeBanner.css";

interface OutcomeBannerProps {
  deal: Deal;
  messages: Message[];
}

export default function OutcomeBanner({ deal, messages }: OutcomeBannerProps) {
  const isFinal = deal.status !== "NEGOTIATING";
  if (!isFinal) return null;

  // Special handling for ESCALATED
  if (deal.status === "ESCALATED") {
    return (
      <div className="outcome-banner outcome-escalated">
        <div className="outcome-content">
          <div className="outcome-status">
            <span className="outcome-title">Escalated — requires human review</span>
          </div>
          <div className="outcome-escalated-reason">
            {deal.round >= 6 ? "Max rounds reached" : "Below walkaway threshold or missing information"}
          </div>
        </div>
      </div>
    );
  }

  const lastVendorMessage = [...messages].reverse().find((m) => m.role === "VENDOR");
  const finalOffer = deal.latest_offer_json || lastVendorMessage?.extracted_offer;

  const getStatusClass = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "ACCEPTED") return "outcome-accepted";
    if (normalized === "WALKED_AWAY") return "outcome-walked-away";
    if (normalized === "ESCALATED") return "outcome-escalated";
    return "outcome-default";
  };

  const getStatusText = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "ACCEPTED") return "Deal Accepted";
    if (normalized === "WALKED_AWAY") return "Deal Walked Away";
    if (normalized === "ESCALATED") return "Deal Escalated";
    return "Deal Closed";
  };

  return (
    <div className={`outcome-banner ${getStatusClass(deal.status)}`}>
      <div className="outcome-content">
        <div className="outcome-status">
          <span className="outcome-title">{getStatusText(deal.status)}</span>
        </div>
        {deal.status === "ACCEPTED" && finalOffer && (
          <div className="outcome-terms">
            <span className="outcome-term">
              {finalOffer.unit_price !== null && finalOffer.unit_price !== undefined && (
                <>${finalOffer.unit_price}</>
              )}
            </span>
            {finalOffer.payment_terms && (
              <span className="outcome-term">{finalOffer.payment_terms}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

