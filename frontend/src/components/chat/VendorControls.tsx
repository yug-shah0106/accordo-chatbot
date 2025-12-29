import { useState } from "react";
import "./VendorControls.css";

interface VendorControlsProps {
  onSend: (text: string) => void;
  onAutoVendor: () => void;
  onRunDemo?: () => void;
  onReset?: () => void;
  inputText: string;
  onInputChange: (text: string) => void;
  sending: boolean;
  autoVendorLoading: boolean;
  dealStatus?: string;
}

type Scenario = "HARD" | "SOFT" | "WALK_AWAY";

const SCENARIO_MESSAGES: Record<Scenario, string[]> = {
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

export default function VendorControls({
  onSend,
  onAutoVendor,
  onRunDemo,
  onReset,
  inputText,
  onInputChange,
  sending,
  autoVendorLoading,
  dealStatus,
}: VendorControlsProps) {
  const [scenario, setScenario] = useState<Scenario>("HARD");
  const [runDemoLoading, setRunDemoLoading] = useState(false);

  const handleScenarioClick = (message: string) => {
    if (!sending) {
      onSend(message);
    }
  };

  const handleRunDemo = async () => {
    if (!onRunDemo || runDemoLoading || sending || autoVendorLoading) return;
    setRunDemoLoading(true);
    try {
      await onRunDemo();
    } finally {
      setRunDemoLoading(false);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  const scenarioMessages = SCENARIO_MESSAGES[scenario];
  const isNegotiating = dealStatus === "NEGOTIATING";
  const canRunDemo = isNegotiating && !sending && !autoVendorLoading && !runDemoLoading;

  return (
    <div className="vendor-controls">
      {/* Demo Controls Bar */}
      <div className="demo-controls-bar">
        <div className="demo-controls-left">
          <button
            onClick={onAutoVendor}
            disabled={autoVendorLoading || sending}
            className="demo-btn auto-vendor-btn"
          >
            {autoVendorLoading ? "Generating..." : "Auto Vendor Reply"}
          </button>
          <div className="scenario-dropdown-wrapper">
            <label htmlFor="scenario-select" className="scenario-label">Scenario:</label>
            <select
              id="scenario-select"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
              className="scenario-select"
              disabled={sending || autoVendorLoading}
            >
              <option value="HARD">Hard</option>
              <option value="SOFT">Soft</option>
              <option value="WALK_AWAY">Walk-away</option>
            </select>
          </div>
        </div>
        <div className="demo-controls-right">
          {onRunDemo && (
            <button
              onClick={handleRunDemo}
              disabled={!canRunDemo}
              className="demo-btn run-demo-btn"
            >
              {runDemoLoading ? "Running..." : "Run Full Demo"}
            </button>
          )}
          {onReset && (
            <button
              onClick={handleReset}
              disabled={sending || autoVendorLoading}
              className="demo-btn reset-btn"
            >
              Reset Deal
            </button>
          )}
        </div>
      </div>

      {/* Preset Messages */}
      <div className="preset-section">
        <div className="preset-header">
          <span className="preset-label">Quick Messages ({scenario}):</span>
        </div>
        <div className="preset-buttons">
          {scenarioMessages.map((message, idx) => (
            <button
              key={idx}
              onClick={() => handleScenarioClick(message)}
              disabled={sending}
              className="preset-btn"
            >
              {message.substring(0, 30)}
              {message.length > 30 ? "..." : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Input Row */}
      <div className="input-row">
        <input
          type="text"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (inputText.trim() && !sending) {
                onSend(inputText);
              }
            }
          }}
          placeholder="Type vendor message..."
          disabled={sending}
          className="vendor-input"
        />
        <button
          onClick={() => onSend(inputText)}
          disabled={sending || !inputText.trim()}
          className="send-btn"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
