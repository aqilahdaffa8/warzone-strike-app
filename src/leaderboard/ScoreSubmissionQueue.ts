import { LeaderboardClient, LeaderboardSubmissionResult } from './LeaderboardClient';
import { ScorePayload } from '../scoring/ScoreManager';

interface QueueEntry {
  payload: ScorePayload;
  attempts: number;
  lastError?: string;
}

interface QueueStorageState {
  version: 1;
  entries: QueueEntry[];
  submittedSessionIds: string[];
}

export type QueueEnqueueStatus = 'queued' | 'already_queued' | 'already_submitted';

export interface QueueEnqueueResult {
  status: QueueEnqueueStatus;
  persisted: boolean;
}

export type QueueSubmissionStatus =
  | 'submitted'
  | 'already_submitted'
  | 'failed'
  | 'timeout'
  | 'offline'
  | 'storage_error';

export interface QueueSubmissionResult {
  status: QueueSubmissionStatus;
  message: string;
}

const STORAGE_KEY = 'warzone-strike:score-submission-queue:v1';

export class ScoreSubmissionQueue {
  private readonly storage: Storage | null;
  private state: QueueStorageState;
  private persisted: boolean;

  constructor() {
    this.storage = this.getStorage();
    this.state = this.loadState();
    this.persisted = this.storage !== null;
  }

  public enqueue(payload: ScorePayload): QueueEnqueueResult {
    if (this.isSubmitted(payload.sessionId)) {
      return { status: 'already_submitted', persisted: this.persisted };
    }

    if (this.state.entries.some((entry) => entry.payload.sessionId === payload.sessionId)) {
      return { status: 'already_queued', persisted: this.persisted };
    }

    this.state.entries.push({
      payload,
      attempts: 0,
    });

    const persisted = this.persistState();
    return { status: 'queued', persisted };
  }

  public getPending(): ScorePayload[] {
    return this.state.entries.map((entry) => entry.payload);
  }

  public getPendingCount(): number {
    return this.state.entries.length;
  }

  public isSubmitted(sessionId: string): boolean {
    return this.state.submittedSessionIds.includes(sessionId);
  }

  public async submit(
    payload: ScorePayload,
    client: LeaderboardClient,
    timeoutMs: number
  ): Promise<QueueSubmissionResult> {
    if (this.isSubmitted(payload.sessionId)) {
      return {
        status: 'already_submitted',
        message: 'This session has already been submitted and will not be resent.',
      };
    }

    const enqueueResult = this.enqueue(payload);
    if (enqueueResult.status === 'already_submitted') {
      return {
        status: 'already_submitted',
        message: 'This session has already been submitted and will not be resent.',
      };
    }

    try {
      const result = await this.submitWithTimeout(client, payload, timeoutMs);

      if (result.status === 'success') {
        this.markSubmitted(payload.sessionId);
        return {
          status: 'submitted',
          message: result.message,
        };
      }

      this.recordFailure(payload.sessionId, result.message);
      return {
        status: result.status === 'failure' ? 'failed' : result.status,
        message: result.message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed due to an unknown error.';
      this.recordFailure(payload.sessionId, message);
      return {
        status: 'failed',
        message,
      };
    }
  }

  public async retryAll(client: LeaderboardClient, timeoutMs: number): Promise<QueueSubmissionResult[]> {
    const pending = [...this.getPending()];
    const results: QueueSubmissionResult[] = [];

    for (const payload of pending) {
      results.push(await this.submit(payload, client, timeoutMs));
    }

    return results;
  }

  public isPersistenceAvailable(): boolean {
    return this.storage !== null && this.persisted;
  }

  private async submitWithTimeout(
    client: LeaderboardClient,
    payload: ScorePayload,
    timeoutMs: number
  ): Promise<LeaderboardSubmissionResult> {
    const controller = new AbortController();

    return new Promise<LeaderboardSubmissionResult>((resolve, reject) => {
      let settled = false;

      const timeoutId = window.setTimeout(() => {
        if (settled) return;

        settled = true;
        controller.abort();

        resolve({
          status: 'timeout',
          message: `Submission timeout setelah ${timeoutMs} ms.`,
        });
      }, timeoutMs);

      client.submitScore(payload, controller.signal)
        .then((result) => {
          if (settled) return;

          settled = true;
          window.clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          if (settled) return;

          settled = true;
          window.clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private markSubmitted(sessionId: string): void {
    if (!this.state.submittedSessionIds.includes(sessionId)) {
      this.state.submittedSessionIds.push(sessionId);
    }

    this.state.entries = this.state.entries.filter((entry) => entry.payload.sessionId !== sessionId);
    this.persistState();
  }

  private recordFailure(sessionId: string, message: string): void {
    const entry = this.state.entries.find((candidate) => candidate.payload.sessionId === sessionId);
    if (!entry) return;

    entry.attempts += 1;
    entry.lastError = message;
    this.persistState();
  }

  private getStorage(): Storage | null {
    try {
      return window.localStorage;
    } catch (_) {
      return null;
    }
  }

  private loadState(): QueueStorageState {
    const fallback: QueueStorageState = {
      version: 1,
      entries: [],
      submittedSessionIds: [],
    };

    if (!this.storage) {
      return fallback;
    }

    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return fallback;

      const parsed: unknown = JSON.parse(raw);
      if (!this.isQueueStorageState(parsed)) {
        return fallback;
      }

      return parsed;
    } catch (_) {
      return fallback;
    }
  }

  private persistState(): boolean {
    if (!this.storage) {
      this.persisted = false;
      return false;
    }

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.persisted = true;
      return true;
    } catch (_) {
      this.persisted = false;
      return false;
    }
  }

  private isQueueStorageState(value: unknown): value is QueueStorageState {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Partial<QueueStorageState>;
    if (candidate.version !== 1) return false;
    if (!Array.isArray(candidate.entries) || !Array.isArray(candidate.submittedSessionIds)) return false;
    if (!candidate.entries.every((entry) => this.isQueueEntry(entry))) return false;
    return candidate.submittedSessionIds.every((sessionId) => typeof sessionId === 'string');
  }

  private isQueueEntry(value: unknown): value is QueueEntry {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Partial<QueueEntry>;
    return this.isScorePayload(candidate.payload) && typeof candidate.attempts === 'number';
  }

  private isScorePayload(value: unknown): value is ScorePayload {
    if (!value || typeof value !== 'object') return false;

    const payload = value as Partial<ScorePayload>;
    return (
      typeof payload.gameId === 'string' &&
      typeof payload.playerId === 'string' &&
      typeof payload.nickname === 'string' &&
      typeof payload.sessionId === 'string' &&
      typeof payload.score === 'number' &&
      typeof payload.waveReached === 'number' &&
      typeof payload.bossesKilled === 'number' &&
      typeof payload.kills === 'number' &&
      typeof payload.headshots === 'number' &&
      typeof payload.accuracy === 'number' &&
      typeof payload.durationSeconds === 'number' &&
      typeof payload.timestamp === 'string'
    );
  }
}
