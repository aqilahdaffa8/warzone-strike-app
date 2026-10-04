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
  onSkipWaveRequested?: () => void;
  onSpawnBossRequested?: () => void;
  onThrowGrenadeRequested?: () => void;
  onClaimRewardRequested?: () => void;
}

interface RadarPosition {
  x: number;
  z: number;
}

const RADAR_RANGE = 30;
const RADAR_SIZE = 168;

export class HUD {
  private readonly root: HTMLElement | null;
  private readonly crosshair: HTMLElement | null;
  private readonly hitmarkerEl: HTMLElement | null;
  private hitmarkerTimeout: number | null = null;
  private readonly damageIndicatorArrow: HTMLElement | null;
  private damageIndicatorTimeout: number | null = null;
  private readonly staminaBar: HTMLElement | null;
  private readonly staminaBarFill: HTMLElement | null;
  private readonly radarCanvas: HTMLCanvasElement | null;
  private readonly radarContext: CanvasRenderingContext2D | null;
  private readonly scopeOverlay: HTMLElement | null;

  // Wave & Intermission Elements
  private readonly waveBadgeText: HTMLElement | null;
  private readonly waveEnemiesText: HTMLElement | null;
  private readonly scoreValEl: HTMLElement | null;
  private readonly scorePopupEl: HTMLElement | null;
  private scorePopupTimeout: number | null = null;
  private readonly intermissionBanner: HTMLElement | null;
  private readonly intermissionTimerText: HTMLElement | null;
  private readonly claimRewardBtn: HTMLButtonElement | null;
  private readonly rewardNoticeEl: HTMLElement | null;
  private readonly rewardNoticeText: HTMLElement | null;
  private readonly toastContainer: HTMLElement | null;

  // Boss Health Bar Elements
  private readonly bossContainer: HTMLElement | null;
  private readonly bossNameText: HTMLElement | null;
  private readonly bossHpValText: HTMLElement | null;
  private readonly bossHpFill: HTMLElement | null;

  // Health
  private readonly healthBarFill: HTMLElement | null;
  private readonly healthValueText: HTMLElement | null;
  private readonly debugDamageBtn: HTMLButtonElement | null;
  private readonly debugResetBtn: HTMLButtonElement | null;

  // Weapon Slots & Name
  private readonly weaponNameText: HTMLElement | null;
  private readonly slotSniper: HTMLElement | null;
  private readonly slotKnife: HTMLElement | null;
  private readonly slotBazooka: HTMLElement | null;
  private readonly slotAkm: HTMLElement | null;
  private readonly slotM4: HTMLElement | null;
  private readonly slotGrenade: HTMLElement | null;
  private readonly slotGrenadeText: HTMLElement | null;
  private readonly supplyPrompt: HTMLElement | null;
  private readonly slot1Name: HTMLElement | null;
  private readonly slot1Ammo: HTMLElement | null;
  private readonly slot3Ammo: HTMLElement | null;
  private readonly slot3Name: HTMLElement | null;
  private readonly grenadeCountEl: HTMLElement | null;
  private primarySlotWeapon: 'sniper' | 'akm' | 'm4' = 'sniper';

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
  private readonly debugSwitchBazookaBtn: HTMLButtonElement | null;
  private readonly debugReloadBtn: HTMLButtonElement | null;
  private readonly debugResetAmmoBtn: HTMLButtonElement | null;
  private readonly debugResetDummiesBtn: HTMLButtonElement | null;
  private readonly debugSkipWaveBtn: HTMLButtonElement | null;
  private readonly debugSpawnBossBtn: HTMLButtonElement | null;
  private readonly debugSpawnEnemyBtn: HTMLButtonElement | null;
  private readonly debugClearEnemiesBtn: HTMLButtonElement | null;
  private readonly debugThrowGrenadeBtn: HTMLButtonElement | null;
  private readonly debugClaimSuppliesBtn: HTMLButtonElement | null;

  private unsubscribeHealth: (() => void) | null = null;
  private isCurrentlyScoped: boolean = false;
  private activeWeapon: WeaponType = 'sniper';

