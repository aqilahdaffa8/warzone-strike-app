export class LoadingScreen {
  private readonly containerEl: HTMLElement | null;
  private readonly fillEl: HTMLElement | null;
  private readonly percentEl: HTMLElement | null;
  private readonly statusEl: HTMLElement | null;
  private onCompleteCallback?: () => void;

  constructor() {
    this.containerEl = document.getElementById('loading-screen');
    this.fillEl = document.getElementById('loading-bar-fill');
    this.percentEl = document.getElementById('loading-percentage');
    this.statusEl = document.getElementById('loading-status-text');
  }

  public setOnComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
  }

  public show(): void {
    if (this.containerEl) {
      this.containerEl.style.display = 'flex';
      this.containerEl.style.opacity = '1';
    }
  }

  public hide(): void {
    if (this.containerEl) {
      this.containerEl.style.transition = 'opacity 0.4s ease-out';
      this.containerEl.style.opacity = '0';
      setTimeout(() => {
        if (this.containerEl) {
          this.containerEl.style.display = 'none';
        }
      }, 400);
    }
  }

  public startLoading(durationMs: number = 2200): Promise<void> {
    return new Promise((resolve) => {
      this.show();
      let startTime = performance.now();

      const statuses = [
        { at: 0, text: 'INITIALIZING TACTICAL SYSTEMS...' },
        { at: 25, text: 'LOADING GAME ASSETS & COMBAT MODULES...' },
        { at: 60, text: 'ESTABLISHING SECURE CONNECTION...' },
        { at: 85, text: 'SYNCHRONIZING OPERATIVE PROTOCOLS...' },
        { at: 100, text: 'SYSTEM READY' },
      ];

      const updateProgress = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(1.0, elapsed / durationMs);
        // Smooth ease-out quad curve
        const progress = Math.min(100, Math.floor(rawProgress * 100));

        if (this.fillEl) {
          this.fillEl.style.width = `${progress}%`;
        }
        if (this.percentEl) {
          this.percentEl.textContent = `${progress}%`;
        }

        if (this.statusEl) {
          for (let i = statuses.length - 1; i >= 0; i--) {
            if (progress >= statuses[i].at) {
              this.statusEl.textContent = statuses[i].text;
              break;
            }
          }
        }

        if (rawProgress < 1.0) {
          requestAnimationFrame(updateProgress);
        } else {
          // Reached 100%
          setTimeout(() => {
            this.hide();
            if (this.onCompleteCallback) {
              this.onCompleteCallback();
            }
            resolve();
          }, 350);
        }
      };

      requestAnimationFrame(updateProgress);
    });
  }
}
