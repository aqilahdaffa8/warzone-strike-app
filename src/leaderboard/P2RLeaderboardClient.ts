import { LeaderboardClient, LeaderboardData, LeaderboardSubmissionResult, SpendCoinsResult } from './LeaderboardClient';
import { LeaderboardConfig } from '../config/gameConfig';
import { ScorePayload } from '../scoring/ScoreManager';
import { P2RPlayerIdentityProvider } from '../identity/P2RPlayerIdentityProvider';

interface CachedGameToken {
  token: string;
  expiresAt: number; // epoch ms
}

interface ActiveSession {
  sessionId: string;
  sessionToken: string;
}

export class P2RLeaderboardClient implements LeaderboardClient {
  private readonly config: LeaderboardConfig;
  private readonly playerProvider: P2RPlayerIdentityProvider;
  private cachedGameToken: CachedGameToken | null = null;
  private activeSession: ActiveSession | null = null;

  constructor(config: LeaderboardConfig, playerProvider: P2RPlayerIdentityProvider) {
    this.config = config;
    this.playerProvider = playerProvider;
  }

  /**
   * Start a gameplay session at the beginning of a run.
   * Only active if the player is logged in.
   */
  public async startSession(signal?: AbortSignal): Promise<ActiveSession | null> {
    const playerToken = this.playerProvider.getPlayerToken();
    if (!playerToken || !this.playerProvider.isLoggedIn()) {
      // Guest mode: do not create remote session
      this.activeSession = null;
      return null;
    }

    try {
      const gameToken = await this.getGameAccessToken(signal);
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const response = await fetch(`${this.config.apiBaseUrl}/games/${this.config.gameSlug}/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Game-Access-Token': gameToken,
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({
          platform: 'web',
          idempotency_key: idempotencyKey,
        }),
        signal,
      });

      const resData = await response.json().catch(() => null);

      if (!response.ok || !resData || !resData.success) {
        console.warn('[P2RLeaderboardClient] Failed to start remote session:', resData?.message);
        this.activeSession = null;
        return null;
      }

      this.activeSession = {
        sessionId: resData.data.session.id,
        sessionToken: resData.data.session_token,
      };

      return this.activeSession;
    } catch (err) {
      console.warn('[P2RLeaderboardClient] Error initiating game session:', err);
      this.activeSession = null;
      return null;
    }
  }

  /**
   * Submit the final score at Game Over.
   * If the player is a guest, returns local success without contacting the API.
   */
  public async submitScore(payload: ScorePayload, signal?: AbortSignal): Promise<LeaderboardSubmissionResult> {
    const playerToken = this.playerProvider.getPlayerToken();
    const isLoggedIn = this.playerProvider.isLoggedIn();

    // 1. Guest Mode: Safe local-only submission
    if (!isLoggedIn || !playerToken) {
      return {
        status: 'success',
        message: 'Score saved locally. Log in with a P2R account to submit to the global leaderboard.',
      };
    }

    // 2. Logged In Mode: Submit to P2R API
    try {
      const gameToken = await this.getGameAccessToken(signal);

      // If activeSession is missing (e.g. offline during start), try starting it now
      let session = this.activeSession;
      if (!session) {
        session = await this.startSession(signal);
      }

      if (!session) {
        return {
          status: 'failure',
          message: 'Unable to establish an authorized gameplay session with P2R server.',
        };
      }

      const response = await fetch(
        `${this.config.apiBaseUrl}/games/${this.config.gameSlug}/sessions/${session.sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Game-Access-Token': gameToken,
            Authorization: `Bearer ${playerToken}`,
          },
          body: JSON.stringify({
            session_token: session.sessionToken,
            best_score: payload.score,
            data: {
              kills: payload.kills,
              headshots: payload.headshots,
              bosses_defeated: payload.bossesKilled,
              wave_reached: payload.waveReached,
            },
          }),
          signal,
        }
      );

      const resData = await response.json().catch(() => null);

      // Clear session after submission attempt
      this.activeSession = null;

      if (!response.ok || !resData || !resData.success) {
        const errorMsg = resData?.message || `Submission failed with HTTP ${response.status}`;
        return {
          status: 'failure',
          message: errorMsg,
        };
      }

      return {
        status: 'success',
        message: 'Score successfully recorded to P2R Live Leaderboard!',
      };
    } catch (err: unknown) {
      this.activeSession = null;
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          status: 'timeout',
          message: 'Score submission timed out.',
        };
      }

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        status: isOffline ? 'offline' : 'failure',
        message: isOffline
          ? 'Network is offline. Your score is safely queued locally.'
          : (err instanceof Error ? err.message : 'Unknown network failure.'),
      };
    }
  }

  /**
   * Deducts player coins/points to start a game (like an arcade timezone token).
   * Calls POST /api/v1/games/warzone-strike/economy/spend
   */
  public async spendEntryCoins(amount: number = 100, signal?: AbortSignal): Promise<SpendCoinsResult> {
    const playerToken = this.playerProvider.getPlayerToken();
    if (!playerToken || !this.playerProvider.isLoggedIn()) {
      return {
        success: true,
        message: 'Guest mode: no entry coins required.',
      };
    }

    try {
      const gameToken = await this.getGameAccessToken(signal);
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `spend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const response = await fetch(`${this.config.apiBaseUrl}/games/${this.config.gameSlug}/economy/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Game-Access-Token': gameToken,
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({
          action_code: 'game_entry',
          idempotency_key: idempotencyKey,
        }),
        signal,
      });

      const resData = await response.json().catch(() => null);

      if (!response.ok || !resData || !resData.success) {
        const errorMsg = resData?.message || `Failed to spend coins (HTTP ${response.status})`;
        const isInsufficient =
          response.status === 422 &&
          (resData?.error === 'INSUFFICIENT_COIN' ||
            errorMsg.toLowerCase().includes('insufficient') ||
            errorMsg.toLowerCase().includes('lower than the required') ||
            errorMsg.toLowerCase().includes('balance'));

        return {
          success: false,
          insufficientCoins: isInsufficient,
          message: isInsufficient
            ? `⚠️ Poin tidak cukup! Butuh ${amount} PTS untuk bermain.`
            : errorMsg,
        };
      }

      return {
        success: true,
        amount: resData.data?.transaction?.amount ?? amount,
        balanceAfter: resData.data?.transaction?.balance_after,
        message: `Berhasil memotong ${amount} poin untuk memulai game.`,
      };
    } catch (err: unknown) {
      console.warn('[P2RLeaderboardClient] Error executing spendCoins:', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        success: false,
        message: isOffline
          ? 'Koneksi offline. Tidak dapat memverifikasi pemotongan poin akun.'
          : (err instanceof Error ? err.message : 'Gagal menghubungi server ekonomi.'),
      };
    }
  }

  /**
   * Retrieves current player coin balance from GET /api/v1/me/wallet
   */
  public async getWalletBalance(signal?: AbortSignal): Promise<number | null> {
    const playerToken = this.playerProvider.getPlayerToken();
    if (!playerToken || !this.playerProvider.isLoggedIn()) {
      return null;
    }

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/me/wallet`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        signal,
      });

      const resData = await response.json().catch(() => null);
      if (response.ok && resData && resData.success && resData.data) {
        return Number(resData.data.balance) ?? null;
      }
      return null;
    } catch (err) {
      console.warn('[P2RLeaderboardClient] Error fetching wallet:', err);
      return null;
    }
  }

  /**
   * Fetch public leaderboard entries.
   */
  public async fetchLeaderboard(limit: number = 20, offset: number = 0): Promise<LeaderboardData> {
    const playerToken = this.playerProvider.getPlayerToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (playerToken) {
      headers['Authorization'] = `Bearer ${playerToken}`;
    }

    try {
      const url = `${this.config.apiBaseUrl}/games/${this.config.gameSlug}/leaderboard?limit=${limit}&offset=${offset}`;
      const response = await fetch(url, { method: 'GET', headers });
      const resData = await response.json().catch(() => null);

      if (!response.ok || !resData || !resData.success) {
        throw new Error(resData?.message || `Failed to fetch leaderboard (HTTP ${response.status})`);
      }

      return {
        total_players: resData.data.total_players ?? 0,
        leaderboard: resData.data.leaderboard ?? [],
        my_rank: resData.data.my_rank ?? null,
      };
    } catch (err) {
      console.warn('[P2RLeaderboardClient] Error fetching leaderboard:', err);
      return {
        total_players: 0,
        leaderboard: [],
        my_rank: null,
      };
    }
  }

  /**
   * Obtains a short-lived Game Access Token (TTL: 15 min / 900s).
   * Refreshes when < 60 seconds remain.
   */
  private async getGameAccessToken(signal?: AbortSignal): Promise<string> {
    const now = Date.now();
    if (this.cachedGameToken && this.cachedGameToken.expiresAt - now > 60000) {
      return this.cachedGameToken.token;
    }

    const response = await fetch(`${this.config.apiBaseUrl}/games/${this.config.gameSlug}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        platform: 'web',
      }),
      signal,
    });

    const resData = await response.json().catch(() => null);

    if (!response.ok || !resData || !resData.success || !resData.data?.access_token) {
      throw new Error(resData?.message || 'Failed to obtain game access token.');
    }

    const token = resData.data.access_token;
    const expiresInSec = Number(resData.data.expires_in) || 900;
    this.cachedGameToken = {
      token,
      expiresAt: now + expiresInSec * 1000,
    };

    return token;
  }
}
