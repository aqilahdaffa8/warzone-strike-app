import { PlayerHealth } from '../player/PlayerHealth';
import { WeaponStats } from '../weapons/Sniper';
import { WeaponType } from '../weapons/Weapon';

export interface HUDCallbacks {
  onReloadRequested?: () => void;
  onResetAmmoRequested?: () => void;
  onResetDummiesRequested?: () => void;
  onSpawnEnemyRequested?: () => void;
  onClearEnemiesRequested?: () => void;
  onSwitchWeaponRequested?: (type: WeaponType) => void;
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

  // Weapon Slots & Name
  private readonly weaponNameText: HTMLElement | null;
  private readonly slotSniper: HTMLElement | null;
  private readonly slotKnife: HTMLElement | null;

  // Ammo & Reload
  private readonly ammoValueText: HTMLElement | null;
  private readonly reloadStatus: HTMLElement | null;
  private readonly reloadBarFill: HTMLElement | null;
  private readonly cooldownStatus: HTMLElement | null;
  private readonly cooldownBarFill: HTMLElement | null;

  // Stats
  private readonly statShotsFired: HTMLElement | null;
  private readonly statShotsHit: HTMLElement | null;
  private readonly statHeadshots: HTMLElement | null;
  private readonly statAccuracy: HTMLElement | null;
  private readonly statEnemiesCount: HTMLElement | null;
  private readonly damageVignette: HTMLElement | null;
  private previousHp: number = 100;
  private damageVignetteTimeout: number | null = null;

  // Debug Buttons
  private readonly debugSwitchSniperBtn: HTMLButtonElement | null;
  private readonly debugSwitchKnifeBtn: HTMLButtonElement | null;
  private readonly debugReloadBtn: HTMLButtonElement | null;
  private readonly debugResetAmmoBtn: HTMLButtonElement | null;
  private readonly debugResetDummiesBtn: HTMLButtonElement | null;
  private readonly debugSpawnEnemyBtn: HTMLButtonElement | null;
  private readonly debugClearEnemiesBtn: HTMLButtonElement | null;

  private unsubscribeHealth: (() => void) | null = null;
  private isCurrentlyScoped: boolean = false;
  private activeWeapon: WeaponType = 'sniper';

