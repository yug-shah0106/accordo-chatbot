import type { Message } from "../../api/client";
import "./ConversationMessageBubble.css";

interface ConversationMessageBubbleProps {
  message: Message;
}

export default function ConversationMessageBubble({ message }: ConversationMessageBubbleProps) {
  const isVendor = message.role === "VENDOR";
  const displayRole = isVendor ? "Vendor" : "Procurement Manager";

  return (
    <div className={`conversation-message-bubble ${isVendor ? "vendor" : "accordo"}`}>
      <div className="conversation-message-header">
        <span className="conversation-message-role">{displayRole}</span>
        <span className="conversation-message-time">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="conversation-message-content">
        {message.content}
      </div>
    </div>
  );
}

