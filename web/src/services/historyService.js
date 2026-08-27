/**
 * Local Watch History & Progress Service
 */

const STORAGE_KEY = 'cinedrive_watch_history_v1';

export class HistoryService {
  static getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  static saveProgress(fileId, data) {
    if (!fileId) return;
    try {
      const history = this.getHistory();
      history[fileId] = {
        fileId,
        fileName: data.fileName || 'Video',
        currentTime: data.currentTime || 0,
        duration: data.duration || 0,
        progressPercent: data.duration > 0 ? Math.round((data.currentTime / data.duration) * 100) : 0,
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Không thể lưu tiến độ xem:', e);
    }
  }

  static getProgress(fileId) {
    const history = this.getHistory();
    return history[fileId] || null;
  }

  static removeProgress(fileId) {
    const history = this.getHistory();
    delete history[fileId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  static getAllSorted() {
    const history = this.getHistory();
    return Object.values(history).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
