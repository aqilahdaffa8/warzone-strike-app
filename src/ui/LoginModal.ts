import { P2RAuthService } from '../identity/P2RAuthService';
import { P2RPlayerIdentityProvider } from '../identity/P2RPlayerIdentityProvider';

export class LoginModal {
  private readonly modalEl: HTMLElement | null;
  private readonly formEl: HTMLFormElement | null;
  private readonly emailInput: HTMLInputElement | null;
  private readonly passwordInput: HTMLInputElement | null;
  private readonly statusEl: HTMLElement | null;
  private readonly submitBtn: HTMLButtonElement | null;
  private readonly cancelBtn: HTMLButtonElement | null;

  // Lobby Account Bar elements
  private readonly badgeEl: HTMLElement | null;
  private readonly nameEl: HTMLElement | null;
  private readonly pointsEl: HTMLElement | null;
  private readonly accountActionBtn: HTMLButtonElement | null;

  private readonly authService: P2RAuthService;
  private readonly identityProvider: P2RPlayerIdentityProvider;
  private onAuthChangedCallback?: () => void;
  private onDismissCallback?: () => void;

  constructor(authService: P2RAuthService, identityProvider: P2RPlayerIdentityProvider) {
    this.authService = authService;
    this.identityProvider = identityProvider;

    this.modalEl = document.getElementById('login-modal');
    this.formEl = document.getElementById('p2r-login-form') as HTMLFormElement | null;
    this.emailInput = document.getElementById('login-email') as HTMLInputElement | null;
    this.passwordInput = document.getElementById('login-password') as HTMLInputElement | null;
    this.statusEl = document.getElementById('login-status-msg');
    this.submitBtn = document.getElementById('btn-login-submit') as HTMLButtonElement | null;
    this.cancelBtn = document.getElementById('btn-login-cancel') as HTMLButtonElement | null;

    this.badgeEl = document.getElementById('lobby-account-badge');
    this.nameEl = document.getElementById('lobby-account-name');
    this.pointsEl = document.getElementById('lobby-account-points');
    this.accountActionBtn = document.getElementById('btn-open-login') as HTMLButtonElement | null;

    this.setupListeners();
    this.updateAccountBar();
  }

  public setPoints(points: number | null): void {
    const isLoggedIn = this.identityProvider.isLoggedIn();
    if (this.pointsEl) {
      if (!isLoggedIn) {
        this.pointsEl.style.display = 'none';
      } else {
        const val = points !== null ? points : 0;
        this.pointsEl.textContent = `🪙 ${val} COINS`;
        this.pointsEl.style.display = 'inline-block';
      }
    }
  }

  public setOnAuthChanged(cb: () => void): void {
    this.onAuthChangedCallback = cb;
  }

  public setOnDismiss(cb: () => void): void {
    this.onDismissCallback = cb;
  }

  public open(): void {
    if (!this.modalEl) return;
    this.clearStatus();
    if (this.passwordInput) {
      this.passwordInput.value = '';
    }
    this.modalEl.style.display = 'flex';
    this.emailInput?.focus();
  }

  public close(): void {
    if (!this.modalEl) return;
    this.modalEl.style.display = 'none';
  }

  public updateAccountBar(): void {
    const isLoggedIn = this.identityProvider.isLoggedIn();
    const identity = this.identityProvider.getIdentity();

    if (this.badgeEl) {
      if (isLoggedIn) {
        this.badgeEl.textContent = 'P2R VERIFIED';
        this.badgeEl.className = 'account-badge verified';
      } else {
        this.badgeEl.textContent = 'GUEST';
        this.badgeEl.className = 'account-badge guest';
      }
    }

    if (this.nameEl) {
      this.nameEl.textContent = isLoggedIn ? identity.nickname : 'Guest Operative (Offline)';
    }

    if (this.pointsEl) {
      this.pointsEl.style.display = isLoggedIn ? 'inline-block' : 'none';
    }

    if (this.accountActionBtn) {
      if (isLoggedIn) {
        this.accountActionBtn.textContent = 'LOGOUT';
        this.accountActionBtn.classList.add('logout');
      } else {
        this.accountActionBtn.textContent = 'LOGIN P2R';
        this.accountActionBtn.classList.remove('logout');
      }
    }
  }

  private setupListeners(): void {
    if (this.accountActionBtn) {
      this.accountActionBtn.addEventListener('click', () => {
        if (this.identityProvider.isLoggedIn()) {
          this.identityProvider.logout();
          this.updateAccountBar();
          if (this.onAuthChangedCallback) {
            this.onAuthChangedCallback();
          }
        } else {
          this.open();
        }
      });
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => {
        this.close();
        if (this.onDismissCallback) {
          this.onDismissCallback();
        }
      });
    }

    if (this.formEl) {
      this.formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLoginSubmit();
      });
    }
  }

  private async handleLoginSubmit(): Promise<void> {
    const email = this.emailInput?.value.trim() || '';
    const password = this.passwordInput?.value || '';

    if (!email || !password) {
      this.showStatus('Please enter both email and password.', 'error');
      return;
    }

    this.setLoading(true);
    this.showStatus('Authenticating with P2R server...', 'info');

    const result = await this.authService.login(email, password);

    this.setLoading(false);

    if (!result.success || !result.user || !result.token) {
      this.showStatus(result.message || 'Authentication failed.', 'error');
      return;
    }

    this.identityProvider.setPlayer(result.user, result.token);
    this.updateAccountBar();
    if (this.onAuthChangedCallback) {
      this.onAuthChangedCallback();
    }
    this.close();
    if (this.onDismissCallback) {
      this.onDismissCallback();
    }
  }

  private setLoading(loading: boolean): void {
    if (this.submitBtn) {
      this.submitBtn.disabled = loading;
      this.submitBtn.textContent = loading ? 'AUTHENTICATING...' : 'LOGIN & SYNC';
    }
  }

  private showStatus(msg: string, type: 'error' | 'info'): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.className = `login-status-msg ${type}`;
  }

  private clearStatus(): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = '';
    this.statusEl.className = 'login-status-msg';
  }
}
