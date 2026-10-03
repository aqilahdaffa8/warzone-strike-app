import * as THREE from 'three';
import { Arena } from '../environment/Arena';
import { GAME_CONFIG, EnemyConfig } from '../config/gameConfig';
import { GameStateType } from './GameState';
import { PlayerHealth } from '../player/PlayerHealth';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { Sniper } from '../weapons/Sniper';
import { Knife } from '../weapons/Knife';
import { Bazooka } from '../weapons/Bazooka';
import { AssaultRifle } from '../weapons/AssaultRifle';
import { WeaponType, DamageableTarget } from '../weapons/Weapon';
import { TargetDummy } from '../environment/TargetDummy';
import { Enemy } from '../enemies/Enemy';
import { Boss } from '../enemies/Boss';
import { EnemyProjectileManager } from '../enemies/EnemyProjectileManager';
import { ScoreManager } from '../scoring/ScoreManager';
import { WaveManager } from '../wave/WaveManager';
import { SpawnManager } from '../wave/SpawnManager';
import { GameOverScreen } from '../ui/GameOverScreen';
import { GrenadeManager } from '../weapons/Grenade';
import { SupplyDropManager } from '../wave/SupplyDropManager';
import { SupplySelectionModal, SupplyItemType, SupplyLoadoutState } from '../ui/SupplySelectionModal';
import { isBossWave } from '../wave/WaveConfig';
import { PlayerIdentityProvider } from '../identity/PlayerIdentityProvider';
import { MockPlayerIdentityProvider } from '../identity/MockPlayerIdentityProvider';
import { LeaderboardClient } from '../leaderboard/LeaderboardClient';
import { MockLeaderboardClient } from '../leaderboard/MockLeaderboardClient';
import { QueueSubmissionResult, ScoreSubmissionQueue } from '../leaderboard/ScoreSubmissionQueue';
import { ScorePayload } from '../scoring/ScoreManager';

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock: THREE.Clock;

  private readonly arena: Arena;
  private readonly playerHealth: PlayerHealth;
  private readonly playerController: PlayerController;
  private readonly sniper: Sniper;
  private readonly knife: Knife;
  private readonly bazooka: Bazooka;
  private readonly akm: AssaultRifle;
  private readonly m4: AssaultRifle;
  private readonly grenadeManager: GrenadeManager;
  private readonly supplyDropManager: SupplyDropManager;
  private readonly supplyModal: SupplySelectionModal;
  private readonly projectileManager: EnemyProjectileManager;
  private readonly scoreManager: ScoreManager;
  private readonly identityProvider: PlayerIdentityProvider;
  private readonly leaderboardClient: LeaderboardClient;
  private readonly scoreSubmissionQueue: ScoreSubmissionQueue;
  private currentScorePayload: ScorePayload | null = null;
  private hasRetriedPendingScoresOnStartup: boolean = false;
  private activeWeaponType: WeaponType = 'sniper';
  private primaryWeaponType: 'sniper' | 'akm' | 'm4' = 'sniper';
  private isLeftMouseDown: boolean = false;

  private readonly spawnManager: SpawnManager;
  private readonly waveManager: WaveManager;

  private readonly targetDummies: TargetDummy[] = [];
  private readonly enemies: Enemy[] = [];
  private enemySpawnCounter: number = 0;
  private readonly hud: HUD;
  private readonly pauseMenu: PauseMenu;
  private readonly gameOverScreen: GameOverScreen;

  private state: GameStateType = 'MENU';
  private isRunning: boolean = false;
  private isVictory: boolean = false;
  private wasPointerLocked: boolean = false;

  private readonly startOverlay: HTMLElement | null;
  private readonly startBtn: HTMLButtonElement | null;

  // Track right-click interaction for hold-to-aim vs toggle-to-aim (sniper scope)
  private rightMouseDownTime: number = 0;
  private wasScopedOnMouseDown: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x11161d);
    this.scene.fog = new THREE.Fog(0x11161d, 35, 95);

    // 2. Camera setup (first-person perspective)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(GAME_CONFIG.sniper.defaultFov, aspect, 0.1, 500);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lighting setup
    this.setupLighting();

    // 5. Arena setup
    this.arena = new Arena();
    this.scene.add(this.arena.group);

    // 6. Player Systems
    this.playerHealth = new PlayerHealth(GAME_CONFIG.player.maxHp);
    const colliders = this.arena.getColliders();
    this.playerController = new PlayerController(
      this.camera,
      this.playerHealth,
      colliders,
      GAME_CONFIG.player
    );

    // 7. Weapon Systems (Sniper, Knife, Bazooka, AKM & M4)
    this.sniper = new Sniper(GAME_CONFIG.sniper, this.camera, this.scene, this.playerController);
    this.knife = new Knife(GAME_CONFIG.knife, this.camera, this.scene);
    this.bazooka = new Bazooka(GAME_CONFIG.bazooka, this.camera, this.scene);
    this.akm = new AssaultRifle('akm', GAME_CONFIG.akm, this.camera, this.scene, this.playerController);
    this.m4 = new AssaultRifle('m4', GAME_CONFIG.m4, this.camera, this.scene, this.playerController);

    // Initial loadout: Sniper active, all other weapons inactive/locked
    this.sniper.setActive(true);
    this.knife.setActive(false);
    this.bazooka.setActive(false);
    this.akm.setActive(false);
    this.m4.setActive(false);

    // 8. Enemy Projectiles Manager
    this.projectileManager = new EnemyProjectileManager(this.scene);

    // 9. Score Manager
    this.scoreManager = new ScoreManager(GAME_CONFIG.score);
    this.identityProvider = new MockPlayerIdentityProvider();
    this.leaderboardClient = new MockLeaderboardClient(GAME_CONFIG.leaderboard);
    this.scoreSubmissionQueue = new ScoreSubmissionQueue();
    this.scoreManager.onScoreChanged = (score, delta, reason) => {
      this.hud.updateScore(score, delta, reason);
    };

    // 10. Grenades & Explosions with Screen Shake Feedback
    this.grenadeManager = new GrenadeManager(GAME_CONFIG.grenade, this.scene, colliders);
    this.grenadeManager.onExplosion = (pos) => {
      this.playerController.triggerExplosionShake(pos, 32.0);
    };
    this.bazooka.onExplosion = (pos) => {
      this.playerController.triggerExplosionShake(pos, 35.0);
    };

    // 11. Tactical Supply Selection Modal
    this.supplyModal = new SupplySelectionModal();

    // 12. Supply Drops & Wave Rewards
    this.supplyDropManager = new SupplyDropManager(
      GAME_CONFIG.reward,
      GAME_CONFIG.supplyDrop,
      this.scene,
      colliders,
      this.playerHealth,
      this.sniper,
      this.grenadeManager,
      this.bazooka,
      {
        onRewardClaimed: (_data, msg) => {
          void _data;
          this.hud.showRewardNotice(msg);
          this.hud.setClaimRewardAvailable(false);
          this.hud.updateGrenadeCount(this.grenadeManager.getGrenadeCount());
          this.hud.setBazookaUnlocked(this.bazooka.getIsUnlocked());
          this.hud.setAkmUnlocked(this.akm.getIsUnlocked());
          this.hud.setM4Unlocked(this.m4.getIsUnlocked());
        },
        onCrateAvailable: () => {
          this.hud.setClaimRewardAvailable(false);
          this.hud.setSupplyInteractionAvailable(false);
        },
        onCrateExpired: () => {
          this.hud.setClaimRewardAvailable(false);
          this.hud.setSupplyInteractionAvailable(false);
        },
        onRequestSelectionModal: (waveNumber, isBossWave) => {
          this.openSupplyModal(waveNumber, isBossWave);
        },
      }
    );

    // 13. Environment Target Dummies
    this.spawnTargetDummies();

    // 14. Spawn Manager & Wave Manager (Endless Waves & Multi-Bosses)
    this.spawnManager = new SpawnManager(GAME_CONFIG.wave, GAME_CONFIG.enemy, colliders);
    this.waveManager = new WaveManager(
      GAME_CONFIG.wave,
      GAME_CONFIG.boss,
      GAME_CONFIG.enemy,
      this.spawnManager,
      {
        onWaveStarted: (waveNumber, isBoss, totalEnemies) => {
          this.hud.hideIntermission();
          this.hud.hideBossBar();
          this.hud.updateWaveInfo(waveNumber, isBoss, totalEnemies, totalEnemies);
        },
        onEnemySpawnRequested: (spawnPos, config) => {
          return this.spawnWaveEnemy(spawnPos, config);
        },
        onBossSpawnRequested: (spawnPos, waveNumber) => {
          return this.spawnWaveBoss(spawnPos, waveNumber);
        },
        onIntermissionTick: (secondsRemaining) => {
          this.hud.showIntermission(secondsRemaining);
          void secondsRemaining;
        },
        onIntermissionComplete: () => {
          this.hud.hideIntermission();
          if (this.supplyModal.getIsOpen()) {
            this.supplyModal.close('cancelled');
          }
          if (this.supplyDropManager.hasAvailableCrate()) {
            this.supplyDropManager.clearCrate();
          }
        },
        onWaveCompleted: (waveNumber) => {
          this.scoreManager.addWaveClear(waveNumber);
          const isBoss = isBossWave(waveNumber, GAME_CONFIG.boss);
          // Spawn physical 3D supply crate in arena; player presses E to open
          this.supplyDropManager.spawnWaveSupplyCrate(this.playerController.position, isBoss, waveNumber);
          this.hud.setClaimRewardAvailable(false);
          this.hud.setSupplyInteractionAvailable(false);
        },
        onBossSpawned: (boss) => {
          this.hud.showBossBar(boss.bossTitle, boss.getHp(), boss.getMaxHp());
        },
        onBossDefeated: () => {
          // If no more bosses active in wave, hide boss bar
          if (this.waveManager.getActiveBosses().length === 0) {
            this.hud.hideBossBar();
          }
        },
      }
    );

    // 12. UI Systems
    this.hud = new HUD(this.playerHealth, {
      onReloadRequested: () => {
        if (this.state === 'PLAYING') {
          if (this.activeWeaponType === 'sniper') this.sniper.reload();
          else if (this.activeWeaponType === 'bazooka') this.bazooka.reload();
          else if (this.activeWeaponType === 'akm') this.akm.reload();
          else if (this.activeWeaponType === 'm4') this.m4.reload();
        }
      },
      onResetAmmoRequested: () => {
        this.sniper.resetAmmo();
      },
      onResetDummiesRequested: () => {
        this.targetDummies.forEach((d) => d.reset());
      },
      onSkipWaveRequested: () => {
        // Fast forward wave for QA testing: defeat all living regular enemies
        const living = this.enemies.filter((e) => !e.getIsDead());
        for (const enemy of living) {
          enemy.takeDamage(99999, false);
        }
      },
      onSpawnBossRequested: () => {
        // Force spawn boss immediately for testing
        const bossRadius = GAME_CONFIG.enemy.radius * 2.0;
        const bossHeight = GAME_CONFIG.enemy.height * 2.0;
        const livingPositions = this.enemies.filter((e) => !e.getIsDead()).map((e) => e.position);
        const spawnPos = this.spawnManager.getValidSpawnPosition(
          this.playerController.position,
          livingPositions,
          bossRadius,
          bossHeight
        );
        const boss = this.spawnWaveBoss(spawnPos, Math.max(5, this.waveManager.getWaveNumber()));
        this.hud.showBossBar(boss.bossTitle, boss.getHp(), boss.getMaxHp());
      },
      onSpawnEnemyRequested: () => {
        this.spawnEnemy();
      },
      onClearEnemiesRequested: () => {
        this.clearEnemies();
      },
      onSwitchWeaponRequested: (type: WeaponType) => {
        if (this.state === 'PLAYING') {
          this.switchWeapon(type);
        }
      },
      onThrowGrenadeRequested: () => {
        if (this.state === 'PLAYING') {
          this.throwGrenade();
        }
      },
      onClaimRewardRequested: () => {
        if (this.state === 'PLAYING' && this.supplyDropManager.isPlayerNearCrate() && !this.supplyModal.getIsOpen()) {
          const wave = this.waveManager.getWaveNumber();
          const isBoss = isBossWave(wave, GAME_CONFIG.boss);
          this.openSupplyModal(wave, isBoss);
        }
      },
    });

    this.hud.updateGrenadeCount(this.grenadeManager.getGrenadeCount());
    this.hud.setPrimarySlotWeapon('sniper');
    this.hud.setBazookaUnlocked(false);
    this.hud.setSupplyInteractionAvailable(false);

    this.pauseMenu = new PauseMenu(this.playerController, this.playerHealth);
    this.pauseMenu.setOnResume(() => {
      this.enterGame();
    });

    this.gameOverScreen = new GameOverScreen();
    this.gameOverScreen.setOnRestart(() => {
      this.restartGame();
    });
    this.gameOverScreen.setOnRetrySubmission(() => {
      void this.retryCurrentScoreSubmission();
    });

    this.playerHealth.onDeath(() => {
      if (this.state === 'PLAYING') {
        this.handlePlayerDeath();
      }
    });

    this.startOverlay = document.querySelector<HTMLElement>('#start-overlay');
    this.startBtn = document.querySelector<HTMLButtonElement>('#btn-start-game');

    // 10. Event listeners
    this.setupEventListeners();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x8fa3b8, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x6b8299, 0x22272e, 0.5);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(30, 45, 25);
    sunLight.castShadow = true;

    sunLight.shadow.camera.left = -38;
    sunLight.shadow.camera.right = 38;
    sunLight.shadow.camera.top = 38;
    sunLight.shadow.camera.bottom = -38;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 130;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;

    this.scene.add(sunLight);
  }

  private spawnTargetDummies(): void {
    // Dummy 0: Close-range Melee Training Dummy
    // Located at (0, 0, 9.5). Player starts at (0, 0, 12).
    // Initial distance is 2.5m (> 2.0m knife range): Knife misses from spawn point.
    // Stepping forward ~1m (distance <= 2.0m): Knife attacks hit and deal 35 (body) or 52.5 (headshot)!
    const dummy0 = new TargetDummy(
      'dummy-close-melee',
      new THREE.Vector3(0, 0, 9.5),
      0,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy0);
    this.scene.add(dummy0.group);

    // Dummy 1: Open field target (distance ~14m from start position (0, 0, 12))
    const dummy1 = new TargetDummy(
      'dummy-open-midrange',
      new THREE.Vector3(-4, 0, -2),
      0,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy1);
    this.scene.add(dummy1.group);

    // Dummy 2: Long-distance target (distance ~34m from start position)
    const dummy2 = new TargetDummy(
      'dummy-long-range',
      new THREE.Vector3(5, 0, -22),
      -Math.PI / 8,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy2);
    this.scene.add(dummy2.group);

    // Dummy 3: Placed directly behind shipping container-6 (at 0, 1.3, -6)
    const dummy3 = new TargetDummy(
      'dummy-behind-container',
      new THREE.Vector3(0, 0, -10),
      0,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy3);
    this.scene.add(dummy3.group);

    // Dummy 4: Placed behind concrete barrier-2 (at -8, 0.5, 0)
    const dummy4 = new TargetDummy(
      'dummy-behind-barrier',
      new THREE.Vector3(-8, 0, 3),
      Math.PI,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy4);
    this.scene.add(dummy4.group);
  }

  public spawnWaveEnemy(position: THREE.Vector3, config: EnemyConfig): Enemy {
    this.enemySpawnCounter++;
    const enemy = new Enemy(
      `enemy-${this.enemySpawnCounter}`,
      position,
      config,
      this.arena.getColliders(),
      this.scene
    );
    enemy.onDeath((killedEnemy, isHeadshot) => {
      this.scoreManager.addRegularKill(isHeadshot);
      this.waveManager.notifyEnemyKilled(killedEnemy);
    });
    this.enemies.push(enemy);
    return enemy;
  }

  public spawnWaveBoss(position: THREE.Vector3, waveNumber: number): Boss {
    this.enemySpawnCounter++;
    const boss = new Boss(
      `boss-${this.enemySpawnCounter}`,
      position,
      waveNumber,
      GAME_CONFIG.boss,
      GAME_CONFIG.enemy,
      this.arena.getColliders(),
      this.scene
    );
    boss.onDeath((killedBoss, isHeadshot) => {
      this.scoreManager.addBossKill(isHeadshot);
      this.waveManager.notifyEnemyKilled(killedBoss);
    });
    this.enemies.push(boss);
    return boss;
  }

  public spawnEnemy(position?: THREE.Vector3): Enemy {
    this.enemySpawnCounter++;
    let spawnPos: THREE.Vector3;
    if (position) {
      spawnPos = position;
    } else {
      // Find a safe position that does not intersect arena obstacles
      const livingPositions = this.enemies.filter((e) => !e.getIsDead()).map((e) => e.position);
      spawnPos = this.spawnManager.getValidSpawnPosition(this.playerController.position, livingPositions);
    }

    const enemy = new Enemy(
      `enemy-${this.enemySpawnCounter}`,
      spawnPos,
      GAME_CONFIG.enemy,
      this.arena.getColliders(),
      this.scene
    );
    enemy.onDeath((killedEnemy, isHeadshot) => {
      this.scoreManager.addRegularKill(isHeadshot);
      this.waveManager.notifyEnemyKilled(killedEnemy);
    });
    this.enemies.push(enemy);
    return enemy;
  }

  public clearEnemies(): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies.length = 0;
  }

  private getTargets(): DamageableTarget[] {
    return [...this.targetDummies, ...this.enemies];
  }

  public openSupplyModal(waveNumber: number, isBossWave: boolean): void {
    if (!this.supplyDropManager.hasAvailableCrate() || !this.supplyDropManager.isPlayerNearCrate()) {
      return;
    }

    this.supplyDropManager.pauseActiveCrateLifetime();

    const loadout: SupplyLoadoutState = {
      hasBazooka: this.bazooka.getIsUnlocked(),
      hasAkm: this.akm.getIsUnlocked(),
      hasM4: this.m4.getIsUnlocked(),
      currentHp: this.playerHealth.getHp(),
      maxHp: this.playerHealth.getMaxHp(),
      grenadeCount: this.grenadeManager.getGrenadeCount(),
    };

    this.supplyModal.open(
      waveNumber,
      isBossWave,
      loadout,
      (itemType, itemTitle) => {
        this.handleSupplyClaim(itemType, isBossWave);
        this.hud.showRewardNotice(`ITEM DITERIMA: ${itemTitle}`);
      },
      (reason) => {
        if (reason === 'claimed' || reason === 'expired') {
          this.supplyDropManager.consumeActiveCrate();
          this.hud.setClaimRewardAvailable(false);
          this.hud.setSupplyInteractionAvailable(false);
        } else {
          this.supplyDropManager.clearCrate();
          this.hud.setClaimRewardAvailable(false);
          this.hud.setSupplyInteractionAvailable(false);
        }
      },
    );

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private handleSupplyClaim(type: SupplyItemType, isBossWave: boolean): void {
    switch (type) {
      case 'health_pack': {
        const healAmt = isBossWave ? 100 : 45;
        this.playerHealth.heal(healAmt);
        break;
      }
      case 'frag_grenade': {
        const bombsToAdd = isBossWave ? 3 : 2;
        this.grenadeManager.addGrenades(bombsToAdd);
        this.hud.updateGrenadeCount(this.grenadeManager.getGrenadeCount());
        break;
      }
      case 'bazooka': {
        this.bazooka.unlock();
        this.bazooka.addReserveAmmo(3);
        this.hud.setBazookaUnlocked(true);
        break;
      }
      case 'akm': {
        this.akm.unlock();
        this.akm.addReserveAmmo(60);
        this.primaryWeaponType = 'akm';
        this.hud.setPrimarySlotWeapon('akm');
        this.hud.setAkmUnlocked(true);

        // AKM immediately occupies Slot 1 and becomes the active primary weapon.
        this.switchWeapon('akm');
        break;
      }
      case 'm4': {
        this.m4.unlock();
        this.m4.addReserveAmmo(90);
        this.primaryWeaponType = 'm4';
        this.hud.setPrimarySlotWeapon('m4');
        this.hud.setM4Unlocked(true);
        break;
      }
      case 'magazine_upgrade': {
        this.sniper.upgradeMagazine(2);
        this.akm.upgradeMagazine(10);
        this.m4.upgradeMagazine(10);
        break;
      }
      case 'sniper_ammo': {
        this.sniper.addReserveAmmo(25);
        break;
      }
      case 'rifle_ammo': {
        this.akm.addReserveAmmo(60);
        this.m4.addReserveAmmo(90);
        break;
      }
    }
  }

  public switchWeapon(type: WeaponType): void {
    if (this.activeWeaponType === type) return;

    // Slot 1 contains only the currently equipped primary weapon.
    if ((type === 'sniper' || type === 'akm' || type === 'm4') && type !== this.primaryWeaponType) return;

    // Check unlock condition for weapons
    if (type === 'bazooka' && !this.bazooka.getIsUnlocked()) return;
    if (type === 'akm' && !this.akm.getIsUnlocked()) return;
    if (type === 'm4' && !this.m4.getIsUnlocked()) return;

    if (this.activeWeaponType === 'sniper') {
      // Cleanly cancel sniper scope and reload so state is never corrupted
      this.sniper.setScoped(false);
      this.sniper.cancelReload();
      this.sniper.setActive(false);

      // Immediately restore camera FOV to default and reset sensitivity multiplier
      this.camera.fov = GAME_CONFIG.sniper.defaultFov;
      this.camera.updateProjectionMatrix();
      this.playerController.setSensitivityMultiplier(1.0);
    } else if (this.activeWeaponType === 'knife') {
      this.knife.setActive(false);
    } else if (this.activeWeaponType === 'bazooka') {
      this.bazooka.setActive(false);
    } else if (this.activeWeaponType === 'akm') {
      this.akm.setActive(false);
    } else if (this.activeWeaponType === 'm4') {
      this.m4.setActive(false);
    }

    this.activeWeaponType = type;

    if (type === 'sniper') {
      this.sniper.setActive(true);
    } else if (type === 'knife') {
      this.knife.setActive(true);
    } else if (type === 'bazooka') {
      this.bazooka.setActive(true);
    } else if (type === 'akm') {
      this.akm.setActive(true);
    } else if (type === 'm4') {
      this.m4.setActive(true);
    }

    this.hud.setActiveWeapon(type);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    // Prevent browser context menu on right click to allow sniper scoping
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse button events for Weapon Attack (left click) and Scope (right click)
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('wheel', this.onWheel, { passive: false });

    if (this.startBtn) {
      this.startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.enterGame();
      });
    }

    if (this.startOverlay) {
      this.startOverlay.addEventListener('click', (e) => {
        if (e.target === this.startOverlay) {
          this.enterGame();
        }
      });
    }

    this.canvas.addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        if (this.supplyModal.getIsOpen()) return;
        if (document.pointerLockElement !== this.canvas) {
          try {
            this.canvas.requestPointerLock();
          } catch (_) {}
        }
      } else if (this.state === 'PAUSED' || this.state === 'MENU') {
        this.enterGame();
      }
    });
  }

  public enterGame(): void {
    if (this.state !== 'GAME_OVER') {
      this.setState('PLAYING');
      try {
        const res = this.canvas.requestPointerLock() as unknown;
        if (res && typeof (res as Promise<void>).catch === 'function') {
          (res as Promise<void>).catch((err) => {
            console.warn('Pointer lock request was postponed or denied by browser:', err);
          });
        }
      } catch (err) {
        console.warn('Pointer lock error:', err);
      }
    }
  }

  private onWheel = (e: WheelEvent): void => {
    if (this.state !== 'PLAYING' || document.pointerLockElement !== this.canvas) {
      return;
    }
    e.preventDefault();

    const order: WeaponType[] = [this.primaryWeaponType, 'knife'];
    if (this.bazooka.getIsUnlocked()) order.push('bazooka');

    const currentIndex = order.indexOf(this.activeWeaponType);
    if (currentIndex === -1) {
      this.switchWeapon(this.primaryWeaponType);
      return;
    }

    const direction = e.deltaY > 0 ? 1 : -1;
    const nextIndex = (currentIndex + direction + order.length) % order.length;
    this.switchWeapon(order[nextIndex]);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.state !== 'PLAYING' || document.pointerLockElement !== this.canvas || this.supplyModal.getIsOpen()) {
      return;
    }

    // Left click: Fire weapon or slash knife
    if (e.button === 0) {
      this.isLeftMouseDown = true;
      const targets = this.getTargets();
      if (this.activeWeaponType === 'sniper') {
        const res = this.sniper.fire(this.arena.getRaycastObstacles(), targets);
        if (res.fired) {
          this.scoreManager.recordShot(!!res.hit, !!res.isHeadshot);
        }
      } else if (this.activeWeaponType === 'knife') {
        const res = this.knife.attack(this.arena.getRaycastObstacles(), targets);
        if (res.attacked && res.hit) {
          this.scoreManager.recordShot(true, !!res.isHeadshot);
        }
      } else if (this.activeWeaponType === 'bazooka') {
        const res = this.bazooka.fire();
        if (res) {
          this.scoreManager.recordShot(false, false);
        }
      } else if (this.activeWeaponType === 'akm') {
        const res = this.akm.fire(this.arena.getRaycastObstacles(), targets);
        if (res.fired) {
          this.scoreManager.recordShot(!!res.hit, !!res.isHeadshot);
        }
      } else if (this.activeWeaponType === 'm4') {
        const res = this.m4.fire(this.arena.getRaycastObstacles(), targets);
        if (res.fired) {
          this.scoreManager.recordShot(!!res.hit, !!res.isHeadshot);
        }
      }
    }

    // Right click: Scope (Active ONLY for Sniper rifle)
    if (e.button === 2) {
      if (this.activeWeaponType === 'sniper') {
        this.rightMouseDownTime = performance.now();
        this.wasScopedOnMouseDown = this.sniper.getIsScoped();
        this.sniper.setScoped(true);
      }
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.isLeftMouseDown = false;
    }
    if (this.state !== 'PLAYING') return;

    if (e.button === 2 && this.activeWeaponType === 'sniper') {
      const holdDuration = performance.now() - this.rightMouseDownTime;
      // If held for more than 250ms, release scopes out (hold-to-aim)
      // If tapped and was already scoped, tap scopes out (toggle-to-aim)
      if (holdDuration > 250 || this.wasScopedOnMouseDown) {
        this.sniper.setScoped(false);
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.state !== 'PLAYING') return;

    // When supply selection modal is open, ignore game hotkeys and allow quick exit via Escape or E
    if (this.supplyModal.getIsOpen()) {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        this.supplyModal.close('cancelled');
      }
      return;
    }

    // Weapon switching: 1 = primary, 2 = knife, 3 = bazooka.
    if (e.code === 'Digit1' || e.code === 'Numpad1') {
      this.switchWeapon(this.primaryWeaponType);
      return;
    }

    if (e.code === 'Digit2' || e.code === 'Numpad2') {
      this.switchWeapon('knife');
      return;
    }

    if (e.code === 'Digit3' || e.code === 'Numpad3') {
      this.switchWeapon('bazooka');
      return;
    }

    // R: Reload (Active for Sniper, Bazooka, AKM & M4)
    if (e.code === 'KeyR') {
      if (this.activeWeaponType === 'sniper') {
        this.sniper.reload();
      } else if (this.activeWeaponType === 'bazooka') {
        this.bazooka.reload();
      } else if (this.activeWeaponType === 'akm') {
        this.akm.reload();
      } else if (this.activeWeaponType === 'm4') {
        this.m4.reload();
      }
      return;
    }

    // G: Throw Frag Grenade
    if (e.code === 'KeyG') {
      this.throwGrenade();
      return;
    }

    // E: Open Tactical Supply Selection Modal
    if (e.code === 'KeyE') {
      if (this.supplyDropManager.isPlayerNearCrate() && !this.supplyModal.getIsOpen()) {
        const wave = this.waveManager.getWaveNumber();
        const isBoss = isBossWave(wave, GAME_CONFIG.boss);
        this.openSupplyModal(wave, isBoss);
      }
      return;
    }
  };

  public throwGrenade(): void {
    if (this.state !== 'PLAYING') return;
    const thrown = this.grenadeManager.throwGrenade(this.camera);
    if (thrown) {
      this.hud.updateGrenadeCount(this.grenadeManager.getGrenadeCount());
    }
  }

  private onPointerLockChange = (): void => {
    const isLocked = document.pointerLockElement === this.canvas;
    if (isLocked) {
      this.wasPointerLocked = true;
      if (this.state === 'PAUSED' || this.state === 'MENU') {
        this.setState('PLAYING');
      }
    } else {
      // If supply selection modal is open, do not trigger pause menu; game time keeps running
      if (this.supplyModal.getIsOpen()) {
        return;
      }
      // Only pause if player was previously pointer-locked and lost lock (e.g. Esc pressed)
      if (this.state === 'PLAYING' && this.wasPointerLocked) {
        this.wasPointerLocked = false;
        this.setState('PAUSED');
      }
    }
  };

  public handlePlayerDeath(): void {
    if (this.state === 'GAME_OVER' || this.state === 'SUBMITTING_SCORE' || this.state === 'SCORE_SUBMITTED') return;
    this.isVictory = false;

    if (this.supplyModal.getIsOpen()) {
      this.supplyModal.close();
    }
    this.scoreManager.finalizeSession();
    this.setState('GAME_OVER');
  }

  public handleGameVictory(_totalWaves?: number): void {
    void _totalWaves;
    if (this.state === 'GAME_OVER' || this.state === 'SUBMITTING_SCORE' || this.state === 'SCORE_SUBMITTED') return;
    this.isVictory = true;
    if (this.supplyModal.getIsOpen()) {
      this.supplyModal.close();
    }
    this.scoreManager.finalizeSession();
    this.setState('GAME_OVER');
  }

  private async submitCurrentScore(payload: ScorePayload): Promise<void> {
    const enqueueResult = this.scoreSubmissionQueue.enqueue(payload);

    if (enqueueResult.status === 'already_submitted') {
      this.setState('SCORE_SUBMITTED');
      return;
    }

    this.setState('SUBMITTING_SCORE');
    if (!enqueueResult.persisted) {
      this.gameOverScreen.setSubmissionStatus(
        'Score disimpan di memori sesi. localStorage tidak tersedia; submission tetap dicoba.',
        false
      );
    } else {
      this.gameOverScreen.setSubmissionStatus('Mengirim score ke mock leaderboard...', false);
    }

    const result = await this.scoreSubmissionQueue.submit(
      payload,
      this.leaderboardClient,
      GAME_CONFIG.leaderboard.submissionTimeoutMs
    );

    this.applySubmissionResult(result);
  }

  private applySubmissionResult(result: QueueSubmissionResult): void {
    switch (result.status) {
      case 'submitted':
      case 'already_submitted':
        this.setState('SCORE_SUBMITTED');
        break;

      case 'timeout':
        this.setState('GAME_OVER');
        this.gameOverScreen.setSubmissionStatus(`${result.message} Score tetap berada di queue.`, true);
        break;

      case 'offline':
      case 'failed':
        this.setState('GAME_OVER');
        this.gameOverScreen.setSubmissionStatus(`${result.message} Score tetap berada di queue.`, true);
        break;

      case 'storage_error':
        this.setState('GAME_OVER');
        this.gameOverScreen.setSubmissionStatus(result.message, true);
        break;
    }
  }

  private async retryCurrentScoreSubmission(): Promise<void> {
    if (!this.currentScorePayload) return;
    if (this.scoreSubmissionQueue.isSubmitted(this.currentScorePayload.sessionId)) {
      this.setState('SCORE_SUBMITTED');
      return;
    }

    this.setState('SUBMITTING_SCORE');
    this.gameOverScreen.setRetryEnabled(false);
    this.gameOverScreen.setSubmissionStatus('Mencoba mengirim ulang score...', false);

    const result = await this.scoreSubmissionQueue.submit(
      this.currentScorePayload,
      this.leaderboardClient,
      GAME_CONFIG.leaderboard.submissionTimeoutMs
    );

    this.applySubmissionResult(result);
  }

  private async retryPendingScoresOnStartup(): Promise<void> {
    if (this.scoreSubmissionQueue.getPendingCount() === 0) return;

    const results = await this.scoreSubmissionQueue.retryAll(
      this.leaderboardClient,
      GAME_CONFIG.leaderboard.submissionTimeoutMs
    );

    const submittedCount = results.filter(
      (result) => result.status === 'submitted' || result.status === 'already_submitted'
    ).length;

    if (submittedCount > 0) {
      console.info(`[Leaderboard] Auto-retry submitted ${submittedCount} queued score(s).`);
    }
  }

  public restartGame(): void {
    // 1. Hide Game Over Screen
    this.gameOverScreen.hide();
    this.currentScorePayload = null;
    this.isVictory = false;

    // 2. Reset Player State & Position
    this.playerHealth.reset();
    const startPos = GAME_CONFIG.player.startingPosition;
    this.playerController.resetPosition(startPos.x, startPos.y, startPos.z);
    this.playerController.resetInputs();

    // 3. Reset Weapons, Projectiles & Munitions.
    // A death starts a completely new run, so every acquired supply weapon
    // is discarded and the default loadout is restored.
    this.sniper.resetAmmo();
    this.sniper.resetStats();
    this.sniper.setScoped(false);
    this.sniper.cancelReload();

    this.bazooka.lock();
    this.bazooka.resetAmmo();
    this.akm.lock();
    this.akm.resetAmmo();
    this.m4.lock();
    this.m4.resetAmmo();

    this.primaryWeaponType = 'sniper';
    this.grenadeManager.reset(1);
    this.projectileManager.clear();
    this.hud.updateGrenadeCount(1);
    this.hud.setBazookaUnlocked(false);
    this.hud.setAkmUnlocked(false);
    this.hud.setM4Unlocked(false);
    this.hud.setPrimarySlotWeapon('sniper');
    this.switchWeapon('sniper');

    // 4. Reset Dummies & Clear all active enemies and supply crates
    this.clearEnemies();
    this.supplyDropManager.clearCrate();
    if (this.supplyModal.getIsOpen()) {
      this.supplyModal.close();
    }
    for (const dummy of this.targetDummies) {
      dummy.reset();
    }

    // 5. Reset Wave Manager, Score Manager & HUD
    this.waveManager.reset();
    this.scoreManager.reset(true);
    this.hud.updateScore(0);
    this.hud.hideBossBar();
    this.hud.hideIntermission();
    this.hud.setClaimRewardAvailable(false);

    // 6. Enter Playing state & start Wave 1
    this.setState('PLAYING');
    try {
      this.canvas.requestPointerLock();
    } catch (_) {}
    this.waveManager.startFirstWave();
  }

  public setState(newState: GameStateType): void {
    this.state = newState;

    switch (this.state) {
      case 'PLAYING':
        if (this.startOverlay) this.startOverlay.style.display = 'none';
        this.pauseMenu.hide();
        this.gameOverScreen.hide();
        this.hud.show();
        this.playerController.setEnabled(true);
        if (this.waveManager.getState() === 'NOT_STARTED') {
          this.waveManager.startFirstWave();
        }
        break;

      case 'PAUSED':
        this.pauseMenu.show();
        this.gameOverScreen.hide();
        this.playerController.setEnabled(false);
        this.hud.updateStaminaBar(false, this.playerController.getStaminaRatio());
        if (this.activeWeaponType === 'sniper') {
          this.sniper.setScoped(false); // Unscope when paused
        }
        break;

      case 'MENU':
        if (this.startOverlay) this.startOverlay.style.display = 'flex';
        this.pauseMenu.hide();
        this.gameOverScreen.hide();
        this.hud.hide();
        this.hud.setSupplyInteractionAvailable(false);
        this.playerController.setEnabled(false);
        if (this.activeWeaponType === 'sniper') {
          this.sniper.setScoped(false);
        }
        break;

      case 'GAME_OVER':
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        this.playerController.setEnabled(false);
        if (this.activeWeaponType === 'sniper') {
          this.sniper.setScoped(false);
          this.sniper.cancelReload();
        }
        this.pauseMenu.hide();
        this.hud.hide();

        if (!this.currentScorePayload) {
          this.scoreManager.finalizeSession();
          this.currentScorePayload = this.scoreManager.generatePayload(
            this.identityProvider.getIdentity().playerId,
            this.identityProvider.getIdentity().nickname
          );
          const payload = this.currentScorePayload;
          const sniperStats = this.sniper.getStats();

          this.gameOverScreen.show({
            score: payload.score,
            waveReached: payload.waveReached,
            enemiesDefeated: payload.kills,
            bossesKilled: payload.bossesKilled,
            shotsFired: sniperStats.shotsFired,
            shotsHit: sniperStats.shotsHit,
            headshots: payload.headshots,
            accuracy: payload.accuracy,
            durationSeconds: payload.durationSeconds,
            sessionId: payload.sessionId,
            isVictory: this.isVictory,
          });

          void this.submitCurrentScore(payload);
        }
        break;

      case 'SUBMITTING_SCORE':
        this.playerController.setEnabled(false);
        this.pauseMenu.hide();
        this.hud.hide();
        break;

      case 'SCORE_SUBMITTED':
        this.playerController.setEnabled(false);
        this.pauseMenu.hide();
        this.hud.hide();
        this.gameOverScreen.setSubmissionStatus('Score berhasil dikirim. Session ID ini tidak akan dikirim ulang.', false, true);
        break;
    }
  }

  private readonly onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.setState('MENU');
    if (!this.hasRetriedPendingScoresOnStartup) {
      this.hasRetriedPendingScoresOnStartup = true;
      void this.retryPendingScoresOnStartup();
    }
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    // Delta time clamped to maximum 0.05 seconds to avoid frame-rate dependency
    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, 0.05);

    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  public update(dt: number): void {
    if (this.state === 'PLAYING') {
      if (this.playerHealth.isDead()) {
        this.handlePlayerDeath();
        return;
      }

      // Continuous full-auto firing for Assault Rifles while mouse is held
      if (this.isLeftMouseDown && document.pointerLockElement === this.canvas) {
        const targets = this.getTargets();
        if (this.activeWeaponType === 'akm') {
          const res = this.akm.fire(this.arena.getRaycastObstacles(), targets);
          if (res.fired) {
            this.scoreManager.recordShot(!!res.hit, !!res.isHeadshot);
          }
        } else if (this.activeWeaponType === 'm4') {
          const res = this.m4.fire(this.arena.getRaycastObstacles(), targets);
          if (res.fired) {
            this.scoreManager.recordShot(!!res.hit, !!res.isHeadshot);
          }
        }
      }

      // 1. Update Player Movement & Look
      this.playerController.update(dt);
      this.hud.updateStaminaBar(
        this.playerController.isSprintKeyPressed(),
        this.playerController.getStaminaRatio()
      );

      // 2. Update Weapons
      this.sniper.update(dt, this.playerController);
      this.knife.update(dt);
      this.bazooka.update(dt, this.arena.getRaycastObstacles(), this.getTargets());
      this.akm.update(dt);
      this.m4.update(dt);

      // 3. Update Target Dummies (Billboarding health bars, damage popups, respawn timers)
      for (let i = 0; i < this.targetDummies.length; i++) {
        this.targetDummies[i].update(dt, this.camera.position);
      }

      // 4. Update Hostile Enemies (Pursuit, Collision Sliding, Melee Attacks, Death Cleanup)
      const livingEnemies = this.enemies.filter((e) => !e.getIsDead());
      const livingEnemyPositions: THREE.Vector3[] = livingEnemies.map((e) => e.position);

      const obstacles = this.arena.getRaycastObstacles();

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(
          dt,
          this.playerController.position,
          this.playerHealth,
          this.camera.position,
          livingEnemyPositions,
          this.projectileManager,
          obstacles
        );
        if (enemy.isFullyRemoved()) {
          this.enemies.splice(i, 1);
        }
      }

      this.hud.updateRadar(
        this.playerController.position,
        this.playerController.getHeading(),
        livingEnemyPositions
      );

      // Update Enemy Ranged Projectiles (flight, collisions against obstacles, and hits on player)
      this.projectileManager.update(
        dt,
        this.playerController.position,
        this.playerHealth,
        obstacles
      );

      // 5. Update WaveManager (Spawning queue, wave scaling, intermission countdown, boss transitions)
      this.waveManager.update(dt, this.playerController.position, livingEnemies);

      // Supply selection has its own 10-second timer, independent of wave intermission.
      if (this.supplyModal.getIsOpen()) {
        this.supplyModal.update(dt);
      }

      // 6. Update Tactical Munitions & Wave Supply Drops
      this.grenadeManager.update(dt, this.getTargets());
      this.supplyDropManager.update(dt, this.playerController.position);
      this.hud.setSupplyInteractionAvailable(
        this.supplyDropManager.isPlayerNearCrate() && !this.supplyModal.getIsOpen()
      );
      this.hud.updateGrenadeCount(this.grenadeManager.getGrenadeCount());

      // Update active boss HP on HUD if engaged
      const currentBoss = this.waveManager.getCurrentBoss();
      if (currentBoss && !currentBoss.getIsDead()) {
        this.hud.updateBossHp(currentBoss.getHp(), currentBoss.getMaxHp());
      }

      // Update Wave and Enemies remaining on HUD
      this.hud.updateWaveInfo(
        this.waveManager.getWaveNumber(),
        this.waveManager.isCurrentWaveBoss(),
        this.waveManager.getRemainingEnemies(),
        this.waveManager.getTotalRegularEnemies()
      );

      // 7. Update HUD with active weapon state
      const currentLivingCount = livingEnemies.length;
      const bazookaAmmo = this.bazooka.getAmmo();
      this.hud.updateBazookaAmmo(bazookaAmmo.current, bazookaAmmo.reserve);
      const primaryAmmo = this.primaryWeaponType === 'sniper'
        ? this.sniper.getAmmo()
        : this.primaryWeaponType === 'akm'
        ? this.akm.getAmmo()
        : this.m4.getAmmo();
      this.hud.updatePrimarySlotAmmo(primaryAmmo.inMag, primaryAmmo.reserve);
      const activeAmmo =
        this.activeWeaponType === 'sniper'
          ? this.sniper.getAmmo()
          : this.activeWeaponType === 'bazooka'
          ? { inMag: bazookaAmmo.current, reserve: bazookaAmmo.reserve, maxMag: 1 }
          : this.activeWeaponType === 'akm'
          ? this.akm.getAmmo()
          : this.activeWeaponType === 'm4'
          ? this.m4.getAmmo()
          : null;

      const isReloading =
        this.activeWeaponType === 'sniper'
          ? this.sniper.getIsReloading()
          : this.activeWeaponType === 'bazooka'
          ? this.bazooka.getIsReloading()
          : this.activeWeaponType === 'akm'
          ? this.akm.getIsReloading()
          : this.activeWeaponType === 'm4'
          ? this.m4.getIsReloading()
          : false;

      const reloadProgress =
        this.activeWeaponType === 'sniper'
          ? this.sniper.getReloadProgress()
          : this.activeWeaponType === 'bazooka'
          ? this.bazooka.getReloadProgress()
          : this.activeWeaponType === 'akm'
          ? this.akm.getReloadProgress()
          : this.activeWeaponType === 'm4'
          ? this.m4.getReloadProgress()
          : 0;

      this.hud.updateWeaponDisplay(
        this.activeWeaponType,
        activeAmmo,
        this.sniper.getStats(),
        isReloading,
        reloadProgress,
        this.sniper.getIsScoped(),
        this.knife.getCooldownProgress(),
        currentLivingCount
      );
    }
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('wheel', this.onWheel);

    this.playerController.dispose();
    this.sniper.dispose();
    this.knife.dispose();
    this.bazooka.dispose();
    this.akm.dispose();
    this.m4.dispose();
    this.supplyModal.dispose();
    this.grenadeManager.dispose();
    this.projectileManager.dispose();
    this.supplyDropManager.dispose();
    for (const dummy of this.targetDummies) {
      dummy.dispose();
    }
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies.length = 0;
    this.waveManager.reset();
    this.hud.dispose();
    this.gameOverScreen.dispose();
    this.renderer.dispose();
  }
}
