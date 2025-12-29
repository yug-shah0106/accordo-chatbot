import { useState } from "react";
import type { Message } from "../../api/client";
import DecisionChips from "./DecisionChips";
import OfferCard from "./OfferCard";
import "./MessageBubble.css";

interface MessageBubbleProps {
  message: Message;
  round?: number;
  isGrouped?: boolean;
}

export default function MessageBubble({ message, round, isGrouped = false }: MessageBubbleProps) {
  const [showFull, setShowFull] = useState(false);
  const isVendor = message.role === "VENDOR";
  const isAccordo = message.role === "ACCORDO";
  const decision = message.engine_decision;

  // Show first 3 lines, then "Show more" if longer
  const contentLines = (message.content || '').split('\n');
  const shouldTruncate = contentLines.length > 3;
  const displayContent = shouldTruncate && !showFull
    ? contentLines.slice(0, 3).join('\n')
    : message.content;

  // Always show content for Accordo messages - if empty, show at least decision summary
  const hasContent = message.content && message.content.trim().length > 0;
  const shouldShowContent = hasContent || isVendor; // Always show for vendor, or if Accordo has content

  return (
    <div className={`message-bubble-wrapper ${isVendor ? "vendor" : "accordo"} ${isGrouped ? "grouped" : ""}`}>
      <div className={`message-bubble ${isVendor ? "vendor" : "accordo"}`}>
        <div className="message-header">
          <span className="message-role">{isVendor ? "Vendor" : "Procurement Manager"}</span>
          <span className="message-time">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {shouldShowContent && (
          <div className="message-content">
            {displayContent || (isAccordo && decision ? `${decision.action === "COUNTER" ? "Countering" : decision.action === "ACCEPT" ? "Accepting" : decision.action}` : "")}
            {shouldTruncate && (
              <button
                onClick={() => setShowFull(!showFull)}
                className="show-more-btn"
              >
                {showFull ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
        {isAccordo && decision && (
          <div className="message-metadata">
            {shouldShowContent && <div className="message-metadata-divider" />}
            <DecisionChips decision={decision} round={round} />
            {decision.action === "COUNTER" && decision.counterOffer && (
              <OfferCard offer={decision.counterOffer} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
