import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dealsApi } from "../api/client";
import type { Deal } from "../api/client";
import DealCard from "../components/DealCard";
import "./DealsPage.css";

export default function Deals() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const data = await dealsApi.list();
      setDeals(data.deals || []);
    } catch (error) {
      console.error("Failed to load deals:", error);
      // If API fails, show empty state or hardcoded list
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate("/deals/new");
  };

  if (loading) {
    return (
      <div className="deals-page">
        <div className="deals-header">
          <h1>Deals</h1>
          <button onClick={handleCreateNew} className="create-btn primary">
            New Deal
          </button>
        </div>
        <div className="loading">Loading deals...</div>
      </div>
    );
  }

  return (
    <div className="deals-page">
      <div className="deals-header">
        <h1>Deals</h1>
        <button onClick={handleCreateNew} className="create-btn primary">
          New Deal
        </button>
      </div>
      <div className="deals-list">
        {deals.length === 0 ? (
          <div className="empty-state">
            <p>No deals yet. Create your first deal to get started!</p>
            <button onClick={handleCreateNew} className="create-btn primary">
              New Deal
            </button>
          </div>
        ) : (
          deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}

