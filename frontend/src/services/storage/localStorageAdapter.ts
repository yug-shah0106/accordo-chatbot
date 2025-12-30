import type { StorageAdapter, HistoryEntry } from "./types";

const STORAGE_KEY = "accordo_history";

export class LocalStorageAdapter implements StorageAdapter {
  private getAll(): HistoryEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error("Failed to parse history from localStorage");
      return [];
    }
  }

  private saveAll(entries: HistoryEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // Get active entries (not archived, not deleted)
  async getAllHistory(): Promise<HistoryEntry[]> {
    return this.getAll().filter(
      (e) => e.deletedAt === null && e.archivedAt === null
    );
  }

  async getHistoryById(id: string): Promise<HistoryEntry | null> {
    const entries = this.getAll();
    return entries.find((e) => e.id === id) || null;
  }

  async saveHistory(entry: HistoryEntry): Promise<void> {
    const entries = this.getAll();
    const existingIndex = entries.findIndex((e) => e.id === entry.id);

    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    this.saveAll(entries);
  }

  async updateHistory(
    id: string,
    updates: Partial<HistoryEntry>
  ): Promise<void> {
    const entries = this.getAll();
    const index = entries.findIndex((e) => e.id === id);

    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveAll(entries);
    }
  }

  async deleteHistory(id: string): Promise<void> {
    const entries = this.getAll().filter((e) => e.id !== id);
    this.saveAll(entries);
  }

  // Archive operations
  async archiveHistory(id: string): Promise<void> {
    const entries = this.getAll();
    const index = entries.findIndex((e) => e.id === id);

    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.saveAll(entries);
    }
  }

  async unarchiveHistory(id: string): Promise<void> {
    const entries = this.getAll();
    const index = entries.findIndex((e) => e.id === id);

    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        archivedAt: null,
        updatedAt: new Date().toISOString(),
      };
      this.saveAll(entries);
    }
  }

  async getArchivedHistory(): Promise<HistoryEntry[]> {
    return this.getAll().filter(
      (e) => e.archivedAt !== null && e.deletedAt === null
    );
  }

  // Soft delete operations
  async softDeleteHistory(id: string): Promise<void> {
    const entries = this.getAll();
    const index = entries.findIndex((e) => e.id === id);

    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        deletedAt: new Date().toISOString(),
        archivedAt: null, // Remove from archive when deleted
        updatedAt: new Date().toISOString(),
      };
      this.saveAll(entries);
    }
  }

  async restoreHistory(id: string): Promise<void> {
    const entries = this.getAll();
    const index = entries.findIndex((e) => e.id === id);

    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      };
      this.saveAll(entries);
    }
  }

  async getDeletedHistory(): Promise<HistoryEntry[]> {
    return this.getAll().filter((e) => e.deletedAt !== null);
  }

  async permanentlyDeleteHistory(id: string): Promise<void> {
    await this.deleteHistory(id);
  }
}