  constructor(health: PlayerHealth, callbacks?: HUDCallbacks) {
    this.root = document.querySelector<HTMLElement>('#hud');
    this.crosshair = document.querySelector<HTMLElement>('#crosshair');
    this.hitmarkerEl = document.querySelector<HTMLElement>('#hitmarker');
    this.damageIndicatorArrow = document.querySelector<HTMLElement>('#damage-indicator-arrow');
    this.staminaBar = document.querySelector<HTMLElement>('#hud-stamina');
    this.staminaBarFill = document.querySelector<HTMLElement>('#hud-stamina-fill');
    this.radarCanvas = document.querySelector<HTMLCanvasElement>('#hud-radar');
    this.radarContext = this.radarCanvas?.getContext('2d') ?? null;
    this.scopeOverlay = document.querySelector<HTMLElement>('#scope-overlay');

    this.waveBadgeText = document.querySelector<HTMLElement>('#hud-wave-text');
    this.waveEnemiesText = document.querySelector<HTMLElement>('#hud-wave-enemies-text');
    this.scoreValEl = document.querySelector<HTMLElement>('#hud-score-val');
    this.scorePopupEl = document.querySelector<HTMLElement>('#hud-score-popup');
    this.intermissionBanner = document.querySelector<HTMLElement>('#hud-intermission-banner');
    this.intermissionTimerText = document.querySelector<HTMLElement>('#hud-intermission-val');
    this.claimRewardBtn = document.querySelector<HTMLButtonElement>('#btn-claim-reward');
    this.rewardNoticeEl = document.querySelector<HTMLElement>('#hud-reward-notice');
    this.rewardNoticeText = document.querySelector<HTMLElement>('#hud-reward-notice-text');
    this.toastContainer = document.querySelector<HTMLElement>('#hud-toast-container');
    this.supplyPrompt = document.querySelector<HTMLElement>('#hud-supply-prompt');

    this.bossContainer = document.querySelector<HTMLElement>('#hud-boss-container');
    this.bossNameText = document.querySelector<HTMLElement>('#hud-boss-name');
    this.bossHpValText = document.querySelector<HTMLElement>('#hud-boss-hp-val');
    this.bossHpFill = document.querySelector<HTMLElement>('#hud-boss-hp-fill');

    this.healthBarFill = document.querySelector<HTMLElement>('#hud-health-fill');
    this.healthValueText = document.querySelector<HTMLElement>('#hud-health-val');
    this.debugDamageBtn = document.querySelector<HTMLButtonElement>('#btn-debug-damage');
    this.debugResetBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset');

    this.weaponNameText = document.querySelector<HTMLElement>('#hud-weapon-name');
    this.slotSniper = document.querySelector<HTMLElement>('#slot-sniper');
    this.slot1Name = document.querySelector<HTMLElement>('#slot-1-name');
    this.slot1Ammo = document.querySelector<HTMLElement>('#slot-1-ammo');
    this.slotKnife = document.querySelector<HTMLElement>('#slot-knife');
    this.slotBazooka = document.querySelector<HTMLElement>('#slot-bazooka');
    this.slotAkm = document.querySelector<HTMLElement>('#slot-akm');
    this.slotM4 = document.querySelector<HTMLElement>('#slot-m4');
    this.slotGrenade = document.querySelector<HTMLElement>('#slot-grenade');
    this.slotGrenadeText = document.querySelector<HTMLElement>('#slot-grenade-text');
    this.slot3Ammo = document.querySelector<HTMLElement>('#slot-3-ammo');
    this.slot3Name = document.querySelector<HTMLElement>('#slot-3-name');
    this.grenadeCountEl = document.querySelector<HTMLElement>('#hud-grenade-count');

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
    this.debugSwitchBazookaBtn = document.querySelector<HTMLButtonElement>('#btn-debug-switch-bazooka');
    this.debugReloadBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reload');
    this.debugResetAmmoBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset-ammo');
    this.debugResetDummiesBtn = document.querySelector<HTMLButtonElement>('#btn-debug-reset-dummies');
    this.debugSkipWaveBtn = document.querySelector<HTMLButtonElement>('#btn-debug-skip-wave');
    this.debugSpawnBossBtn = document.querySelector<HTMLButtonElement>('#btn-debug-spawn-boss');
    this.debugSpawnEnemyBtn = document.querySelector<HTMLButtonElement>('#btn-debug-spawn-enemy');
    this.debugClearEnemiesBtn = document.querySelector<HTMLButtonElement>('#btn-debug-clear-enemies');
    this.debugThrowGrenadeBtn = document.querySelector<HTMLButtonElement>('#btn-debug-throw-grenade');
    this.debugClaimSuppliesBtn = document.querySelector<HTMLButtonElement>('#btn-debug-claim-supplies');

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
        callbacks.onSwitchWeaponRequested!(this.primarySlotWeapon);
      });
    }

    if (this.slotKnife && callbacks?.onSwitchWeaponRequested) {
      this.slotKnife.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('knife');
      });
    }

    if (this.slotBazooka && callbacks?.onSwitchWeaponRequested) {
      this.slotBazooka.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('bazooka');
      });
    }

    if (this.slotAkm && callbacks?.onSwitchWeaponRequested) {
      this.slotAkm.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('akm');
      });
    }

    if (this.slotM4 && callbacks?.onSwitchWeaponRequested) {
      this.slotM4.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('m4');
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

    if (this.debugSwitchBazookaBtn && callbacks?.onSwitchWeaponRequested) {
      this.debugSwitchBazookaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSwitchWeaponRequested!('bazooka');
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

    if (this.debugSkipWaveBtn && callbacks?.onSkipWaveRequested) {
      this.debugSkipWaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSkipWaveRequested!();
      });
    }

    if (this.debugSpawnBossBtn && callbacks?.onSpawnBossRequested) {
      this.debugSpawnBossBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSpawnBossRequested!();
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

    if (this.claimRewardBtn && callbacks?.onClaimRewardRequested) {
      this.claimRewardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onClaimRewardRequested!();
      });
    }

    if (this.debugClaimSuppliesBtn && callbacks?.onClaimRewardRequested) {
      this.debugClaimSuppliesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onClaimRewardRequested!();
      });
    }

    if (this.debugThrowGrenadeBtn && callbacks?.onThrowGrenadeRequested) {
      this.debugThrowGrenadeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onThrowGrenadeRequested!();
      });
    }

    if (this.slotGrenade && callbacks?.onThrowGrenadeRequested) {
      this.slotGrenade.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onThrowGrenadeRequested!();
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
    const isPrimary = type === 'sniper' || type === 'akm' || type === 'm4';

    if (this.slotSniper) {
      this.slotSniper.classList.toggle('active', isPrimary);
    }
    if (this.slotKnife) {
      this.slotKnife.classList.toggle('active', type === 'knife');
    }
    if (this.slotBazooka) {
      this.slotBazooka.classList.toggle('active', type === 'bazooka');
    }
    if (this.slotGrenade) {
      this.slotGrenade.classList.toggle('active', type === 'grenade');
    }
  }

  public setBazookaUnlocked(unlocked: boolean): void {
    if (this.slotBazooka) {
      this.slotBazooka.style.display = unlocked ? 'flex' : 'none';
      this.slotBazooka.classList.remove('locked');
    }
    if (this.slot3Name) {
      this.slot3Name.textContent = 'RPG-7';
    }
  }

  public setPrimarySlotWeapon(type: 'sniper' | 'akm' | 'm4'): void {
    this.primarySlotWeapon = type;
    if (this.slot1Name) {
      this.slot1Name.textContent = type === 'sniper' ? 'SNIPER' : type === 'akm' ? 'AKM' : 'M4';
    }
  }

  public setSupplyInteractionAvailable(available: boolean): void {
    if (this.supplyPrompt) {
      this.supplyPrompt.style.display = available ? 'flex' : 'none';
    }
  }

  public setAkmUnlocked(_unlocked: boolean): void {
    if (this.slotAkm) this.slotAkm.style.display = 'none';
  }

  public setM4Unlocked(_unlocked: boolean): void {
    if (this.slotM4) this.slotM4.style.display = 'none';
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
    } else if (weaponType === 'bazooka') {
      // Weapon is RPG-7 Bazooka
      if (this.weaponNameText) {
        this.weaponNameText.textContent = 'RPG-7 BAZOOKA';
      }

      if (this.ammoValueText && ammo) {
        this.ammoValueText.textContent = `${ammo.inMag} / ${ammo.reserve}`;
        if (ammo.inMag === 0 && ammo.reserve === 0) {
          this.ammoValueText.style.color = '#f85149';
        } else if (ammo.inMag === 0) {
          this.ammoValueText.style.color = '#d29922';
        } else {
          this.ammoValueText.style.color = '#e3b341'; // Golden explosive ammo
        }
      }

      // Reload progress bar for rocket reload
      if (this.reloadStatus && this.reloadBarFill) {
        if (isReloading) {
          this.reloadStatus.style.display = 'flex';
          this.reloadBarFill.style.width = `${Math.round(reloadProgress * 100)}%`;
        } else {
          this.reloadStatus.style.display = 'none';
          this.reloadBarFill.style.width = '0%';
        }
      }

      if (this.cooldownStatus) {
        this.cooldownStatus.style.display = 'none';
      }

      if (this.isCurrentlyScoped) {
        this.isCurrentlyScoped = false;
        if (this.scopeOverlay) {
          this.scopeOverlay.style.display = 'none';
        }
        if (this.crosshair) {
          this.crosshair.style.display = 'block';
        }
      }
    } else if (weaponType === 'akm' || weaponType === 'm4') {
      const isAKM = weaponType === 'akm';
      if (this.weaponNameText) {
        this.weaponNameText.textContent = isAKM ? 'AKM 7.62mm' : 'M4 CARBINE 5.56mm';
      }

      if (this.ammoValueText && ammo) {
        this.ammoValueText.textContent = `${ammo.inMag} / ${ammo.reserve}`;
        if (ammo.inMag === 0 && ammo.reserve === 0) {
          this.ammoValueText.style.color = '#f85149';
        } else if (ammo.inMag <= 5) {
          this.ammoValueText.style.color = '#d29922';
        } else {
          this.ammoValueText.style.color = isAKM ? '#d29922' : '#58a6ff';
        }
      }

      if (this.reloadStatus && this.reloadBarFill) {
        if (isReloading) {
          this.reloadStatus.style.display = 'flex';
          this.reloadBarFill.style.width = `${Math.round(reloadProgress * 100)}%`;
        } else {
          this.reloadStatus.style.display = 'none';
          this.reloadBarFill.style.width = '0%';
        }
      }

      if (this.cooldownStatus) {
        this.cooldownStatus.style.display = 'none';
      }

      if (this.isCurrentlyScoped) {
        this.isCurrentlyScoped = false;
        if (this.scopeOverlay) this.scopeOverlay.style.display = 'none';
        if (this.crosshair) this.crosshair.style.display = 'block';
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

  /**
   * Updates wave badge: "WAVE 1" (or "WAVE 5 [BOSS]") and remaining enemies.
   */
  public updateWaveInfo(
    waveNumber: number,
    isBossWave: boolean,
    remainingEnemies: number,
    totalWaveEnemies: number
  ): void {
    if (this.waveBadgeText) {
      if (isBossWave) {
        this.waveBadgeText.textContent = `WAVE ${waveNumber} [BOSS ENCOUNTER]`;
        this.waveBadgeText.style.color = '#f85149';
      } else {
        this.waveBadgeText.textContent = `WAVE ${waveNumber}`;
        this.waveBadgeText.style.color = '#58a6ff';
      }
    }

    if (this.waveEnemiesText) {
      if (isBossWave && remainingEnemies <= 3) {
        this.waveEnemiesText.textContent = `WARLORD ENCOUNTER (${remainingEnemies} REMAINING)`;
        this.waveEnemiesText.style.color = '#f85149';
      } else {
        this.waveEnemiesText.textContent = `ENEMIES: ${remainingEnemies} / ${totalWaveEnemies}`;
        this.waveEnemiesText.style.color = '#c9d1d9';
      }
    }
  }

  /**
   * Updates player real-time score and displays dynamic floating score popup.
   */
  public updateScore(currentScore: number, addedPoints?: number, reason?: string): void {
    if (this.scoreValEl) {
      this.scoreValEl.textContent = currentScore.toLocaleString();
    }

    if (addedPoints && addedPoints > 0 && reason && reason !== 'RESET') {
      this.showScorePopup(`+${addedPoints} ${reason}`);
    }
  }

  public showScorePopup(text: string): void {
    if (!this.scorePopupEl) return;
    this.scorePopupEl.textContent = text;
    this.scorePopupEl.classList.add('active');

    if (this.scorePopupTimeout !== null) {
      window.clearTimeout(this.scorePopupTimeout);
    }
    this.scorePopupTimeout = window.setTimeout(() => {
      if (this.scorePopupEl) {
        this.scorePopupEl.classList.remove('active');
      }
      this.scorePopupTimeout = null;
    }, 1200);
  }

  /**
   * Displays intermission countdown banner between waves.
   */
  public showIntermission(secondsRemaining: number): void {
    if (this.intermissionBanner) {
      this.intermissionBanner.style.display = 'flex';
    }
    if (this.intermissionTimerText) {
      this.intermissionTimerText.textContent = `${secondsRemaining.toFixed(1)}s`;
    }
  }

  /**
   * Hides intermission banner once wave begins.
   */
  public hideIntermission(): void {
    if (this.intermissionBanner) {
      this.intermissionBanner.style.display = 'none';
    }
    this.setClaimRewardAvailable(false);
  }

  /**
   * Sets whether the quick-claim supplies button is visible on intermission banner.
   */
  public setClaimRewardAvailable(available: boolean): void {
    if (this.claimRewardBtn) {
      this.claimRewardBtn.style.display = available ? 'inline-block' : 'none';
    }
  }

  /**
   * Updates grenade count badge on weapon bar.
   */
  public updatePrimarySlotAmmo(current: number, reserve: number): void {
    if (this.slot1Ammo) {
      this.slot1Ammo.textContent = `${current} / ${reserve}`;
    }
  }

  public updateBazookaAmmo(current: number, reserve: number): void {
    if (this.slot3Ammo && this.slot3Name?.textContent !== 'EMPTY') {
      this.slot3Ammo.textContent = `${current} / ${reserve}`;
    }
  }

  public updateGrenadeCount(count: number): void {
    if (this.slotGrenadeText) {
      this.slotGrenadeText.textContent = `FRAG: ${count}`;
    }
    if (this.grenadeCountEl) {
      this.grenadeCountEl.textContent = `FRAG: ${count} [G]`;
    }
  }

  private rewardNoticeTimeout: number | null = null;

  /**
   * Displays non-overlapping tactical toast notifications in a clean vertical stack.
   * Auto-stacks up to 3 notifications smoothly without colliding or overlapping.
   */
  public showToast(
    message: string,
    type: 'reward' | 'info' | 'warning' = 'info',
    durationMs: number = 3200
  ): void {
    if (!this.toastContainer) {
      if (this.rewardNoticeEl && this.rewardNoticeText) {
        this.rewardNoticeText.textContent = message;
        this.rewardNoticeEl.classList.add('show');
        if (this.rewardNoticeTimeout !== null) {
          window.clearTimeout(this.rewardNoticeTimeout);
        }
        this.rewardNoticeTimeout = window.setTimeout(() => {
          this.rewardNoticeEl?.classList.remove('show');
          this.rewardNoticeTimeout = null;
        }, durationMs);
      }
      return;
    }

    const toast = document.createElement('div');
    toast.className = `hud-toast-item ${type}`;
    toast.textContent = message;

    // Limit active toasts to 3 so they never crowd the reticle or HUD
    while (this.toastContainer.children.length >= 3) {
      const oldest = this.toastContainer.firstElementChild;
      if (oldest) {
        this.toastContainer.removeChild(oldest);
      }
    }

    this.toastContainer.appendChild(toast);

    // Force frame layout then transition in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => {
        if (this.toastContainer && toast.parentElement === this.toastContainer) {
          this.toastContainer.removeChild(toast);
        }
      }, 300);
    }, durationMs);
  }

  /**
   * Displays tactical popup notification when supplies/rewards are claimed.
   */
  public showRewardNotice(message: string): void {
    this.showToast(message, 'reward', 3500);

    if (this.rewardNoticeEl && this.rewardNoticeText) {
      this.rewardNoticeText.textContent = message;
    }
  }

  /**
   * Shows top-center Boss Health Bar.
   */
  public showBossBar(bossName: string, currentHp: number, maxHp: number): void {
    if (this.bossContainer) {
      this.bossContainer.style.display = 'flex';
    }
    if (this.bossNameText) {
      this.bossNameText.textContent = `${bossName} [BOSS]`;
    }
    this.updateBossHp(currentHp, maxHp);
  }

  /**
   * Updates Boss Health Bar fill percentage and numeric text.
   */
  public updateBossHp(currentHp: number, maxHp: number): void {
    if (this.bossHpValText) {
      this.bossHpValText.textContent = `${Math.max(0, currentHp)} / ${maxHp}`;
    }
    if (this.bossHpFill) {
      const ratio = Math.max(0, Math.min(1.0, currentHp / maxHp));
      this.bossHpFill.style.width = `${Math.round(ratio * 100)}%`;
    }
  }

  /**
   * Hides Boss Health Bar when boss is defeated or not active.
   */
  public hideBossBar(): void {
    if (this.bossContainer) {
      this.bossContainer.style.display = 'none';
    }
  }

  public show(): void {
    if (this.root) {
      this.root.style.display = 'block';
    }
  }

  public updateStaminaBar(isSprintKeyPressed: boolean, staminaRatio: number): void {
    if (this.staminaBar) {
      this.staminaBar.style.display = isSprintKeyPressed ? 'block' : 'none';
      this.staminaBar.setAttribute('aria-valuenow', `${Math.round(staminaRatio * 100)}`);
    }
    if (this.staminaBarFill) {
      this.staminaBarFill.style.width = `${Math.max(0, Math.min(1, staminaRatio)) * 100}%`;
    }
  }

  public updateRadar(
    playerPosition: RadarPosition,
    heading: number,
    enemyPositions: readonly RadarPosition[],
    supplyPosition?: RadarPosition | null
  ): void {
    const context = this.radarContext;
    if (!context) return;

    const center = RADAR_SIZE / 2;
    const radarRadius = center - 6;
    const markerRadius = radarRadius - 9;
    const scale = markerRadius / RADAR_RANGE;

    context.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);
    context.beginPath();
    context.arc(center, center, radarRadius, 0, Math.PI * 2);
    context.fillStyle = 'rgba(13, 17, 23, 0.82)';
    context.fill();
    context.save();
    context.clip();

    context.strokeStyle = 'rgba(139, 148, 158, 0.22)';
    context.lineWidth = 1;
    for (const ringRatio of [0.5, 1]) {
      context.beginPath();
      context.arc(center, center, markerRadius * ringRatio, 0, Math.PI * 2);
      context.stroke();
    }

    context.beginPath();
    context.moveTo(center - markerRadius, center);
    context.lineTo(center + markerRadius, center);
    context.moveTo(center, center - markerRadius);
    context.lineTo(center, center + markerRadius);
    context.stroke();

    // 1. Draw Hostile Enemies (Red Dots)
    for (const enemy of enemyPositions) {
      const offsetX = enemy.x - playerPosition.x;
      const offsetZ = enemy.z - playerPosition.z;
      const distance = Math.hypot(offsetX, offsetZ);
      if (distance > RADAR_RANGE) continue;

      context.beginPath();
      context.arc(center + offsetX * scale, center + offsetZ * scale, 4, 0, Math.PI * 2);
      context.fillStyle = '#f85149';
      context.fill();
    }

    // 2. Draw Supply Crate Waypoint Marker (Golden Pulsing Box)
    if (supplyPosition) {
      const offsetX = supplyPosition.x - playerPosition.x;
      const offsetZ = supplyPosition.z - playerPosition.z;
      const distance = Math.hypot(offsetX, offsetZ);

      let drawX = offsetX * scale;
      let drawZ = offsetZ * scale;
      // If outside radar range (30m), clamp to radar edge so player always sees supply direction
      if (distance > RADAR_RANGE && distance > 0.001) {
        const edgeRadius = markerRadius - 3;
        drawX = (offsetX / distance) * edgeRadius;
        drawZ = (offsetZ / distance) * edgeRadius;
      }

      context.save();
      context.translate(center + drawX, center + drawZ);

      // Pulsing amber crate square with white hazard border
      const pulse = 1.0 + Math.sin(performance.now() * 0.006) * 0.2;
      const size = 8 * pulse;

      context.fillStyle = '#e3b341';
      context.shadowColor = '#e3b341';
      context.shadowBlur = 6;
      context.fillRect(-size / 2, -size / 2, size, size);

      context.strokeStyle = '#ffffff';
      context.lineWidth = 1.5;
      context.strokeRect(-size / 2, -size / 2, size, size);

      // Cross on crate
      context.beginPath();
      context.moveTo(0, -size / 2);
      context.lineTo(0, size / 2);
      context.moveTo(-size / 2, 0);
      context.lineTo(size / 2, 0);
      context.strokeStyle = '#0d1117';
      context.lineWidth = 1;
      context.stroke();

      context.restore();
    }

    context.restore();
    context.beginPath();
    context.arc(center, center, radarRadius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(88, 166, 255, 0.8)';
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.translate(center, center);
    context.rotate(-heading);
    context.beginPath();
    context.moveTo(0, -11);
    context.lineTo(8, 8);
    context.lineTo(0, 5);
    context.lineTo(-8, 8);
    context.closePath();
    context.fillStyle = '#58a6ff';
    context.fill();
    context.strokeStyle = '#f0f6fc';
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  /**
   * Triggers visual hitmarker crosshair feedback ('X').
   * @param isHeadshot whether the hit was a critical headshot (displays red)
   */
  public showHitmarker(isHeadshot: boolean = false): void {
    if (!this.hitmarkerEl) return;
    this.hitmarkerEl.classList.remove('headshot', 'active');
    // Force DOM reflow to allow consecutive re-triggering
    void this.hitmarkerEl.offsetWidth;
    if (isHeadshot) {
      this.hitmarkerEl.classList.add('headshot');
    }
    this.hitmarkerEl.classList.add('active');

    if (this.hitmarkerTimeout !== null) {
      window.clearTimeout(this.hitmarkerTimeout);
    }
    this.hitmarkerTimeout = window.setTimeout(() => {
      if (this.hitmarkerEl) {
        this.hitmarkerEl.classList.remove('active', 'headshot');
      }
      this.hitmarkerTimeout = null;
    }, 120);
  }

  /**
   * Shows a directional damage indicator pointing toward the damage source.
   * @param angleRad rotation angle in radians (0 = top/front, PI/2 = right, PI = back, -PI/2 = left)
   */
  public showDamageDirection(angleRad: number): void {
    if (!this.damageIndicatorArrow) return;
    this.damageIndicatorArrow.style.transform = `rotate(${angleRad}rad)`;
    this.damageIndicatorArrow.classList.remove('active');
    // Force DOM reflow to allow consecutive re-triggering animation
    void this.damageIndicatorArrow.offsetWidth;
    this.damageIndicatorArrow.classList.add('active');

    if (this.damageIndicatorTimeout !== null) {
      window.clearTimeout(this.damageIndicatorTimeout);
    }
    this.damageIndicatorTimeout = window.setTimeout(() => {
      if (this.damageIndicatorArrow) {
        this.damageIndicatorArrow.classList.remove('active');
      }
      this.damageIndicatorTimeout = null;
    }, 600);
  }

  public hide(): void {
    if (this.root) {
      this.root.style.display = 'none';
    }
    this.updateStaminaBar(false, 1);
    if (this.scopeOverlay) {
      this.scopeOverlay.style.display = 'none';
    }
  }

  public dispose(): void {
    if (this.unsubscribeHealth) {
      this.unsubscribeHealth();
      this.unsubscribeHealth = null;
    }
    if (this.hitmarkerTimeout !== null) {
      window.clearTimeout(this.hitmarkerTimeout);
      this.hitmarkerTimeout = null;
    }
    if (this.damageIndicatorTimeout !== null) {
      window.clearTimeout(this.damageIndicatorTimeout);
      this.damageIndicatorTimeout = null;
    }
    if (this.damageVignetteTimeout !== null) {
      window.clearTimeout(this.damageVignetteTimeout);
      this.damageVignetteTimeout = null;
    }
    if (this.scorePopupTimeout !== null) {
      window.clearTimeout(this.scorePopupTimeout);
      this.scorePopupTimeout = null;
    }
    if (this.rewardNoticeTimeout !== null) {
      window.clearTimeout(this.rewardNoticeTimeout);
      this.rewardNoticeTimeout = null;
    }
  }
}
