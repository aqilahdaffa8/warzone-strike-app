import { LeaderboardClient, LeaderboardSubmissionResult } from './LeaderboardClient';
import { MockLeaderboardMode, LeaderboardConfig } from '../config/gameConfig';
import { ScorePayload } from '../scoring/ScoreManager';

export class MockLeaderboardClient implements LeaderboardClient {
  private readonly config: LeaderboardConfig;

  constructor(config: LeaderboardConfig) {
    this.config = config;
  }

  public async submitScore(_payload: ScorePayload, signal?: AbortSignal): Promise<LeaderboardSubmissionResult> {
    const mode: MockLeaderboardMode = this.getMode();

    switch (mode) {
      case 'success':
        return {
          status: 'success',
          message: 'Score successfully submitted to mock leaderboard.',
        };

      case 'failure':
        return {
          status: 'failure',
          message: 'Mock leaderboard rejected submission.',
        };

      case 'offline':
        return {
          status: 'offline',
          message: 'Mock leaderboard is currently offline.',
        };

      case 'timeout':
        await this.delay(this.config.submissionTimeoutMs + 1000, signal);
        return {
          status: 'timeout',
          message: 'Mock leaderboard responded after timeout.',
        };
    }
  }

  private getMode(): MockLeaderboardMode {
    try {
      const override = window.localStorage.getItem('warzone-strike:mock-leaderboard-mode');
      if (override === 'success' || override === 'failure' || override === 'timeout' || override === 'offline') {
        return override;
      }
    } catch (_) {
      // Fall back to the configured mode when localStorage is unavailable.
    }

    return this.config.mockMode;
  }

  private delay(durationMs: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Submission cancelled.', 'AbortError'));
        return;
      }

      const timer = window.setTimeout(() => {
        signal?.removeEventListener('abort', handleAbort);
        resolve();
      }, durationMs);

      const handleAbort = (): void => {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', handleAbort);
        reject(new DOMException('Submission cancelled.', 'AbortError'));
      };

      signal?.addEventListener('abort', handleAbort, { once: true });
    });
  }
}
