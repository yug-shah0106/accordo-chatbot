import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useDealActions } from "../../hooks/useDealActions";
import "./TopBar.css";

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId: string }>();

  const isDealPage = location.pathname.includes("/deals/") && dealId && !location.pathname.includes("/summary");
  
  // Always call hook, but only use it on deal pages
  const {
    deal,
    sending,
    autoVendorLoading,
    runDemoLoading,
    resetLoading,
    canNegotiate,
    canRunDemo,
    canAutoVendor,
    canReset,
    autoVendor,
    runDemo,
    reset,
  } = useDealActions(isDealPage ? dealId : undefined);

  const handleAutoVendor = async () => {
    if (!isDealPage || !canAutoVendor) return;
    try {
      await autoVendor();
    } catch (error) {
      alert("Failed to generate auto vendor reply");
    }
  };

  const handleRunDemo = async () => {
    if (!isDealPage || !canRunDemo) return;
    try {
      await runDemo();
    } catch (error) {
      alert("Failed to run demo");
    }
  };

  const handleReset = async () => {
    if (!isDealPage || !canReset) return;
    if (window.confirm("This will clear the transcript and restart the negotiation. Continue?")) {
      try {
        await reset();
      } catch (error) {
        alert("Failed to reset deal");
      }
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === "ACCEPTED") return "status-accepted";
    if (normalized === "WALKED_AWAY") return "status-walked-away";
    if (normalized === "ESCALATED") return "status-escalated";
    return "status-negotiating";
  };

  return (
    <div className="top-bar">
      <div className="top-bar-content">
        {isDealPage && deal ? (
          <div className="top-bar-left">
            <div className="deal-title-section">
              <h2 className="deal-title">{deal.title}</h2>
              {deal.counterparty && (
                <p className="deal-counterparty">with {deal.counterparty}</p>
              )}
            </div>
            <div className="deal-badges">
              <span className={`status-badge ${getStatusBadgeClass(deal.status)}`}>
                {deal.status}
              </span>
              <span className="round-badge">Round {deal.round} / 6</span>
            </div>
          </div>
        ) : (
          <div className="top-bar-left">
            <span className="no-deal">No active deal</span>
          </div>
        )}
        <div className="top-bar-actions">
          {isDealPage && deal && (
            <>
              {canNegotiate ? (
                <>
                  <button
                    onClick={handleRunDemo}
                    disabled={!canRunDemo || sending || autoVendorLoading || runDemoLoading}
                    className="action-btn primary"
                  >
                    {runDemoLoading ? "Running..." : "Run Demo"}
                  </button>
                  <button
                    onClick={handleAutoVendor}
                    disabled={!canAutoVendor || autoVendorLoading || sending || runDemoLoading}
                    className="action-btn"
                  >
                    {autoVendorLoading ? "Generating..." : "Auto Vendor"}
                  </button>
                </>
              ) : deal?.status === "ESCALATED" ? (
                <>
                  <span className="deal-closed-badge">Escalated — requires human review</span>
                  <button
                    onClick={handleReset}
                    disabled={!canReset || resetLoading}
                    className="action-btn"
                  >
                    Reset
                  </button>
                </>
              ) : (
                <span className="deal-closed-badge">Deal Closed</span>
              )}
              <button
                onClick={() => navigate(`/deals/${dealId}/summary`)}
                className="action-btn"
              >
                View Summary
              </button>
              <button
                onClick={handleReset}
                disabled={!canReset || resetLoading || runDemoLoading}
                className="action-btn destructive"
              >
                {resetLoading ? "Resetting..." : "Reset"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
