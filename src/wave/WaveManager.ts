import * as THREE from 'three';
import { WaveConfig, BossConfig, EnemyConfig } from '../config/gameConfig';
import {
  getWaveEnemyCount,
  getWaveEnemyHp,
  getWaveEnemyDamage,
  isBossWave,
  getBossCountForWave,
} from './WaveConfig';
import { SpawnManager } from './SpawnManager';
import { Enemy } from '../enemies/Enemy';
import { Boss } from '../enemies/Boss';

export type WaveLifecycleState = 'NOT_STARTED' | 'WAVE_ACTIVE' | 'BOSS_ACTIVE' | 'INTERMISSION' | 'VICTORY';

export interface WaveManagerCallbacks {
  onWaveStarted?: (waveNumber: number, isBossWave: boolean, totalEnemies: number) => void;
  onEnemySpawnRequested?: (spawnPos: THREE.Vector3, config: EnemyConfig) => Enemy;
  onBossSpawnRequested?: (spawnPos: THREE.Vector3, waveNumber: number) => Boss;
  onIntermissionTick?: (secondsRemaining: number) => void;
  onIntermissionComplete?: (nextWave: number) => void;
  onBossSpawned?: (boss: Boss) => void;
  onBossDefeated?: (boss: Boss) => void;
  onWaveCompleted?: (waveNumber: number) => void;
  onGameVictory?: (totalWaves: number) => void;
}

/**
 * Orchestrates infinite waves, regular enemy queuing, intermission countdowns,
 * difficulty scaling, and boss encounters on multiples of 5.
 */
export class WaveManager {
  private readonly waveConfig: WaveConfig;
  private readonly bossConfig: BossConfig;
  private readonly enemyConfig: EnemyConfig;
  private readonly spawnManager: SpawnManager;
  private readonly callbacks: WaveManagerCallbacks;

  private currentWave: number = 0;
  private state: WaveLifecycleState = 'NOT_STARTED';

  // Wave Enemy Tracking
  private totalRegularEnemiesInWave: number = 0;
  private queuedEnemiesToSpawn: number = 0;
  private regularEnemiesDefeated: number = 0;

  // Active Bosses
  private activeBosses: Boss[] = [];
  private targetBossCount: number = 0;

  // Timers
  private intermissionTimer: number = 0;
  private intermissionPaused: boolean = false;
  private spawnIntervalTimer: number = 0;

  constructor(
    waveConfig: WaveConfig,
    bossConfig: BossConfig,
    enemyConfig: EnemyConfig,
    spawnManager: SpawnManager,
    callbacks: WaveManagerCallbacks = {}
  ) {
    this.waveConfig = waveConfig;
    this.bossConfig = bossConfig;
    this.enemyConfig = enemyConfig;
    this.spawnManager = spawnManager;
    this.callbacks = callbacks;
  }

  public getState(): WaveLifecycleState {
    return this.state;
  }

  public getWaveNumber(): number {
    return this.currentWave;
  }

  public isCurrentWaveBoss(): boolean {
    return isBossWave(this.currentWave, this.bossConfig);
  }

  public getCurrentBoss(): Boss | null {
    return this.activeBosses.length > 0 ? this.activeBosses[0] : null;
  }

  public getActiveBosses(): Boss[] {
    return this.activeBosses;
  }

  /**
   * Freezes / resumes the intermission countdown (used while the supply menu is open
   * so the player can choose a reward safely).
   */
  public setIntermissionPaused(paused: boolean): void {
    this.intermissionPaused = paused;
  }

  public getIntermissionRemaining(): number {
    return Math.max(0, this.intermissionTimer);
  }

  public getTotalRegularEnemies(): number {
    return this.totalRegularEnemiesInWave;
  }

  public getDefeatedEnemies(): number {
    return this.regularEnemiesDefeated;
  }

  public getRemainingEnemies(): number {
    if (this.state === 'BOSS_ACTIVE') {
      return this.activeBosses.length > 0 ? this.activeBosses.length : this.targetBossCount;
    }
    return Math.max(0, this.totalRegularEnemiesInWave - this.regularEnemiesDefeated);
  }

  /**
   * Starts the initial wave (Wave 1).
   */
  public startFirstWave(): void {
    this.currentWave = 1;
    this.startWave(1);
  }

  /**
   * Resets wave manager to initial state.
   */
  public reset(): void {
    this.currentWave = 0;
    this.state = 'NOT_STARTED';
    this.totalRegularEnemiesInWave = 0;
    this.queuedEnemiesToSpawn = 0;
    this.regularEnemiesDefeated = 0;
    this.activeBosses = [];
    this.targetBossCount = 0;
    this.intermissionTimer = 0;
    this.intermissionPaused = false;
    this.spawnIntervalTimer = 0;
  }

  private startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.state = 'WAVE_ACTIVE';
    this.activeBosses = [];
    this.regularEnemiesDefeated = 0;

    const count = getWaveEnemyCount(waveNumber, this.waveConfig);
    this.totalRegularEnemiesInWave = count;
    this.queuedEnemiesToSpawn = count;
    this.spawnIntervalTimer = 0; // Trigger first batch immediately

    const isBoss = isBossWave(waveNumber, this.bossConfig);
    this.targetBossCount = isBoss ? getBossCountForWave(waveNumber) : 0;

