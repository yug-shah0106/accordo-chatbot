export type DealStatus =
  | "CREATED"
  | "NEGOTIATING"
  | "ACCEPTED"
  | "WALKED_AWAY"
  | "ESCALATED"
  | "READY_TO_ACCEPT";

export interface HistoryEntry {
  id: string;
  dealId: string;
  dealTitle: string;
  counterparty: string;
  status: DealStatus;
  lastMessage: string;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface StorageAdapter {
  // History entries - Active deals (not archived, not deleted)
  getAllHistory(): Promise<HistoryEntry[]>;
  getHistoryById(id: string): Promise<HistoryEntry | null>;
  saveHistory(entry: HistoryEntry): Promise<void>;
  updateHistory(id: string, updates: Partial<HistoryEntry>): Promise<void>;
  deleteHistory(id: string): Promise<void>;

  // Archive operations
  archiveHistory(id: string): Promise<void>;
  unarchiveHistory(id: string): Promise<void>;
  getArchivedHistory(): Promise<HistoryEntry[]>;

  // Soft delete operations
  softDeleteHistory(id: string): Promise<void>;
  restoreHistory(id: string): Promise<void>;
  getDeletedHistory(): Promise<HistoryEntry[]>;
  permanentlyDeleteHistory(id: string): Promise<void>;
}

export interface GroupedHistory {
  year: number;
  months: {
    month: number;
    monthName: string;
    entries: HistoryEntry[];
  }[];
}
