import { ScorePayload } from '../scoring/ScoreManager';

export type LeaderboardSubmissionStatus = 'success' | 'failure' | 'timeout' | 'offline' | 'already_submitted';

export interface LeaderboardSubmissionResult {
  status: LeaderboardSubmissionStatus;
  message: string;
}

export interface LeaderboardClient {
  submitScore(payload: ScorePayload, signal?: AbortSignal): Promise<LeaderboardSubmissionResult>;
}
