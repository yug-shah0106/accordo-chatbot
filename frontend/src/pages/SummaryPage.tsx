import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dealsApi } from "../api/client";
import type { Deal, Message } from "../api/client";
import "./SummaryPage.css";

export default function Summary() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    loadDeal();
  }, [dealId]);

  const loadDeal = async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const data = await dealsApi.get(dealId);
      setDeal(data.deal);
      setMessages(data.messages);
    } catch (error) {
      console.error("Failed to load deal:", error);
      alert("Failed to load deal");
    } finally {
      setLoading(false);
    }
  };

  const getFinalOffer = () => {
    const lastAccordoMessage = [...messages].reverse().find((m) => m.role === "ACCORDO");
    const lastDecision = lastAccordoMessage?.engine_decision;
    const lastVendorMessage = [...messages].reverse().find((m) => m.role === "VENDOR");

    if (!lastDecision) return null;

    // If ACCEPT, use last vendor offer
    if (lastDecision.action === "ACCEPT" && lastVendorMessage?.extracted_offer) {
      return lastVendorMessage.extracted_offer;
    }

    // If COUNTER, use counter offer
    if (lastDecision.action === "COUNTER" && lastDecision.counterOffer) {
      return lastDecision.counterOffer;
    }

    // Otherwise, use latest offer from deal
    return deal?.latest_offer_json || null;
  };

  const getFirstOffer = () => {
    const firstVendorMessage = messages.find((m) => m.role === "VENDOR");
    return firstVendorMessage?.extracted_offer || null;
  };

  const getConcessionSummary = () => {
    const firstOffer = getFirstOffer();
    const finalOffer = getFinalOffer();

    if (!firstOffer || !finalOffer) {
      return null;
    }

    const priceChange = finalOffer.unit_price && firstOffer.unit_price
      ? finalOffer.unit_price - firstOffer.unit_price
      : null;

    const termsChanged = firstOffer.payment_terms !== finalOffer.payment_terms;

    const tradeOffs: string[] = [];
    if (priceChange !== null) {
      if (priceChange > 0) {
        tradeOffs.push(`Price increased by $${priceChange.toFixed(2)}`);
      } else if (priceChange < 0) {
        tradeOffs.push(`Price decreased by $${Math.abs(priceChange).toFixed(2)}`);
      }
    }
    if (termsChanged) {
      tradeOffs.push(`Payment terms changed from ${firstOffer.payment_terms || "N/A"} to ${finalOffer.payment_terms || "N/A"}`);
    }

    return {
      firstOffer,
      finalOffer,
      tradeOffs,
    };
  };

  const handleExportSummary = async () => {
    if (!deal) return;

    const finalOffer = getFinalOffer();
    const concession = getConcessionSummary();

    const summary = `
AGREEMENT SUMMARY
=================

Deal: ${deal.title}
${deal.counterparty ? `Counterparty: ${deal.counterparty}\n` : ""}
Status: ${deal.status}
Final Round: ${deal.round}
Date: ${new Date(deal.updated_at).toLocaleString()}

FINAL TERMS
-----------
${finalOffer
  ? `Unit Price: $${finalOffer.unit_price || "N/A"}
Payment Terms: ${finalOffer.payment_terms || "N/A"}`
  : "No final terms available"}

${concession
  ? `CONCESSION SUMMARY
------------------
Started at:
  Unit Price: $${concession.firstOffer.unit_price || "N/A"}
  Payment Terms: ${concession.firstOffer.payment_terms || "N/A"}

Final at:
  Unit Price: $${concession.finalOffer.unit_price || "N/A"}
  Payment Terms: ${concession.finalOffer.payment_terms || "N/A"}

Trade-offs made:
${concession.tradeOffs.length > 0 ? concession.tradeOffs.map((t) => `  - ${t}`).join("\n") : "  - None"}
`
  : ""}

FULL TRANSCRIPT
---------------
${messages
  .map(
    (msg) =>
      `[${msg.role}] ${new Date(msg.created_at).toLocaleString()}\n${msg.content}`
  )
  .join("\n\n")}
`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy summary. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="summary-loading">
        <div>Loading agreement summary...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="summary-error">
        <div>Deal not found</div>
      </div>
    );
  }

  const finalOffer = getFinalOffer();
  const concession = getConcessionSummary();
  // const lastAccordoMessage = [...messages].reverse().find((m) => m.role === "ACCORDO");
  // const lastDecision = lastAccordoMessage?.engine_decision;

  const getStatusBadgeClass = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "ACCEPTED") return "status-accepted";
    if (normalized === "WALKED_AWAY") return "status-walked-away";
    if (normalized === "ESCALATED") return "status-escalated";
    return "status-default";
  };

  return (
    <div className="summary-page">
      <div className="summary-container">
        {/* Header */}
        <div className="summary-header">
          <div>
            <h1>Deal Outcome</h1>
            <p className="deal-title">{deal.title}</p>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate(`/deals/${dealId}`)} className="back-btn">
              Back to Chat
            </button>
            <button onClick={handleExportSummary} className="export-btn">
              {copied ? "✓ Copied!" : "Export Summary"}
            </button>
          </div>
        </div>

        {/* Final Status */}
        <div className="status-card">
          <div className="status-content">
            <span className="status-label">Final Status</span>
            <span className={`status-badge ${getStatusBadgeClass(deal.status)}`}>
              {deal.status}
            </span>
          </div>
          <div className="status-meta">
            <span>Round {deal.round} / 6</span>
            {deal.counterparty && <span>• {deal.counterparty}</span>}
            <span>• {new Date(deal.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Final Terms Table */}
        {finalOffer && (
          <div className="terms-card">
            <h2>Final Terms</h2>
            <table className="terms-table">
              <tbody>
                {finalOffer.unit_price !== null && finalOffer.unit_price !== undefined && (
                  <tr>
                    <td className="term-label">Unit Price</td>
                    <td className="term-value">${finalOffer.unit_price}</td>
                  </tr>
                )}
                {finalOffer.payment_terms && (
                  <tr>
                    <td className="term-label">Payment Terms</td>
                    <td className="term-value">{finalOffer.payment_terms}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Concession Summary */}
        {concession && (
          <div className="concession-card">
            <h2>Concession Summary</h2>
            <div className="concession-content">
              <div className="concession-item">
                <span className="concession-label">Started at:</span>
                <div className="concession-details">
                  {concession.firstOffer.unit_price !== null &&
                    concession.firstOffer.unit_price !== undefined && (
                      <span>Unit Price: ${concession.firstOffer.unit_price}</span>
                    )}
                  {concession.firstOffer.payment_terms && (
                    <span>Payment Terms: {concession.firstOffer.payment_terms}</span>
                  )}
                </div>
              </div>
              <div className="concession-item">
                <span className="concession-label">Final at:</span>
                <div className="concession-details">
                  {concession.finalOffer.unit_price !== null &&
                    concession.finalOffer.unit_price !== undefined && (
                      <span>Unit Price: ${concession.finalOffer.unit_price}</span>
                    )}
                  {concession.finalOffer.payment_terms && (
                    <span>Payment Terms: {concession.finalOffer.payment_terms}</span>
                  )}
                </div>
              </div>
              <div className="concession-item">
                <span className="concession-label">Trade-offs made:</span>
                <div className="trade-offs">
                  {concession.tradeOffs.length > 0 ? (
                    <ul>
                      {concession.tradeOffs.map((tradeOff, idx) => (
                        <li key={idx}>{tradeOff}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="no-tradeoffs">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Transcript (Collapsible) */}
        <div className="transcript-card">
          <button
            className="transcript-header"
            onClick={() => setTranscriptExpanded(!transcriptExpanded)}
          >
            <h2>Full Transcript</h2>
            <span className={`transcript-arrow ${transcriptExpanded ? "expanded" : ""}`}>
              {transcriptExpanded ? "Hide" : "Show"}
            </span>
          </button>
          {transcriptExpanded && (
            <div className="transcript-content">
              {messages.length === 0 ? (
                <div className="no-messages">No messages yet.</div>
              ) : (
                <div className="transcript-messages">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`transcript-message ${msg.role.toLowerCase()}`}>
                      <div className="message-meta">
                        <span className="message-role">{msg.role}</span>
                        <span className="message-time">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="message-text">{msg.content}</div>
                      {msg.extracted_offer && (
                        <details className="message-details">
                          <summary>Extracted Offer</summary>
                          <pre>{JSON.stringify(msg.extracted_offer, null, 2)}</pre>
                        </details>
                      )}
                      {msg.engine_decision && (
                        <details className="message-details">
                          <summary>Engine Decision</summary>
                          <pre>{JSON.stringify(msg.engine_decision, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
