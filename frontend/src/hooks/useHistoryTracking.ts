import { useCallback } from "react";
import { historyService } from "../services/storage";
import type { DealStatus } from "../services/storage";

interface TrackingDeal {
  id: string;
  title: string;
  vendor?: string;
  counterparty?: string;
  status: string;
}

export function useHistoryTracking() {
  const trackDealStart = useCallback(async (deal: TrackingDeal) => {
    try {
      const existing = await historyService.getHistoryByDealId(deal.id);

      if (existing) {
        // Update existing entry
        await historyService.updateHistory(existing.id, {
          dealTitle: deal.title,
          counterparty: deal.vendor || deal.counterparty || "Unknown",
          status: deal.status as DealStatus,
        });
      } else {
        // Create new history entry
        const entry = historyService.createHistoryEntry(
          deal.id,
          deal.title,
          deal.vendor || deal.counterparty || "Unknown"
        );
        await historyService.saveHistory(entry);
      }
    } catch (error) {
      console.error("Failed to track deal start:", error);
    }
  }, []);

  const trackMessage = useCallback(
    async (dealId: string, message: string, preview?: string) => {
      try {
        const existing = await historyService.getHistoryByDealId(dealId);

        if (existing) {
          await historyService.updateHistory(existing.id, {
            lastMessage: message,
            lastMessagePreview:
              preview ||
              (message.length > 100 ? message.slice(0, 100) + "..." : message),
          });
        }
      } catch (error) {
        console.error("Failed to track message:", error);
      }
    },
    []
  );

  const trackStatusChange = useCallback(
    async (dealId: string, status: DealStatus) => {
      try {
        const existing = await historyService.getHistoryByDealId(dealId);

        if (existing) {
          await historyService.updateHistory(existing.id, { status });
        }
      } catch (error) {
        console.error("Failed to track status change:", error);
      }
    },
    []
  );

  const softDeleteEntry = useCallback(async (historyId: string) => {
    try {
      await historyService.softDelete(historyId);
    } catch (error) {
      console.error("Failed to soft delete entry:", error);
    }
  }, []);

  return {
    trackDealStart,
    trackMessage,
    trackStatusChange,
    softDeleteEntry,
  };
}
