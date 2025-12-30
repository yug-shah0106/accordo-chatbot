import type { HistoryEntry, GroupedHistory, StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localStorageAdapter";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

class HistoryService {
  private adapter: StorageAdapter;

  constructor(adapter?: StorageAdapter) {
    this.adapter = adapter || new LocalStorageAdapter();
  }

  // Active deals (not archived, not deleted)
  async getAllHistory(): Promise<HistoryEntry[]> {
    return this.adapter.getAllHistory();
  }

  async getHistoryById(id: string): Promise<HistoryEntry | null> {
    return this.adapter.getHistoryById(id);
  }

  async getHistoryByDealId(dealId: string): Promise<HistoryEntry | null> {
    const all = await this.adapter.getAllHistory();
    return all.find((e) => e.dealId === dealId) || null;
  }

  async saveHistory(entry: HistoryEntry): Promise<void> {
    return this.adapter.saveHistory(entry);
  }

  async updateHistory(
    id: string,
    updates: Partial<HistoryEntry>
  ): Promise<void> {
    return this.adapter.updateHistory(id, updates);
  }

  // Archive operations
  async archive(id: string): Promise<void> {
    return this.adapter.archiveHistory(id);
  }

  async unarchive(id: string): Promise<void> {
    return this.adapter.unarchiveHistory(id);
  }

  async getArchived(): Promise<HistoryEntry[]> {
    return this.adapter.getArchivedHistory();
  }

  // Delete operations
  async softDelete(id: string): Promise<void> {
    return this.adapter.softDeleteHistory(id);
  }

  async restore(id: string): Promise<void> {
    return this.adapter.restoreHistory(id);
  }

  async getDeleted(): Promise<HistoryEntry[]> {
    return this.adapter.getDeletedHistory();
  }

  async permanentlyDelete(id: string): Promise<void> {
    return this.adapter.permanentlyDeleteHistory(id);
  }

  // Search across entries
  async search(
    query: string,
    entries: HistoryEntry[]
  ): Promise<HistoryEntry[]> {
    if (!query.trim()) return entries;

    const lowerQuery = query.toLowerCase();

    return entries.filter(
      (entry) =>
        entry.dealTitle.toLowerCase().includes(lowerQuery) ||
        entry.counterparty.toLowerCase().includes(lowerQuery) ||
        entry.status.toLowerCase().includes(lowerQuery) ||
        entry.lastMessagePreview.toLowerCase().includes(lowerQuery)
    );
  }

  // Filter by year and month
  filterByDate(
    entries: HistoryEntry[],
    year?: number,
    month?: number
  ): HistoryEntry[] {
    return entries.filter((entry) => {
      const date = new Date(entry.updatedAt);
      const entryYear = date.getFullYear();
      const entryMonth = date.getMonth();

      if (year !== undefined && entryYear !== year) return false;
      if (month !== undefined && entryMonth !== month) return false;

      return true;
    });
  }

  // Get available years from entries
  getAvailableYears(entries: HistoryEntry[]): number[] {
    const years = new Set<number>();
    entries.forEach((entry) => {
      const year = new Date(entry.updatedAt).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }

  // Group entries by year and month
  groupByDate(entries: HistoryEntry[]): GroupedHistory[] {
    // Sort by updatedAt descending (most recent first)
    const sorted = [...entries].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const grouped: Map<number, Map<number, HistoryEntry[]>> = new Map();

    for (const entry of sorted) {
      const date = new Date(entry.updatedAt);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!grouped.has(year)) {
        grouped.set(year, new Map());
      }

      const yearMap = grouped.get(year)!;
      if (!yearMap.has(month)) {
        yearMap.set(month, []);
      }

      yearMap.get(month)!.push(entry);
    }

    // Convert to array structure
    const result: GroupedHistory[] = [];

    // Sort years descending
    const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);

    for (const year of sortedYears) {
      const yearMap = grouped.get(year)!;
      const months: GroupedHistory["months"] = [];

      // Sort months descending
      const sortedMonths = Array.from(yearMap.keys()).sort((a, b) => b - a);

      for (const month of sortedMonths) {
        months.push({
          month,
          monthName: MONTH_NAMES[month],
          entries: yearMap.get(month)!,
        });
      }

      result.push({ year, months });
    }

    return result;
  }

  createHistoryEntry(
    dealId: string,
    dealTitle: string,
    counterparty: string
  ): HistoryEntry {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      dealId,
      dealTitle,
      counterparty,
      status: "CREATED",
      lastMessage: "",
      lastMessagePreview: "No messages yet",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      deletedAt: null,
    };
  }
}

// Singleton instance
export const historyService = new HistoryService();
export { HistoryService };
