export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface HistoryItem {
  method: HttpMethod;
  resourceUrl: string;
  requestData?: string;
  response: string;
  timestamp: number;
}

class HistoryService {
  private readonly storageKey = 'rci-rest-api-history';
  private readonly maxHistorySize = 100;

  public loadHistory(): HistoryItem[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
    return [];
  }

  private saveHistory(history: HistoryItem[]): void {
    try {
      // Keep only the most recent items
      const trimmed = history.slice(-this.maxHistorySize);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  public addToHistory(item: HistoryItem): void {
    const history = this.loadHistory();

    // Check if an item with the same method, resourceUrl, and requestData already exists
    const existingIndex = history.findIndex((existing) =>
      existing.method === item.method
      && existing.resourceUrl === item.resourceUrl
      && existing.requestData === item.requestData
    );

    if (existingIndex !== -1) {
      // Update existing item's timestamp and response
      history[existingIndex].timestamp = item.timestamp;
      history[existingIndex].response = item.response;
    } else {
      // Add new item
      history.push(item);
    }

    this.saveHistory(history);
  }
}

export const historyService = new HistoryService();
