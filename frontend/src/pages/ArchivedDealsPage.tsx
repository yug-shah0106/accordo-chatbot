import { useState, useEffect, useMemo, useCallback } from "react";
import { Archive } from "lucide-react";
import { dealsApi } from "../api/client";
import type { Deal } from "../api/client";
import { DealFilters, EmptyState } from "../components/deals";
import { ConfirmDialog } from "../components/common";
import DealCard from "../components/DealCard";
import "./ArchivedDealsPage.css";

export default function ArchivedDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: "unarchive" | "delete";
    deal: Deal | null;
  }>({ isOpen: false, type: "unarchive", deal: null });

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dealsApi.listArchived();
      setDeals(data.deals || []);
    } catch (error) {
      console.error("Failed to load archived deals:", error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  // Get available years from deals
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    deals.forEach((deal) => {
      const year = new Date(deal.archived_at || deal.updated_at).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [deals]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (deal) =>
          deal.title.toLowerCase().includes(query) ||
          deal.counterparty?.toLowerCase().includes(query) ||
          deal.status.toLowerCase().includes(query)
      );
    }

    // Apply year filter
    if (selectedYear) {
      const year = parseInt(selectedYear);
      result = result.filter((deal) => {
        const dealYear = new Date(deal.archived_at || deal.updated_at).getFullYear();
        return dealYear === year;
      });
    }

    // Apply month filter
    if (selectedMonth) {
      const month = parseInt(selectedMonth);
      result = result.filter((deal) => {
        const dealMonth = new Date(deal.archived_at || deal.updated_at).getMonth();
        return dealMonth === month;
      });
    }

    // Sort by archived_at descending
    result.sort(
      (a, b) =>
        new Date(b.archived_at || b.updated_at).getTime() -
        new Date(a.archived_at || a.updated_at).getTime()
    );

    return result;
  }, [deals, searchQuery, selectedYear, selectedMonth]);

  const hasFilters = searchQuery || selectedYear || selectedMonth;

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedYear("");
    setSelectedMonth("");
  };

  const handleUnarchive = (deal: Deal) => {
    setConfirmDialog({ isOpen: true, type: "unarchive", deal });
  };

  const handleDelete = (deal: Deal) => {
    setConfirmDialog({ isOpen: true, type: "delete", deal });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.deal) return;

    try {
      if (confirmDialog.type === "unarchive") {
        await dealsApi.unarchive(confirmDialog.deal.id);
      } else {
        await dealsApi.softDelete(confirmDialog.deal.id);
      }
      await loadDeals();
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setConfirmDialog({ isOpen: false, type: "unarchive", deal: null });
    }
  };

  const handleCancelAction = () => {
    setConfirmDialog({ isOpen: false, type: "unarchive", deal: null });
  };

  return (
    <div className="archived-deals-page">
      <div className="page-header">
        <div className="header-content">
          <Archive size={24} className="header-icon" />
          <div>
            <h1>Archived Deals</h1>
            <p>Deals you've archived for later reference</p>
          </div>
        </div>
      </div>

      <DealFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        availableYears={availableYears}
      />

      <div className="deals-list">
        {loading ? (
          <div className="loading">Loading archived deals...</div>
        ) : deals.length === 0 ? (
          <EmptyState variant="no-archived" />
        ) : filteredDeals.length === 0 ? (
          <EmptyState
            variant="no-results"
            hasFilters={!!hasFilters}
            onClearFilters={handleClearFilters}
          />
        ) : (
          filteredDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              variant="archived"
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.type === "unarchive"
            ? "Unarchive deal?"
            : "Delete deal?"
        }
        message={
          confirmDialog.type === "unarchive"
            ? `"${confirmDialog.deal?.title}" will be moved back to your active deals.`
            : `"${confirmDialog.deal?.title}" will be moved to deleted items.`
        }
        confirmLabel={confirmDialog.type === "unarchive" ? "Unarchive" : "Delete"}
        variant={confirmDialog.type === "unarchive" ? "info" : "danger"}
        icon={confirmDialog.type === "unarchive" ? "restore" : "delete"}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />
    </div>
  );
}
