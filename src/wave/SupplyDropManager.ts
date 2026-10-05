import * as THREE from 'three';
import { RewardConfig, SupplyDropConfig } from '../config/gameConfig';
import { SupplyCrate, CrateRewardData } from './SupplyCrate';

export interface SupplyDropCallbacks {
  onCrateAvailable?: (isBossCrate: boolean, reward: CrateRewardData) => void;
  onCrateLanded?: (position: THREE.Vector3, isBossCrate: boolean) => void;
  onCrateExpired?: () => void;
}

export class SupplyDropManager {
  private readonly config: RewardConfig;
  private readonly supplyConfig: SupplyDropConfig;
  private readonly scene: THREE.Scene;
  private readonly colliders: THREE.Box3[];
  private readonly callbacks: SupplyDropCallbacks;

  private activeCrate: SupplyCrate | null = null;
  private playerNearCrate: boolean = false;
  private isCurrentBossWave: boolean = false;

  constructor(
    config: RewardConfig,
    supplyConfig: SupplyDropConfig,
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    callbacks: SupplyDropCallbacks = {}
  ) {
    this.config = config;
    this.supplyConfig = supplyConfig;
    this.scene = scene;
    this.colliders = colliders;
    this.callbacks = callbacks;
  }

  public isPlayerNearCrate(): boolean {
    return this.playerNearCrate;
  }

  public hasAvailableCrate(): boolean {
    return this.activeCrate !== null && !this.activeCrate.getIsClaimed();
  }

  /**
   * Returns active supply crate world coordinates if it has landed and is visible.
   * Used by minimap / radar to render supply crate beacon.
   */
  public getActiveCratePosition(): THREE.Vector3 | null {
    if (this.activeCrate && this.activeCrate.getIsVisible()) {
      return this.activeCrate.position;
    }
    return null;
  }

  /**
   * Spawns a Tactical Airdrop Supply Crate in front of player when a wave is cleared.
   */
  public spawnWaveSupplyCrate(playerPos: THREE.Vector3, isBossWave: boolean): void {
    // Clean up any old unclaimed crate
    this.clearCrate();

    this.isCurrentBossWave = isBossWave;

    // Find a random open arena position that does not intersect an obstacle.
    const spawnPos = this.findValidSpawnPosition(playerPos);

    const magUpgrade = isBossWave
      ? (this.config.bossMagazineUpgrade ?? 3)
      : (this.config.magazineUpgrade ?? 2);

    const rewardData: CrateRewardData = {
      ammo: isBossWave ? this.config.bossAmmoRefill : this.config.ammoRefill,
      health: isBossWave ? this.config.bossHealthHeal : this.config.healthHeal,
      grenades: isBossWave ? this.config.bossGrenadesGiven : this.config.grenadesGiven,
      // Legacy fields: the actual rewards are now picked from the supply modal cards.
      rockets: 0,
      magazineUpgrade: magUpgrade,
      unlockedBazooka: false,
      isBossReward: isBossWave,
    };

    this.activeCrate = new SupplyCrate(
      spawnPos,
      rewardData,
      this.scene,
      this.supplyConfig.interactionRadius,
      this.supplyConfig.hiddenLifetime,
      this.supplyConfig.displayLifetime
    );

    if (this.callbacks.onCrateAvailable) {
      this.callbacks.onCrateAvailable(isBossWave, rewardData);
    }
  }

  /**
   * Consumes and marks the active crate as claimed after rewards are chosen.
   */
  public consumeActiveCrate(): void {
    if (this.activeCrate) {
      this.activeCrate.claim();
      this.activeCrate = null;
      this.playerNearCrate = false;
    }
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    if (this.activeCrate && !this.activeCrate.getIsClaimed()) {
      const result = this.activeCrate.update(dt, playerPos);
      if (result.expired) {
        this.clearCrate();
        this.callbacks.onCrateExpired?.();
        return;
      }
      if (result.becameVisible) {
        this.callbacks.onCrateLanded?.(this.activeCrate.position, this.isCurrentBossWave);
      }
      this.playerNearCrate = result.isNear;
    } else {
      this.playerNearCrate = false;
    }
  }


  private findValidSpawnPosition(playerPos: THREE.Vector3): THREE.Vector3 {
    const margin = this.supplyConfig.spawnMargin;
    const crateHalfSize = new THREE.Vector3(0.6 + margin, 0.35 + margin, 0.4 + margin);
    const candidate = new THREE.Vector3();

    for (let attempt = 0; attempt < this.supplyConfig.maxSpawnAttempts; attempt++) {
      candidate.set(
        THREE.MathUtils.randFloat(this.supplyConfig.arenaMinX, this.supplyConfig.arenaMaxX),
        0,
        THREE.MathUtils.randFloat(this.supplyConfig.arenaMinZ, this.supplyConfig.arenaMaxZ)
      );

      // Avoid dropping directly on the player.
      if (candidate.distanceTo(playerPos) < 5.0) continue;

      const candidateBox = new THREE.Box3().setFromCenterAndSize(candidate, crateHalfSize);
      if (this.colliders.some((collider) => candidateBox.intersectsBox(collider))) continue;

      return candidate.clone();
    }

    // Safe fallback near the player, clamped inside the arena.
    candidate.set(
      THREE.MathUtils.clamp(playerPos.x + 5, this.supplyConfig.arenaMinX, this.supplyConfig.arenaMaxX),
      0,
      THREE.MathUtils.clamp(playerPos.z, this.supplyConfig.arenaMinZ, this.supplyConfig.arenaMaxZ)
    );
    return candidate;
  }

  public pauseActiveCrateLifetime(): void {
    this.activeCrate?.pauseLifetime();
  }

  public resumeActiveCrateLifetime(): void {
    this.activeCrate?.resumeLifetime();
  }

  public clearCrate(): void {
    if (this.activeCrate) {
      this.activeCrate.dispose();
      this.activeCrate = null;
      this.playerNearCrate = false;
    }
  }

  public reset(): void {
    this.clearCrate();
  }

  public dispose(): void {
    this.clearCrate();
  }
}
