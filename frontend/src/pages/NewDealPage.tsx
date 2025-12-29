import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { dealsApi } from "../api/client";
import "./NewDealPage.css";

export default function NewDeal() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const { id } = await dealsApi.create({
        title,
        counterparty: counterparty || undefined,
        templateId: templateId || undefined,
      });
      navigate(`/deals/${id}`);
    } catch (error) {
      console.error("Failed to create deal:", error);
      alert("Failed to create deal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-deal-page">
      <div className="new-deal-container">
        <h1>Create New Deal</h1>
        <p className="subtitle">Get started in under a minute</p>

        <form onSubmit={handleSubmit} className="new-deal-form">
          <div className="form-group">
            <label htmlFor="title">
              Deal Title <span className="required">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Office Supplies Q1 2024"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="counterparty">Counterparty Name</label>
            <input
              id="counterparty"
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="e.g., Acme Corp"
              disabled={loading}
            />
          </div>

          <div className="advanced-section">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={loading}
            >
              <span>Advanced</span>
              <span className={`arrow ${showAdvanced ? "open" : ""}`}>
                {showAdvanced ? "Hide" : "Show"}
              </span>
            </button>

            {showAdvanced && (
              <div className="advanced-content">
                <div className="form-group">
                  <label htmlFor="template">Template</label>
                  <select
                    id="template"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">None (Default)</option>
                    {/* TODO: Load templates from API when available */}
                  </select>
                  <p className="field-hint">Choose a negotiation template (optional)</p>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !title.trim()}
          >
            {loading ? "Creating..." : "Create Deal"}
          </button>
        </form>
      </div>
    </div>
  );
}
