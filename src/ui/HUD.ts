import { PlayerHealth } from '../player/PlayerHealth';
import { WeaponStats } from '../weapons/Sniper';

export interface HUDCallbacks {
  onReloadRequested?: () => void;
  onResetAmmoRequested?: () => void;
  onResetDummiesRequested?: () => void;
}

export class HUD {
  private readonly root: HTMLElement | null;
  private readonly crosshair: HTMLElement | null;
  private readonly scopeOverlay: HTMLElement | null;

  // Health
  private readonly healthBarFill: HTMLElement | null;
  private readonly healthValueText: HTMLElement | null;
  private readonly debugDamageBtn: HTMLButtonElement | null;
  private readonly debugResetBtn: HTMLButtonElement | null;

  // Ammo & Reload
  private readonly ammoValueText: HTMLElement | null;
  private readonly reloadStatus: HTMLElement | null;
  private readonly reloadBarFill: HTMLElement | null;

  // Stats
  private readonly statShotsFired: HTMLElement | null;
  private readonly statShotsHit: HTMLElement | null;
  private readonly statHeadshots: HTMLElement | null;
  private readonly statAccuracy: HTMLElement | null;

  // Debug Sniper Buttons
  private readonly debugReloadBtn: HTMLButtonElement | null;
  private readonly debugResetAmmoBtn: HTMLButtonElement | null;
  private readonly debugResetDummiesBtn: HTMLButtonElement | null;

  private unsubscribeHealth: (() => void) | null = null;
  private isCurrentlyScoped: boolean = false;

  constructor(health: PlayerHealth, callbacks?: HUDCallbacks) {
    this.root = document.querySelector<HTMLElement>('#hud');
    this.crosshair = document.querySelector<HTMLElement>('#crosshair');
    this.scopeOverlay = document.querySelector<HTMLElement>('#scope-overlay');

    this.healthBarFill = document.querySelector<HTMLElement>('#hud-health-fill');
    this.healthValueText = document.querySelector<HTMLElement>('#hud-health-val');
    this.debugDamageBtn = document.querySelector<HTMLButtonElement>('#btn-debug-damage');
    this.debugResetBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset');

    this.ammoValueText = document.querySelector<HTMLElement>('#hud-ammo-val');
    this.reloadStatus = document.querySelector<HTMLElement>('#hud-reload-status');
    this.reloadBarFill = document.querySelector<HTMLElement>('#hud-reload-fill');

    this.statShotsFired = document.querySelector<HTMLElement>('#stat-shots-fired');
    this.statShotsHit = document.querySelector<HTMLElement>('#stat-shots-hit');
    this.statHeadshots = document.querySelector<HTMLElement>('#stat-headshots');
    this.statAccuracy = document.querySelector<HTMLElement>('#stat-accuracy');

    this.debugReloadBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reload');
    this.debugResetAmmoBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset-ammo');
    this.debugResetDummiesBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset-dummies');

    this.setupListeners(health, callbacks);
  }

  private setupListeners(health: PlayerHealth, callbacks?: HUDCallbacks): void {
    this.unsubscribeHealth = health.onHealthChange((current, max) => {
      this.updateHealthDisplay(current, max);
    });

    if (this.debugDamageBtn) {
      this.debugDamageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        health.takeDamage(15);
      });
    }

    if (this.debugResetBtn) {
      this.debugResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        health.reset();
      });
    }

    if (this.debugReloadBtn && callbacks?.onReloadRequested) {
      this.debugReloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onReloadRequested!();
      });
    }

    if (this.debugResetAmmoBtn && callbacks?.onResetAmmoRequested) {
      this.debugResetAmmoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onResetAmmoRequested!();
      });
    }

    if (this.debugResetDummiesBtn && callbacks?.onResetDummiesRequested) {
      this.debugResetDummiesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onResetDummiesRequested!();
      });
    }
  }

  private updateHealthDisplay(current: number, max: number): void {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));

    if (this.healthBarFill) {
      this.healthBarFill.style.width = `${percentage}%`;

      if (percentage > 50) {
        this.healthBarFill.style.backgroundColor = '#2ea043'; // Green
      } else if (percentage > 25) {
        this.healthBarFill.style.backgroundColor = '#d29922'; // Warning orange
      } else {
        this.healthBarFill.style.backgroundColor = '#f85149'; // Critical red
      }
    }

    if (this.healthValueText) {
      this.healthValueText.textContent = `${current} / ${max}`;
    }
  }

  public updateWeaponState(
    ammo: { inMag: number; reserve: number; maxMag: number },
    stats: WeaponStats,
    isReloading: boolean,
    reloadProgress: number,
    isScoped: boolean
  ): void {
    // 1. Ammo value & styling
    if (this.ammoValueText) {
      this.ammoValueText.textContent = `${ammo.inMag} / ${ammo.reserve}`;
      if (ammo.inMag === 0) {
        this.ammoValueText.style.color = '#f85149'; // Red when empty
      } else if (ammo.inMag <= 2) {
        this.ammoValueText.style.color = '#d29922'; // Orange warning
      } else {
        this.ammoValueText.style.color = '#f0f6fc'; // Normal
      }
    }

    // 2. Reload progress bar
    if (this.reloadStatus && this.reloadBarFill) {
      if (isReloading) {
        this.reloadStatus.style.display = 'flex';
        this.reloadBarFill.style.width = `${Math.round(reloadProgress * 100)}%`;
      } else {
        this.reloadStatus.style.display = 'none';
        this.reloadBarFill.style.width = '0%';
      }
    }

    // 3. Scope overlay and crosshair toggle
    if (this.isCurrentlyScoped !== isScoped) {
      this.isCurrentlyScoped = isScoped;
      if (this.scopeOverlay) {
        this.scopeOverlay.style.display = isScoped ? 'block' : 'none';
      }
      if (this.crosshair) {
        this.crosshair.style.display = isScoped ? 'none' : 'block';
      }
    }

    // 4. Statistics Readout
    if (this.statShotsFired) {
      this.statShotsFired.textContent = stats.shotsFired.toString();
    }
    if (this.statShotsHit) {
      this.statShotsHit.textContent = stats.shotsHit.toString();
    }
    if (this.statHeadshots) {
      this.statHeadshots.textContent = stats.headshots.toString();
    }
    if (this.statAccuracy) {
      this.statAccuracy.textContent = `${stats.accuracy}%`;
    }
  }

  public show(): void {
    if (this.root) {
      this.root.style.display = 'block';
    }
  }

  public hide(): void {
    if (this.root) {
      this.root.style.display = 'none';
    }
    if (this.scopeOverlay) {
      this.scopeOverlay.style.display = 'none';
    }
  }

  public dispose(): void {
    if (this.unsubscribeHealth) {
      this.unsubscribeHealth();
      this.unsubscribeHealth = null;
    }
  }
}
