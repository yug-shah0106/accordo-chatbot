import { useEffect, useRef } from "react";
import type { Message } from "../../api/client";
import MessageBubble from "./MessageBubble";
import "./ChatTranscript.css";

interface ChatTranscriptProps {
  messages: Message[];
  isProcessing?: boolean;
  processingType?: "analyzing" | "vendor-typing";
}

export default function ChatTranscript({ messages, isProcessing = false, processingType = "analyzing" }: ChatTranscriptProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Calculate round number for each Accordo message
  const getRoundForMessage = (message: Message, index: number) => {
    if (message.role === "ACCORDO" && message.engine_decision) {
      const previousAccordo = messages.slice(0, index).filter(
        (m) => m.role === "ACCORDO" && m.engine_decision
      );
      return previousAccordo.length + 1;
    }
    return undefined;
  };

  // Group consecutive messages from same role
  const groupMessages = (msgs: Message[]) => {
    if (msgs.length === 0) return [];
    
    const grouped: Array<{ messages: Message[]; role: string }> = [];
    let currentGroup: Message[] = [msgs[0]];
    let currentRole = msgs[0].role;

    for (let i = 1; i < msgs.length; i++) {
      if (msgs[i].role === currentRole) {
        currentGroup.push(msgs[i]);
      } else {
        grouped.push({ messages: currentGroup, role: currentRole });
        currentGroup = [msgs[i]];
        currentRole = msgs[i].role;
      }
    }
    grouped.push({ messages: currentGroup, role: currentRole });
    return grouped;
  };

  const groupedMessages = groupMessages(messages);

  // Add round dividers
  const messagesWithDividers: Array<{ type: 'message' | 'divider'; message?: Message; round?: number; isGrouped?: boolean }> = [];
  let lastRound: number | undefined = undefined;

  groupedMessages.forEach((group) => {
    group.messages.forEach((message, msgIdx) => {
      const index = messages.indexOf(message);
      const round = getRoundForMessage(message, index);
      const isGrouped = msgIdx > 0;

      // Add divider if round changed and this is an Accordo message
      if (round !== undefined && round !== lastRound && lastRound !== undefined) {
        messagesWithDividers.push({ type: 'divider', round });
      }

      messagesWithDividers.push({ type: 'message', message, round, isGrouped });
      if (round !== undefined) {
        lastRound = round;
      }
    });
  });

  return (
    <div className="chat-transcript">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <p>No messages yet. Send a message to start the negotiation.</p>
        </div>
      ) : (
        <div className="chat-messages">
          {messagesWithDividers.map((item) => {
            if (item.type === 'divider') {
              return (
                <div key={`divider-${item.round}`} className="round-divider">
                  <span className="round-divider-text">Round {item.round}</span>
                </div>
              );
            }
            return (
              <MessageBubble
                key={item.message!.id}
                message={item.message!}
                round={item.round}
                isGrouped={item.isGrouped}
              />
            );
          })}
          {isProcessing && (
            <div className={`message-bubble-wrapper ${processingType === "vendor-typing" ? "vendor" : "accordo"}`}>
              <div className={`message-bubble ${processingType === "vendor-typing" ? "vendor" : "accordo"} processing`}>
                <div className="processing-indicator">
                  <span>
                    {processingType === "vendor-typing" ? "Vendor typing..." : "Accordo is analyzing..."}
                  </span>
                  <span className="processing-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