    if (this.callbacks.onWaveStarted) {
      this.callbacks.onWaveStarted(waveNumber, isBoss, count);
    }
  }

  /**
   * Called by Game whenever any enemy dies.
   */
  public notifyEnemyKilled(enemy: Enemy): void {
    if (enemy.isBoss()) {
      const idx = this.activeBosses.indexOf(enemy as Boss);
      if (idx !== -1) {
        const killed = this.activeBosses.splice(idx, 1)[0];
        if (this.callbacks.onBossDefeated) {
          this.callbacks.onBossDefeated(killed);
        }
      }
      if (this.activeBosses.length === 0) {
        this.completeWave();
      }
    } else {
      this.regularEnemiesDefeated++;
      // Check if all regular enemies for the wave are defeated
      if (this.queuedEnemiesToSpawn === 0 && this.regularEnemiesDefeated >= this.totalRegularEnemiesInWave) {
        if (isBossWave(this.currentWave, this.bossConfig)) {
          // Regular enemies defeated: initiate Boss encounter!
          this.initiateBossEncounter();
        } else {
          // Regular wave cleared!
          this.completeWave();
        }
      }
    }
  }

  private initiateBossEncounter(): void {
    this.state = 'BOSS_ACTIVE';
  }

  private spawnBoss(playerPos: THREE.Vector3, livingEnemyPositions: THREE.Vector3[]): void {
    if (!this.callbacks.onBossSpawnRequested) return;

    // Boss has larger footprint (e.g. radius ~0.8m, height ~3.6m)
    const bossRadius = this.enemyConfig.radius * 2.0;
    const bossHeight = this.enemyConfig.height * 2.0;

    const spawnPos = this.spawnManager.getValidSpawnPosition(
      playerPos,
      livingEnemyPositions,
      bossRadius,
      bossHeight
    );

    const boss = this.callbacks.onBossSpawnRequested(spawnPos, this.currentWave);
    this.activeBosses.push(boss);

    if (this.callbacks.onBossSpawned) {
      this.callbacks.onBossSpawned(boss);
    }
  }

  private completeWave(): void {
    // Endless Waves: always enter INTERMISSION and queue next wave!
    this.state = 'INTERMISSION';
    this.intermissionTimer = this.waveConfig.intermissionDuration;

    if (this.callbacks.onWaveCompleted) {
      this.callbacks.onWaveCompleted(this.currentWave);
    }
  }

  /**
   * Main per-frame update for wave orchestration.
   *
   * @param dt Clamped delta time in seconds
   * @param playerPos Current player position
   * @param livingEnemies Array of currently active living enemies
   */
  public update(dt: number, playerPos: THREE.Vector3, livingEnemies: Enemy[]): void {
    const livingPositions = livingEnemies.map((e) => e.position);

    switch (this.state) {
      case 'WAVE_ACTIVE':
        this.updateWaveActive(dt, playerPos, livingPositions, livingEnemies.length);
        break;

      case 'BOSS_ACTIVE':
        this.updateBossActive(playerPos, livingPositions);
        break;

      case 'INTERMISSION':
        this.updateIntermission(dt);
        break;

      case 'NOT_STARTED':
      default:
        break;
    }
  }

  private updateWaveActive(
    dt: number,
    playerPos: THREE.Vector3,
    livingPositions: THREE.Vector3[],
    activeLivingCount: number
  ): void {
    // Spawn queued enemies while active count < maxActiveEnemies
    if (this.queuedEnemiesToSpawn > 0 && activeLivingCount < this.waveConfig.maxActiveEnemies) {
      this.spawnIntervalTimer -= dt;

      if (this.spawnIntervalTimer <= 0) {
        this.spawnIntervalTimer = this.waveConfig.spawnInterval;

        // Calculate scaled enemy HP and damage for current wave
        const scaledHp = getWaveEnemyHp(this.currentWave, this.enemyConfig.maxHp, this.waveConfig);
        const scaledDamage = getWaveEnemyDamage(this.currentWave, this.enemyConfig.damage, this.waveConfig);

        const scaledConfig: EnemyConfig = {
          ...this.enemyConfig,
          maxHp: scaledHp,
          damage: scaledDamage,
        };

        const spawnPos = this.spawnManager.getValidSpawnPosition(playerPos, livingPositions);

        if (this.callbacks.onEnemySpawnRequested) {
          this.callbacks.onEnemySpawnRequested(spawnPos, scaledConfig);
          this.queuedEnemiesToSpawn--;
        }
      }
    }
  }

  private updateBossActive(playerPos: THREE.Vector3, livingPositions: THREE.Vector3[]): void {
    // Spawn bosses up to targetBossCount
    while (this.activeBosses.length < this.targetBossCount) {
      this.spawnBoss(playerPos, livingPositions);
    }
  }

  private updateIntermission(dt: number): void {
    if (this.intermissionPaused) {
      if (this.callbacks.onIntermissionTick) {
        this.callbacks.onIntermissionTick(Math.max(0, this.intermissionTimer));
      }
      return;
    }
    this.intermissionTimer -= dt;

    if (this.callbacks.onIntermissionTick) {
      this.callbacks.onIntermissionTick(Math.max(0, this.intermissionTimer));
    }

    if (this.intermissionTimer <= 0) {
      const nextWave = this.currentWave + 1;
      if (this.callbacks.onIntermissionComplete) {
        this.callbacks.onIntermissionComplete(nextWave);
      }
      this.startWave(nextWave);
    }
  }
}
