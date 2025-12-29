import { useState } from "react";
import { useParams } from "react-router-dom";
import { useDealActions } from "../hooks/useDealActions";
import GoalStrip from "../components/chat/GoalStrip";
import OutcomeBanner from "../components/chat/OutcomeBanner";
import ChatTranscript from "../components/chat/ChatTranscript";
import NegotiationInsights from "../components/deal/NegotiationInsights";
import ExplainabilityPanel from "../components/deal/ExplainabilityPanel";
import Composer from "../components/chat/Composer";
import "./NegotiationRoom.css";

export default function NegotiationRoom() {
  const { dealId } = useParams<{ dealId: string }>();
  const [inputText, setInputText] = useState("");

  const {
    deal,
    messages,
    config,
    loading,
    sending,
    autoVendorLoading,
    runDemoLoading,
    resetLoading,
    canSend,
    canRunDemo,
    canAutoVendor,
    sendVendorMessage,
    autoVendor,
    runDemo,
    reset,
  } = useDealActions(dealId);

  const isProcessing = sending || autoVendorLoading || runDemoLoading;
  const processingType = autoVendorLoading ? "vendor-typing" : "analyzing";

  const handleSend = async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim() || !canSend) return;

    try {
      await sendVendorMessage(messageText);
      setInputText("");
    } catch (error) {
      alert("Failed to send message");
    }
  };

  if (loading) {
    return (
      <div className="negotiation-room-loading">
        <div>Loading negotiation room...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="negotiation-room-error">
        <div>Deal not found</div>
      </div>
    );
  }

  return (
    <div className="negotiation-room">
      <div className="negotiation-room-grid">
        {/* Chat Column - Hero */}
        <div className="chat-column">
          <GoalStrip config={config} />
          <OutcomeBanner deal={deal} messages={messages} />
          
          {/* Autopilot Controls */}
          <div className="autopilot-controls">
            <button
              onClick={autoVendor}
              disabled={!canAutoVendor || autoVendorLoading || sending || runDemoLoading}
              className="autopilot-btn autopilot-btn-secondary"
            >
              {autoVendorLoading ? "Generating..." : "Auto Vendor"}
            </button>
            <button
              onClick={runDemo}
              disabled={!canRunDemo || runDemoLoading || sending || autoVendorLoading}
              className="autopilot-btn autopilot-btn-primary"
            >
              {runDemoLoading ? "Running..." : "Run Demo"}
            </button>
            <button
              onClick={reset}
              disabled={resetLoading || sending || autoVendorLoading || runDemoLoading}
              className="autopilot-btn autopilot-btn-destructive"
            >
              {resetLoading ? "Resetting..." : "Reset"}
            </button>
          </div>
          
          <ChatTranscript 
            messages={messages} 
            isProcessing={isProcessing}
            processingType={processingType}
          />
          <Composer
            onSend={handleSend}
            inputText={inputText}
            onInputChange={setInputText}
            sending={sending || autoVendorLoading || runDemoLoading}
            dealStatus={deal?.status}
            canSend={canSend}
          />
        </div>

        {/* Insights Column */}
        <div className="insights-column">
          <ExplainabilityPanel messages={messages} />
          <NegotiationInsights deal={deal} messages={messages} config={config} />
        </div>
      </div>
    </div>
  );
}
