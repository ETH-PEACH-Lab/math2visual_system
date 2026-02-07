/**
 * Analytics API service for tracking user actions and sessions.
 */
import { BACKEND_API_URL } from '@/config/api';

export interface Action {
  type: string;
  data?: string;
  timestamp?: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  element_type?: string;
  element_id?: string;
  timestamp?: string;
}

class AnalyticsService {
  private sessionId: string | null = null;
  private isEnabled: boolean = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
  private actionQueue: Action[] = [];
  private cursorQueue: CursorPosition[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private cursorFlushTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly CURSOR_BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private unloadHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.initializeSession();
    this.setupUnloadListeners();
  }

  private initializeSession(): void {
    this.sessionId = localStorage.getItem('math2visual_session_id');
    
    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
      localStorage.setItem('math2visual_session_id', this.sessionId);
    }

    this.registerSession();
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `session_${timestamp}_${random}`;
  }

  private setupUnloadListeners(): void {
    // Handle page unload (user closes tab/window)
    this.unloadHandler = () => {
      this.flushQueueSync();
      this.flushCursorQueueSync();
    };
    
    // Handle visibility change (user switches tabs or minimizes)
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.flushActionsQueue();
        this.flushCursorQueue();
      }
    };
    
    window.addEventListener('beforeunload', this.unloadHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeUnloadListeners(): void {
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = null;
    }
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private async registerSession(): Promise<void> {
    if (!this.isEnabled || !this.sessionId) return;

    try {
      await fetch(`${BACKEND_API_URL}/analytics/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId }),
      });
    } catch (error) {
      console.warn('Failed to register analytics session:', error);
      this.isEnabled = false;
    }
  }

  async recordAction(action: Action): Promise<void> {
    if (!this.isEnabled || !this.sessionId) return;

    // Add UTC timestamp to the action
    const actionWithTimestamp = {
      ...action,
      timestamp: new Date().toISOString(),
    };

    // Add to queue
    this.actionQueue.push(actionWithTimestamp);

    // Check if we should flush
    if (this.actionQueue.length >= this.BATCH_SIZE) {
      await this.flushActionsQueue();
    } else {
      this.flushTimer = this.scheduleFlush(this.flushTimer, () => this.flushActionsQueue());
    }
  }

  async recordCursorPosition(x: number, y: number, metadata?: {
    element_type?: string;
    element_id?: string;
  }): Promise<void> {
    if (!this.isEnabled || !this.sessionId) return;

    const position: CursorPosition = {
      x,
      y,
      element_type: metadata?.element_type,
      element_id: metadata?.element_id,
      timestamp: new Date().toISOString(),
    };

    this.cursorQueue.push(position);

    // Check if we should flush
    if (this.cursorQueue.length >= this.CURSOR_BATCH_SIZE) {
      await this.flushCursorQueue();
    } else {
      this.cursorFlushTimer = this.scheduleFlush(this.cursorFlushTimer, () => this.flushCursorQueue());
    }
  }

  async uploadScreenshot(imageData: string, width: number, height: number): Promise<void> {
    if (!this.isEnabled || !this.sessionId) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/analytics/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          image_data: imageData,
          width: width,
          height: height,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.error('Failed to upload screenshot:', response.statusText);
      }
    } catch (error) {
      console.error('Error uploading screenshot:', error);
    }
  }

  async recordActionsBatch(actions: Action[]): Promise<void> {
    if (!this.isEnabled || !this.sessionId) return;

    try {
      // Add UTC timestamps to all actions
      const actionsWithTimestamps = actions.map(action => ({
        ...action,
        timestamp: action.timestamp || new Date().toISOString(),
      }));

      const response = await fetch(`${BACKEND_API_URL}/analytics/actions/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          actions: actionsWithTimestamps,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Analytics batch request failed - lost actions:', {
          count: actionsWithTimestamps.length,
          actions: actionsWithTimestamps,
          sessionId: this.sessionId,
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to record batch actions - lost actions:', {
        count: actions.length,
        actions: actions.map(a => ({ type: a.type, data: a.data })),
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error; // Re-throw to let caller handle it
    }
  }

  private async recordCursorPositionsBatch(positions: CursorPosition[]): Promise<void> {
    if (!this.isEnabled || !this.sessionId) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/analytics/cursor-positions/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          positions: positions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Cursor positions batch request failed:', {
          count: positions.length,
          sessionId: this.sessionId,
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to record cursor positions batch:', error);
      throw error;
    }
  }

  private scheduleFlush(timerRef: NodeJS.Timeout | null, callback: () => void): NodeJS.Timeout {
    if (timerRef) {
      clearTimeout(timerRef);
    }
    
    return setTimeout(callback, this.FLUSH_INTERVAL);
  }

  private async flushActionsQueue(): Promise<void> {
    if (this.actionQueue.length === 0) return;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const actionsToSend = [...this.actionQueue];
    this.actionQueue = [];

    try {
      await this.recordActionsBatch(actionsToSend);
    } catch (error) {
      console.warn('Failed to flush analytics queue:', error);
    }
  }

  private async flushCursorQueue(): Promise<void> {
    if (this.cursorQueue.length === 0) return;

    if (this.cursorFlushTimer) {
      clearTimeout(this.cursorFlushTimer);
      this.cursorFlushTimer = null;
    }

    const positionsToSend = [...this.cursorQueue];
    this.cursorQueue = [];

    try {
      await this.recordCursorPositionsBatch(positionsToSend);
    } catch (error) {
      console.warn('Failed to flush cursor queue:', error);
    }
  }

  private flushQueueSync(): void {
    // Synchronous flush for beforeunload - use sendBeacon for reliability
    if (this.actionQueue.length === 0 || !this.sessionId) return;

    try {
      const actionsWithTimestamps = this.actionQueue.map(action => ({
        ...action,
        timestamp: action.timestamp || new Date().toISOString(),
      }));

      const payload = JSON.stringify({
        session_id: this.sessionId,
        actions: actionsWithTimestamps,
      });

      // Use sendBeacon for reliable delivery during page unload
      let success = true;
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        success = navigator.sendBeacon(
          `${BACKEND_API_URL}/analytics/actions/batch`,
          blob
        );
        
        if (!success) {
          console.error('Failed to send analytics via sendBeacon - lost actions:', {
            count: actionsWithTimestamps.length,
            actions: actionsWithTimestamps,
            sessionId: this.sessionId
          });
        }
      } else {
        // Fallback for older browsers - synchronous XMLHttpRequest (not ideal but necessary)
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BACKEND_API_URL}/analytics/actions/batch`, false); // sync
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
        
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('Failed to send analytics via XHR - lost actions:', {
            count: actionsWithTimestamps.length,
            actions: actionsWithTimestamps,
            sessionId: this.sessionId,
            status: xhr.status,
            statusText: xhr.statusText
          });
          success = false;
        }
      }

      if (success) {
        this.actionQueue = [];
      }
    } catch (error) {
      console.error('Failed to flush analytics queue on unload - lost actions:', {
        count: this.actionQueue.length,
        actions: this.actionQueue,
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private flushCursorQueueSync(): void {
    // Synchronous flush for beforeunload
    if (this.cursorQueue.length === 0 || !this.sessionId) return;

    try {
      const payload = JSON.stringify({
        session_id: this.sessionId,
        positions: this.cursorQueue,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(
          `${BACKEND_API_URL}/analytics/cursor-positions/batch`,
          blob
        );
      } else {
        // Fallback for older browsers
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BACKEND_API_URL}/analytics/cursor-positions/batch`, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
      }

      this.cursorQueue = [];
    } catch (error) {
      console.error('Failed to flush cursor queue on unload:', error);
    }
  }

  async flushPending(): Promise<void> {
    await this.flushActionsQueue();
    await this.flushCursorQueue();
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.actionQueue = [];
      this.cursorQueue = [];
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      if (this.cursorFlushTimer) {
        clearTimeout(this.cursorFlushTimer);
        this.cursorFlushTimer = null;
      }
      this.removeUnloadListeners();
    } else {
      this.setupUnloadListeners();
    }
  }

  isAnalyticsEnabled(): boolean {
    return this.isEnabled;
  }

  getQueueSize(): number {
    return this.actionQueue.length;
  }

  getCursorQueueSize(): number {
    return this.cursorQueue.length;
  }

  cleanup(): void {
    this.removeUnloadListeners();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.cursorFlushTimer) {
      clearTimeout(this.cursorFlushTimer);
      this.cursorFlushTimer = null;
    }
  }
}

export const analyticsService = new AnalyticsService();
