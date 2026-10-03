import * as THREE from 'three';
import { RewardConfig } from '../config/gameConfig';
import { SupplyCrate, CrateRewardData } from './SupplyCrate';
import { PlayerHealth } from '../player/PlayerHealth';
import { Sniper } from '../weapons/Sniper';
import { GrenadeManager } from '../weapons/Grenade';
import { Bazooka } from '../weapons/Bazooka';

export interface SupplyDropCallbacks {
  onRewardClaimed?: (data: CrateRewardData, message: string) => void;
  onCrateAvailable?: (isBossCrate: boolean, reward: CrateRewardData) => void;
  onRequestSelectionModal?: (waveNumber: number, isBossWave: boolean) => void;
}

export class SupplyDropManager {
  private readonly config: RewardConfig;
  private readonly scene: THREE.Scene;
  private readonly playerHealth: PlayerHealth;
  private readonly sniper: Sniper;
  private readonly grenadeManager: GrenadeManager;
  private readonly bazooka: Bazooka;
  private readonly callbacks: SupplyDropCallbacks;

  private activeCrate: SupplyCrate | null = null;
  private playerNearCrate: boolean = false;
  private currentWaveNumber: number = 1;
  private isCurrentBossWave: boolean = false;

  constructor(
    config: RewardConfig,
    scene: THREE.Scene,
    playerHealth: PlayerHealth,
    sniper: Sniper,
    grenadeManager: GrenadeManager,
    bazooka: Bazooka,
    callbacks: SupplyDropCallbacks = {}
  ) {
    this.config = config;
    this.scene = scene;
    this.playerHealth = playerHealth;
    this.sniper = sniper;
    this.grenadeManager = grenadeManager;
    this.bazooka = bazooka;
    this.callbacks = callbacks;
  }

  public getActiveCrate(): SupplyCrate | null {
    return this.activeCrate;
  }

  public isPlayerNearCrate(): boolean {
    return this.playerNearCrate;
  }

  public hasAvailableCrate(): boolean {
    return this.activeCrate !== null && !this.activeCrate.getIsClaimed();
  }

  /**
   * Spawns a Tactical Airdrop Supply Crate in front of player when a wave is cleared.
   */
  public spawnWaveSupplyCrate(playerPos: THREE.Vector3, isBossWave: boolean, waveNumber: number = 1): void {
    // Clean up any old unclaimed crate
    this.clearCrate();

    this.currentWaveNumber = waveNumber;
    this.isCurrentBossWave = isBossWave;

    // Spawn 5m ahead of player in a safe open spot
    const spawnPos = new THREE.Vector3(
      Math.max(-20, Math.min(20, playerPos.x + (Math.random() - 0.5) * 6)),
      0,
      Math.max(-20, Math.min(20, playerPos.z + (Math.random() - 0.5) * 6))
    );

    const willUnlockBazooka = !this.bazooka.getIsUnlocked();
    const rocketsCount = isBossWave
      ? this.config.bossRocketsGiven
      : willUnlockBazooka
      ? 3
      : this.config.rocketsGiven;

    const magUpgrade = isBossWave
      ? (this.config.bossMagazineUpgrade ?? 3)
      : (this.config.magazineUpgrade ?? 2);

    const rewardData: CrateRewardData = {
      ammo: isBossWave ? this.config.bossAmmoRefill : this.config.ammoRefill,
      health: isBossWave ? this.config.bossHealthHeal : this.config.healthHeal,
      grenades: isBossWave ? this.config.bossGrenadesGiven : this.config.grenadesGiven,
      rockets: rocketsCount,
      magazineUpgrade: magUpgrade,
      unlockedBazooka: willUnlockBazooka,
      isBossReward: isBossWave,
    };

    this.activeCrate = new SupplyCrate(spawnPos, rewardData, this.scene);

    if (this.callbacks.onCrateAvailable) {
      this.callbacks.onCrateAvailable(isBossWave, rewardData);
    }
  }

  /**
   * Opens the interactive supply selection modal for the player to choose their reward(s).
   */
  public openSupplySelection(): boolean {
    if (!this.activeCrate || this.activeCrate.getIsClaimed()) {
      return false;
    }
    if (this.callbacks.onRequestSelectionModal) {
      this.callbacks.onRequestSelectionModal(this.currentWaveNumber, this.isCurrentBossWave);
      return true;
    }
    return false;
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

  /**
   * Fallback quick-claim applying basic field restock if player doesn't open selection UI.
   */
  public claimActiveCrate(): boolean {
    if (!this.activeCrate || this.activeCrate.getIsClaimed()) {
      return false;
    }

    const data = this.activeCrate.claim();
    this.activeCrate = null;
    this.playerNearCrate = false;

    if (!data) return false;

    // Apply baseline recovery
    this.sniper.addReserveAmmo(data.ammo);
    this.playerHealth.heal(data.health);
    this.grenadeManager.addGrenades(data.grenades);
    if (data.unlockedBazooka) {
      this.bazooka.unlock();
    }
    this.bazooka.addRockets(data.rockets);

    const msg = `📦 FIELD SUPPLIES CLAIMED: +${data.health} HP | +${data.ammo} AMMO | +${data.grenades} BOMB`;
    if (this.callbacks.onRewardClaimed) {
      this.callbacks.onRewardClaimed(data, msg);
    }

    return true;
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    if (this.activeCrate && !this.activeCrate.getIsClaimed()) {
      const isNear = this.activeCrate.update(dt, playerPos);
      this.playerNearCrate = isNear;
    } else {
      this.playerNearCrate = false;
    }
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
