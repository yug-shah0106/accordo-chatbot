import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { convoStart, convoSendMessage, convoExplainLast } from "../api/convoApi";

type Msg = { role: "VENDOR" | "ACCORDO"; content: string; createdAt?: string };

export default function ConversationDealPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [explainOpen, setExplainOpen] = useState(false);
  const [explain, setExplain] = useState<any>(null);
  const [deal, setDeal] = useState<any>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!dealId || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const data = await convoStart(dealId);
      setDeal(data.deal);
      setMessages(data.messages ?? []);
    })();
  }, [dealId]);

  const canSend = useMemo(() => deal?.status === "NEGOTIATING", [deal]);

  async function send() {
    if (!input.trim() || !dealId) return;
    const text = input.trim();
    setInput("");

    // Optimistic add vendor message
    setMessages((m) => [...m, { role: "VENDOR", content: text }]);

    const data = await convoSendMessage(dealId, text);
    if (data.error) {
      // show error message
      setMessages((m) => [...m, { role: "ACCORDO", content: data.error }]);
      return;
    }
    setDeal(data.deal);
    setMessages(data.messages ?? []);
  }

  async function openExplain() {
    if (!dealId) return;
    const data = await convoExplainLast(dealId);
    setExplain(data.explainability);
    setExplainOpen(true);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "100vh", background: "#0B0F17", color: "rgba(255,255,255,0.92)" }}>
      <div style={{ padding: 16, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{deal?.title ?? "Conversation"}</div>
            <div style={{ opacity: 0.7, fontSize: 12, color: "rgba(255,255,255,0.60)" }}>Status: {deal?.status ?? "—"}</div>
          </div>
          <button 
            onClick={openExplain} 
            style={{ 
              padding: "8px 10px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer"
            }}
          >
            Explain last move
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", paddingTop: 16 }}>
          {messages.map((m, idx) => (
            <Bubble key={idx} role={m.role} text={m.content} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            disabled={!canSend}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canSend ? "Type as vendor…" : "Deal is closed"}
            style={{ 
              flex: 1, 
              padding: 12, 
              borderRadius: 10, 
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              outline: "none"
            }}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button 
            onClick={send} 
            disabled={!canSend} 
            style={{ 
              padding: "12px 14px",
              background: canSend ? "#7C5CFF" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 10,
              color: "rgba(255,255,255,0.92)",
              cursor: canSend ? "pointer" : "not-allowed",
              opacity: canSend ? 1 : 0.5
            }}
          >
            Send
          </button>
        </div>
      </div>

      <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Optional Explainability</div>
        <div style={{ opacity: 0.7, fontSize: 13, color: "rgba(255,255,255,0.60)" }}>
          Hidden by default. Use "Explain last move" during internal review.
        </div>

        {explainOpen && explain && (
          <pre style={{ 
            marginTop: 12, 
            whiteSpace: "pre-wrap", 
            fontSize: 12,
            color: "rgba(255,255,255,0.92)",
            background: "rgba(255,255,255,0.04)",
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            {JSON.stringify(explain, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: "VENDOR" | "ACCORDO"; text: string }) {
  const isAccordo = role === "ACCORDO";
  // Use a person name for Accordo to remove "bot vibe"
  const accordoName = "Riya (Procurement)";
  
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: isAccordo ? "flex-start" : "flex-end", 
      marginBottom: 12,
      alignItems: "flex-start"
    }}>
      <div
        style={{
          maxWidth: 520,
          padding: "12px 14px",
          borderRadius: 14,
          border: isAccordo 
            ? "1px solid rgba(255,255,255,0.08)" 
            : "1px solid rgba(124, 92, 255, 0.2)",
          background: isAccordo 
            ? "rgba(255,255,255,0.06)" 
            : "rgba(124, 92, 255, 0.08)",
          color: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          lineHeight: 1.4,
        }}
      >
        <div style={{ 
          fontSize: 11, 
          opacity: 0.7, 
          marginBottom: 6, 
          color: isAccordo ? "rgba(255,255,255,0.60)" : "rgba(124, 92, 255, 0.8)",
          fontWeight: 500
        }}>
          {isAccordo ? accordoName : "Vendor"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </div>
  );
}