  constructor(health: PlayerHealth, callbacks?: HUDCallbacks) {
    this.root = document.querySelector<HTMLElement>('#hud');
    this.crosshair = document.querySelector<HTMLElement>('#crosshair');
    this.scopeOverlay = document.querySelector<HTMLElement>('#scope-overlay');

    this.healthBarFill = document.querySelector<HTMLElement>('#hud-health-fill');
    this.healthValueText = document.querySelector<HTMLElement>('#hud-health-val');
    this.debugDamageBtn = document.querySelector<HTMLButtonElement>('#btn-debug-damage');
    this.debugResetBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset');

    this.weaponNameText = document.querySelector<HTMLElement>('#hud-weapon-name');
    this.slotSniper = document.querySelector<HTMLElement>('#slot-sniper');
    this.slotKnife = document.querySelector<HTMLElement>('#slot-knife');

    this.ammoValueText = document.querySelector<HTMLElement>('#hud-ammo-val');
    this.reloadStatus = document.querySelector<HTMLElement>('#hud-reload-status');
    this.reloadBarFill = document.querySelector<HTMLElement>('#hud-reload-fill');
    this.cooldownStatus = document.querySelector<HTMLElement>('#hud-cooldown-status');
    this.cooldownBarFill = document.querySelector<HTMLElement>('#hud-cooldown-fill');

    this.statShotsFired = document.querySelector<HTMLElement>('#stat-shots-fired');
    this.statShotsHit = document.querySelector<HTMLElement>('#stat-shots-hit');
    this.statHeadshots = document.querySelector<HTMLElement>('#stat-headshots');
    this.statAccuracy = document.querySelector<HTMLElement>('#stat-accuracy');
    this.statEnemiesCount = document.querySelector<HTMLElement>('#stat-enemies-count');
    this.damageVignette = document.querySelector<HTMLElement>('#damage-vignette');
    this.previousHp = health.getHp();

    this.debugSwitchSniperBtn = document.querySelector<HTMLButtonElement>('#btn-debug-switch-sniper');
    this.debugSwitchKnifeBtn = document.querySelector<HTMLButtonElement>('#btn-debug-switch-knife');
    this.debugReloadBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reload');
    this.debugResetAmmoBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset-ammo');
    this.debugResetDummiesBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset-dummies');
    this.debugSpawnEnemyBtn = document.querySelector<HTMLButtonElement>('#btn-debug-spawn-enemy');
    this.debugClearEnemiesBtn = document.querySelector<HTMLButtonElement>('#btn-debug-clear-enemies');

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

    if (this.slotSniper && callbacks?.onSwitchWeaponRequested) {
      this.slotSniper.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('sniper');
      });
    }

    if (this.slotKnife && callbacks?.onSwitchWeaponRequested) {
      this.slotKnife.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('knife');
      });
    }

    if (this.debugSwitchSniperBtn && callbacks?.onSwitchWeaponRequested) {
      this.debugSwitchSniperBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('sniper');
      });
    }

    if (this.debugSwitchKnifeBtn && callbacks?.onSwitchWeaponRequested) {
      this.debugSwitchKnifeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('knife');
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

    if (this.debugSpawnEnemyBtn && callbacks?.onSpawnEnemyRequested) {
      this.debugSpawnEnemyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSpawnEnemyRequested!();
      });
    }

    if (this.debugClearEnemiesBtn && callbacks?.onClearEnemiesRequested) {
      this.debugClearEnemiesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onClearEnemiesRequested!();
      });
    }
  }

  private updateHealthDisplay(current: number, max: number): void {
    if (current < this.previousHp) {
      this.flashDamageVignette();
    }
    this.previousHp = current;

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

  private flashDamageVignette(): void {
    if (!this.damageVignette) return;
    this.damageVignette.style.opacity = '1';
    if (this.damageVignetteTimeout !== null) {
      window.clearTimeout(this.damageVignetteTimeout);
    }
    this.damageVignetteTimeout = window.setTimeout(() => {
      if (this.damageVignette) {
        this.damageVignette.style.opacity = '0';
      }
      this.damageVignetteTimeout = null;
    }, 180);
  }

  public getActiveWeapon(): WeaponType {
    return this.activeWeapon;
  }

  public setActiveWeapon(type: WeaponType): void {
    this.activeWeapon = type;
    if (this.slotSniper) {
      if (type === 'sniper') {
        this.slotSniper.classList.add('active');
      } else {
        this.slotSniper.classList.remove('active');
      }
    }

    if (this.slotKnife) {
      if (type === 'knife') {
        this.slotKnife.classList.add('active');
      } else {
        this.slotKnife.classList.remove('active');
      }
    }
  }

  public updateWeaponDisplay(
    weaponType: WeaponType,
    ammo: { inMag: number; reserve: number; maxMag: number } | null,
    stats: WeaponStats,
    isReloading: boolean,
    reloadProgress: number,
    isScoped: boolean,
    knifeCooldownProgress: number = 0,
    enemyCount: number = 0
  ): void {
    this.setActiveWeapon(weaponType);

    // 1. Weapon Label & Ammo Text
    if (weaponType === 'sniper') {
      if (this.weaponNameText) {
        this.weaponNameText.textContent = 'SNIPER RIFLE';
      }

      if (this.ammoValueText && ammo) {
        this.ammoValueText.textContent = `${ammo.inMag} / ${ammo.reserve}`;
        if (ammo.inMag === 0) {
          this.ammoValueText.style.color = '#f85149'; // Red when empty
        } else if (ammo.inMag <= 2) {
          this.ammoValueText.style.color = '#d29922'; // Orange warning
        } else {
          this.ammoValueText.style.color = '#f0f6fc'; // Normal
        }
      }

      // Reload progress bar
      if (this.reloadStatus && this.reloadBarFill) {
        if (isReloading) {
          this.reloadStatus.style.display = 'flex';
          this.reloadBarFill.style.width = `${Math.round(reloadProgress * 100)}%`;
        } else {
          this.reloadStatus.style.display = 'none';
          this.reloadBarFill.style.width = '0%';
        }
      }

      // Knife cooldown hidden for sniper
      if (this.cooldownStatus) {
        this.cooldownStatus.style.display = 'none';
      }

      // Scope overlay and crosshair toggle
      if (this.isCurrentlyScoped !== isScoped) {
        this.isCurrentlyScoped = isScoped;
        if (this.scopeOverlay) {
          this.scopeOverlay.style.display = isScoped ? 'block' : 'none';
        }
        if (this.crosshair) {
          this.crosshair.style.display = isScoped ? 'none' : 'block';
        }
      }
    } else {
      // Weapon is Knife
      if (this.weaponNameText) {
        this.weaponNameText.textContent = 'TACTICAL KNIFE';
      }

      if (this.ammoValueText) {
        this.ammoValueText.textContent = 'MELEE';
        this.ammoValueText.style.color = '#58a6ff';
      }

      // Reload status always hidden for knife
      if (this.reloadStatus) {
        this.reloadStatus.style.display = 'none';
      }

      // Scope overlay always hidden for knife
      if (this.isCurrentlyScoped) {
        this.isCurrentlyScoped = false;
        if (this.scopeOverlay) {
          this.scopeOverlay.style.display = 'none';
        }
        if (this.crosshair) {
          this.crosshair.style.display = 'block';
        }
      }

      // Knife attack cooldown bar
      if (this.cooldownStatus && this.cooldownBarFill) {
        if (knifeCooldownProgress > 0) {
          this.cooldownStatus.style.display = 'flex';
          this.cooldownBarFill.style.width = `${Math.round(knifeCooldownProgress * 100)}%`;
        } else {
          this.cooldownStatus.style.display = 'none';
          this.cooldownBarFill.style.width = '0%';
        }
      }
    }

    // 2. Statistics Readout
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
    if (this.statEnemiesCount) {
      this.statEnemiesCount.textContent = enemyCount.toString();
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
