import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useConversation } from "../hooks/useConversation";
import ConversationMessageBubble from "../components/conversation/ConversationMessageBubble";
import ExplainDrawer from "../components/conversation/ExplainDrawer";
import Composer from "../components/chat/Composer";
import "./ConversationRoom.css";

export default function ConversationRoom() {
  const { dealId } = useParams<{ dealId: string }>();
  const [inputText, setInputText] = useState("");
  const [showExplain, setShowExplain] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    deal,
    messages,
    loading,
    sending,
    revealAvailable,
    canSend,
    canReset,
    sendMessage,
    reset,
  } = useConversation(dealId);
  
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim() || !canSend) return;

    try {
      await sendMessage(messageText);
      setInputText("");
    } catch (error) {
      alert("Failed to send message");
    }
  };

  const handleReset = async () => {
    if (!canReset || resetLoading) return;
    
    if (!confirm("Are you sure you want to reset this conversation? This will delete all messages.")) {
      return;
    }

    try {
      setResetLoading(true);
      await reset();
    } catch (error) {
      alert("Failed to reset conversation");
    } finally {
      setResetLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEGOTIATING":
        return "status-negotiating";
      case "ACCEPTED":
        return "status-accepted";
      case "ESCALATED":
        return "status-escalated";
      case "WALKED_AWAY":
        return "status-walked-away";
      default:
        return "status-default";
    }
  };

  if (loading) {
    return (
      <div className="conversation-room-loading">
        <div>Loading conversation...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="conversation-room-error">
        <div>Deal not found</div>
      </div>
    );
  }

  return (
    <div className="conversation-room">
      {/* Header */}
      <div className="conversation-header">
        <div className="conversation-header-left">
          <h1 className="conversation-title">{deal.title}</h1>
          <span className={`conversation-status ${getStatusColor(deal.status)}`}>
            {deal.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="conversation-header-actions">
          {revealAvailable && (
            <button
              className="explain-button"
              onClick={() => setShowExplain(true)}
            >
              Explain / Why this?
            </button>
          )}
          <button
            className="reset-button"
            onClick={handleReset}
            disabled={resetLoading || !canReset}
          >
            {resetLoading ? "Resetting..." : "Reset"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="conversation-messages">
        {messages.length === 0 ? (
          <div className="conversation-empty">
            <p>No messages yet. Send a message to start the conversation.</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ConversationMessageBubble key={message.id} message={message} />
            ))}
            {sending && (
              <div className="conversation-message-bubble accordo processing">
                <div className="conversation-message-content">
                  Procurement Manager is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div className="conversation-composer">
        <Composer
          onSend={handleSend}
          inputText={inputText}
          onInputChange={setInputText}
          sending={sending}
          dealStatus={deal.status}
          canSend={canSend}
        />
      </div>

      {/* Explain Drawer */}
      <ExplainDrawer
        dealId={dealId!}
        isOpen={showExplain}
        onClose={() => setShowExplain(false)}
      />
    </div>
  );
}

