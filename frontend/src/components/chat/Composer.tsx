import { useState } from "react";
import "./Composer.css";

interface ComposerProps {
  onSend: (text: string) => void;
  inputText: string;
  onInputChange: (text: string) => void;
  sending: boolean;
  dealStatus?: string;
  canSend?: boolean;
}

const SCENARIO_MESSAGES: Record<string, string[]> = {
  HARD: [
    "We can do 95 Net 30",
    "Best I can offer is Net 60",
    "Ok, we can do 93 Net 60",
    "Our final offer is 110 Net 30",
  ],
  SOFT: [
    "We can do 90 Net 60",
    "How about 88 Net 90?",
    "We're willing to go to 85 Net 90",
    "Final offer: 82 Net 90",
  ],
  WALK_AWAY: [
    "We can do 95 Net 30",
    "Best I can offer is Net 60",
    "Ok, we can do 93 Net 60",
    "Our final offer is 110 Net 30 - take it or leave it",
  ],
};

export default function Composer({
  onSend,
  inputText,
  onInputChange,
  sending,
  dealStatus,
  canSend = true,
}: ComposerProps) {
  const [scenario, setScenario] = useState<string>("HARD");
  const scenarioMessages = SCENARIO_MESSAGES[scenario] || SCENARIO_MESSAGES.HARD;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !sending) {
        onSend(inputText);
      }
    }
  };

  return (
    <div className="composer">
      {/* Scenario Chips */}
      <div className="composer-chips">
        <div className="chip-group">
          <span className="chip-label">Scenario:</span>
          {["HARD", "SOFT", "WALK_AWAY"].map((s) => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className={`scenario-chip ${scenario === s ? "active" : ""}`}
              disabled={sending}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="chip-group">
          {scenarioMessages.map((msg, idx) => (
            <button
              key={idx}
              onClick={() => onSend(msg)}
              disabled={sending || !canSend}
              className="quick-chip"
            >
              {msg.substring(0, 25)}
              {msg.length > 25 ? "..." : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Input Row */}
      <div className="composer-input-row">
        <input
          type="text"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            !canSend && dealStatus === "ESCALATED"
              ? "Deal is Escalated. Reset or Resume."
              : !canSend
              ? "Deal is closed"
              : "Type vendor message..."
          }
          disabled={sending || !canSend}
          className="composer-input"
        />
        <button
          onClick={() => onSend(inputText)}
          disabled={sending || !inputText.trim() || !canSend}
          className="composer-send-btn"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

