import { ScorePayload } from '../scoring/ScoreManager';

export type LeaderboardSubmissionStatus = 'success' | 'failure' | 'timeout' | 'offline' | 'already_submitted';

export interface LeaderboardSubmissionResult {
  status: LeaderboardSubmissionStatus;
  message: string;
}

export interface LeaderboardPlayerEntry {
  result_id?: string;
  session_id?: string;
  rank: number;
  player: {
    id: number | string;
    name: string;
  };
  score: number;
  best_score?: number;
  data?: {
    kills?: number;
    headshots?: number;
    bosses_defeated?: number;
    wave_reached?: number;
  } | unknown[];
  submitted_at?: string;
}

export interface LeaderboardData {
  total_players: number;
  leaderboard: LeaderboardPlayerEntry[];
  my_rank?: {
    rank: number;
    score: number;
    best_score: number;
    submitted_at?: string;
  } | null;
}

export interface SpendCoinsResult {
  success: boolean;
  message: string;
  amount?: number;
  balanceAfter?: number;
  insufficientCoins?: boolean;
}

export interface LeaderboardClient {
  submitScore(payload: ScorePayload, signal?: AbortSignal): Promise<LeaderboardSubmissionResult>;
  fetchLeaderboard?(limit?: number, offset?: number): Promise<LeaderboardData>;
  spendEntryCoins?(amount?: number, signal?: AbortSignal): Promise<SpendCoinsResult>;
  getWalletBalance?(signal?: AbortSignal): Promise<number | null>;
}
