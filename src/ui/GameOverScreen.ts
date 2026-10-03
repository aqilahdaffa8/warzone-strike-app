export interface GameOverStats {
  score: number;
  waveReached: number;
  enemiesDefeated: number;
  bossesKilled: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  accuracy: number;
  durationSeconds: number;
  sessionId?: string;
  isVictory?: boolean;
}

export class GameOverScreen {
  private readonly overlay: HTMLElement | null;
  private readonly cardEl: HTMLElement | null;
  private readonly titleEl: HTMLElement | null;
  private readonly subtitleEl: HTMLElement | null;
  private readonly scoreValEl: HTMLElement | null;
  private readonly waveValEl: HTMLElement | null;
  private readonly durationValEl: HTMLElement | null;
  private readonly killsValEl: HTMLElement | null;
  private readonly bossesValEl: HTMLElement | null;
  private readonly headshotsValEl: HTMLElement | null;
  private readonly accuracyValEl: HTMLElement | null;
  private readonly shotsValEl: HTMLElement | null;
  private readonly sessionValEl: HTMLElement | null;
  private readonly restartBtn: HTMLButtonElement | null;

  private onRestartCallback: (() => void) | null = null;

  constructor() {
    this.overlay = document.querySelector<HTMLElement>('#game-over-overlay');
    this.cardEl = document.querySelector<HTMLElement>('#game-over-card');
    this.titleEl = document.querySelector<HTMLElement>('#go-title');
    this.subtitleEl = document.querySelector<HTMLElement>('#go-subtitle');
    this.scoreValEl = document.querySelector<HTMLElement>('#go-stat-score');
    this.waveValEl = document.querySelector<HTMLElement>('#go-stat-wave');
    this.durationValEl = document.querySelector<HTMLElement>('#go-stat-duration');
    this.killsValEl = document.querySelector<HTMLElement>('#go-stat-kills');
    this.bossesValEl = document.querySelector<HTMLElement>('#go-stat-bosses');
    this.headshotsValEl = document.querySelector<HTMLElement>('#go-stat-headshots');
    this.accuracyValEl = document.querySelector<HTMLElement>('#go-stat-accuracy');
    this.shotsValEl = document.querySelector<HTMLElement>('#go-stat-shots');
    this.sessionValEl = document.querySelector<HTMLElement>('#go-stat-session');
    this.restartBtn = document.querySelector<HTMLButtonElement>('#btn-restart-game');

    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onRestartCallback) {
          this.onRestartCallback();
        }
      });
    }
  }

  public setOnRestart(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  private formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public show(stats: GameOverStats): void {
    const isVictory = !!stats.isVictory;

    // 1. Victory vs Defeat Styling
    if (this.cardEl) {
      if (isVictory) {
        this.cardEl.classList.add('victory');
      } else {
        this.cardEl.classList.remove('victory');
      }
    }

    if (this.titleEl) {
      this.titleEl.textContent = isVictory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
      this.titleEl.style.color = isVictory ? '#3fb950' : '#f85149';
    }

    if (this.subtitleEl) {
      this.subtitleEl.textContent = isVictory
        ? 'Apex Warlords Neutralized — All 15 Warzone Waves Survived!'
        : 'Operator K.I.A. — Critical Vital Signs Terminated';
    }

    if (this.restartBtn) {
      if (isVictory) {
        this.restartBtn.className = 'btn-success';
        this.restartBtn.textContent = 'REDEPLOY AGAIN';
      } else {
        this.restartBtn.className = 'btn-danger';
        this.restartBtn.textContent = 'REDEPLOY / PLAY AGAIN';
      }
    }

    // 2. Populate Numeric Stats
    if (this.scoreValEl) this.scoreValEl.textContent = stats.score.toLocaleString();
    if (this.waveValEl) this.waveValEl.textContent = `${stats.waveReached} / 15`;
    if (this.durationValEl) this.durationValEl.textContent = this.formatTime(stats.durationSeconds);
    if (this.killsValEl) this.killsValEl.textContent = `${stats.enemiesDefeated}`;
    if (this.bossesValEl) this.bossesValEl.textContent = `${stats.bossesKilled}`;
    if (this.headshotsValEl) this.headshotsValEl.textContent = `${stats.headshots}`;
    if (this.accuracyValEl) this.accuracyValEl.textContent = `${stats.accuracy.toFixed(1)}%`;
    if (this.shotsValEl) this.shotsValEl.textContent = `${stats.shotsFired}`;
    if (this.sessionValEl) this.sessionValEl.textContent = stats.sessionId || '-';

    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
  }

  public hide(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  public dispose(): void {
    // cleanup
  }
}
