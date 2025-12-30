import { useState, useEffect, useMemo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { dealsApi } from "../api/client";
import type { Deal } from "../api/client";
import { DealFilters, EmptyState } from "../components/deals";
import { ConfirmDialog } from "../components/common";
import DealCard from "../components/DealCard";
import "./DeletedDealsPage.css";

export default function DeletedDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: "restore" | "archive" | "permanent";
    deal: Deal | null;
  }>({ isOpen: false, type: "restore", deal: null });

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dealsApi.listDeleted();
      setDeals(data.deals || []);
    } catch (error) {
      console.error("Failed to load deleted deals:", error);
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
      const year = new Date(deal.deleted_at || deal.updated_at).getFullYear();
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
        const dealYear = new Date(deal.deleted_at || deal.updated_at).getFullYear();
        return dealYear === year;
      });
    }

    // Apply month filter
    if (selectedMonth) {
      const month = parseInt(selectedMonth);
      result = result.filter((deal) => {
        const dealMonth = new Date(deal.deleted_at || deal.updated_at).getMonth();
        return dealMonth === month;
      });
    }

    // Sort by deleted_at descending (most recently deleted first)
    result.sort(
      (a, b) =>
        new Date(b.deleted_at || b.updated_at).getTime() -
        new Date(a.deleted_at || a.updated_at).getTime()
    );

    return result;
  }, [deals, searchQuery, selectedYear, selectedMonth]);

  const hasFilters = searchQuery || selectedYear || selectedMonth;

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedYear("");
    setSelectedMonth("");
  };

  const handleRestore = (deal: Deal) => {
    setConfirmDialog({ isOpen: true, type: "restore", deal });
  };

  const handleArchive = (deal: Deal) => {
    setConfirmDialog({ isOpen: true, type: "archive", deal });
  };

  const handlePermanentDelete = (deal: Deal) => {
    setConfirmDialog({ isOpen: true, type: "permanent", deal });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.deal) return;

    try {
      if (confirmDialog.type === "restore") {
        await dealsApi.restore(confirmDialog.deal.id);
      } else if (confirmDialog.type === "archive") {
        await dealsApi.archiveFromDeleted(confirmDialog.deal.id);
      } else {
        await dealsApi.permanentlyDelete(confirmDialog.deal.id);
      }
      await loadDeals();
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setConfirmDialog({ isOpen: false, type: "restore", deal: null });
    }
  };

  const handleCancelAction = () => {
    setConfirmDialog({ isOpen: false, type: "restore", deal: null });
  };

  const getDialogTitle = () => {
    switch (confirmDialog.type) {
      case "restore":
        return "Restore deal?";
      case "archive":
        return "Archive deal?";
      case "permanent":
        return "Delete permanently?";
    }
  };

  const getDialogMessage = () => {
    switch (confirmDialog.type) {
      case "restore":
        return `"${confirmDialog.deal?.title}" will be restored to your active deals.`;
      case "archive":
        return `"${confirmDialog.deal?.title}" will be moved to your archived deals.`;
      case "permanent":
        return `"${confirmDialog.deal?.title}" will be permanently deleted. This action cannot be undone.`;
    }
  };

  const getDialogConfirmLabel = () => {
    switch (confirmDialog.type) {
      case "restore":
        return "Restore";
      case "archive":
        return "Archive";
      case "permanent":
        return "Delete Forever";
    }
  };

  const getDialogVariant = () => {
    return confirmDialog.type === "permanent" ? "danger" : "info";
  };

  const getDialogIcon = () => {
    switch (confirmDialog.type) {
      case "restore":
        return "restore";
      case "archive":
        return "warning";
      case "permanent":
        return "delete";
    }
  };

  return (
    <div className="deleted-deals-page">
      <div className="page-header">
        <div className="header-content">
          <Trash2 size={24} className="header-icon" />
          <div>
            <h1>Deleted Deals</h1>
            <p>Restore, archive, or permanently delete your removed deals</p>
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
          <div className="loading">Loading deleted deals...</div>
        ) : deals.length === 0 ? (
          <EmptyState variant="no-deleted" />
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
              variant="deleted"
              onRestore={handleRestore}
              onArchive={handleArchive}
              onPermanentDelete={handlePermanentDelete}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={getDialogTitle()}
        message={getDialogMessage()}
        confirmLabel={getDialogConfirmLabel()}
        variant={getDialogVariant()}
        icon={getDialogIcon()}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />
    </div>
  );
}
