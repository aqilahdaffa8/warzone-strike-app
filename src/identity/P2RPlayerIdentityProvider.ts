import { PlayerIdentity, PlayerIdentityProvider } from './PlayerIdentityProvider';

const STORAGE_KEY = 'warzone-strike:p2r-player:v1';

export class P2RPlayerIdentityProvider implements PlayerIdentityProvider {
  private identity: PlayerIdentity;

  constructor() {
    this.identity = this.loadFromStorage();
  }

  public getIdentity(): PlayerIdentity {
    return this.identity;
  }

  public getPlayerToken(): string | null {
    return this.identity.token || null;
  }

  public isLoggedIn(): boolean {
    return !this.identity.isGuest && Boolean(this.identity.token);
  }

  public setPlayer(user: { id: number | string; name: string; email: string }, token: string): void {
    this.identity = {
      playerId: String(user.id),
      nickname: user.name,
      email: user.email,
      token,
      isGuest: false,
    };
    this.saveToStorage();
  }

  public logout(): void {
    this.identity = {
      playerId: `guest-${Math.random().toString(36).substring(2, 8)}`,
      nickname: 'Guest Operative',
      email: undefined,
      token: null,
      isGuest: true,
    };
    this.clearStorage();
  }

  public setGuestNickname(nickname: string): void {
    const trimmed = nickname.trim();
    if (trimmed) {
      this.identity.nickname = trimmed;
    }
    if (this.identity.isGuest) {
      this.saveToStorage();
    }
  }

  private loadFromStorage(): PlayerIdentity {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.nickname === 'string') {
            return {
              playerId: parsed.playerId || `guest-${Math.random().toString(36).substring(2, 8)}`,
              nickname: parsed.nickname,
              email: parsed.email,
              token: parsed.token || null,
              isGuest: Boolean(parsed.isGuest ?? !parsed.token),
            };
          }
        }
      }
    } catch (_) {
      // Local storage unavailable or failed parse
    }

    return {
      playerId: `guest-${Math.random().toString(36).substring(2, 8)}`,
      nickname: 'Guest Operative',
      token: null,
      isGuest: true,
    };
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.identity));
      }
    } catch (_) {
      // Ignore quota or private browsing errors
    }
  }

  private clearStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {
      // Ignore errors
    }
  }
}
