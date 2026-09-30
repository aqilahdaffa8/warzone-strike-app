import * as THREE from 'three';
import { Arena } from '../environment/Arena';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameStateType } from './GameState';
import { PlayerHealth } from '../player/PlayerHealth';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { Sniper } from '../weapons/Sniper';
import { Knife } from '../weapons/Knife';
import { WeaponType, DamageableTarget } from '../weapons/Weapon';
import { TargetDummy } from '../environment/TargetDummy';
import { Enemy } from '../enemies/Enemy';

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
  private activeWeaponType: WeaponType = 'sniper';

  private readonly targetDummies: TargetDummy[] = [];
  private readonly enemies: Enemy[] = [];
  private enemySpawnCounter: number = 0;
  private readonly hud: HUD;
  private readonly pauseMenu: PauseMenu;

  private state: GameStateType = 'MENU';
  private isRunning: boolean = false;

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

    // 7. Weapon Systems (Sniper & Knife)
    this.sniper = new Sniper(GAME_CONFIG.sniper, this.camera, this.scene);
    this.knife = new Knife(GAME_CONFIG.knife, this.camera, this.scene);

    // Set initial active weapon to Sniper
    this.sniper.setActive(true);
    this.knife.setActive(false);

    // 8. Environment Target Dummies & Enemies
    this.spawnTargetDummies();
    this.spawnInitialEnemies();

    // 9. UI Systems
    this.hud = new HUD(this.playerHealth, {
      onReloadRequested: () => {
        if (this.state === 'PLAYING' && this.activeWeaponType === 'sniper') {
          this.sniper.reload();
        }
      },
      onResetAmmoRequested: () => {
        this.sniper.resetAmmo();
      },
      onResetDummiesRequested: () => {
        this.targetDummies.forEach((d) => d.reset());
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
    });

    this.pauseMenu = new PauseMenu(this.playerController, this.playerHealth);
    this.pauseMenu.setOnResume(() => {
      this.canvas.requestPointerLock();
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

  public spawnEnemy(position?: THREE.Vector3): Enemy {
    this.enemySpawnCounter++;
    const spawnPos = position || new THREE.Vector3(
      (Math.random() - 0.5) * 26,
      0,
      (Math.random() - 0.5) * 20 - 4
    );
    const enemy = new Enemy(
      `enemy-${this.enemySpawnCounter}`,
      spawnPos,
      GAME_CONFIG.enemy,
      this.arena.getColliders(),
      this.scene
    );
    this.enemies.push(enemy);
    return enemy;
  }

  public clearEnemies(): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies.length = 0;
  }

  private spawnInitialEnemies(): void {
    // Spawn 2 hostile enemies in the arena for Phase 5 verification
    // Enemy 1: Approaching from left flank at (-10, 0, 4)
    this.spawnEnemy(new THREE.Vector3(-10, 0, 4));
    // Enemy 2: Approaching from right flank at (12, 0, 2)
    this.spawnEnemy(new THREE.Vector3(12, 0, 2));
  }

  private getTargets(): DamageableTarget[] {
    return [...this.targetDummies, ...this.enemies];
  }

  public switchWeapon(type: WeaponType): void {
    if (this.activeWeaponType === type) return;

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
    }

    this.activeWeaponType = type;

    if (type === 'sniper') {
      this.sniper.setActive(true);
    } else if (type === 'knife') {
      this.knife.setActive(true);
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
        e.stopPropagation();
        this.canvas.requestPointerLock();
      });
    }

    if (this.startOverlay) {
      this.startOverlay.addEventListener('click', () => {
        this.canvas.requestPointerLock();
      });
    }

    this.canvas.addEventListener('click', () => {
      if (this.state !== 'PLAYING') {
        this.canvas.requestPointerLock();
      }
    });
  }

  private onWheel = (e: WheelEvent): void => {
    if (this.state !== 'PLAYING' || document.pointerLockElement !== this.canvas) {
      return;
    }
    e.preventDefault();

    // Scroll switches weapon (sniper <-> knife)
    if (this.activeWeaponType === 'sniper') {
      this.switchWeapon('knife');
    } else {
      this.switchWeapon('sniper');
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.state !== 'PLAYING' || document.pointerLockElement !== this.canvas) {
      return;
    }

    // Left click: Fire Sniper or Slash Knife depending on active weapon
    if (e.button === 0) {
      const targets = this.getTargets();
      if (this.activeWeaponType === 'sniper') {
        this.sniper.fire(this.arena.getRaycastObstacles(), targets);
      } else if (this.activeWeaponType === 'knife') {
        this.knife.attack(this.arena.getRaycastObstacles(), targets);
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

    // Weapon switching: Key 1 for Sniper, Key 2 for Knife
    if (e.code === 'Digit1' || e.code === 'Numpad1') {
      this.switchWeapon('sniper');
      return;
    }

    if (e.code === 'Digit2' || e.code === 'Numpad2') {
      this.switchWeapon('knife');
      return;
    }

    // R: Reload (Active only when Sniper is equipped)
    if (e.code === 'KeyR') {
      if (this.activeWeaponType === 'sniper') {
        this.sniper.reload();
      }
    }
  };

  private onPointerLockChange = (): void => {
    const isLocked = document.pointerLockElement === this.canvas;
    if (isLocked) {
      this.setState('PLAYING');
    } else {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
      }
    }
  };

  public setState(newState: GameStateType): void {
    this.state = newState;

    switch (this.state) {
      case 'PLAYING':
        if (this.startOverlay) this.startOverlay.style.display = 'none';
        this.pauseMenu.hide();
        this.hud.show();
        this.playerController.setEnabled(true);
        break;

      case 'PAUSED':
        this.pauseMenu.show();
        this.playerController.setEnabled(false);
        if (this.activeWeaponType === 'sniper') {
          this.sniper.setScoped(false); // Unscope when paused
        }
        break;

      case 'MENU':
        if (this.startOverlay) this.startOverlay.style.display = 'flex';
        this.pauseMenu.hide();
        this.hud.hide();
        this.playerController.setEnabled(false);
        if (this.activeWeaponType === 'sniper') {
          this.sniper.setScoped(false);
        }
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
      // 1. Update Player Movement & Look
      this.playerController.update(dt);

      // 2. Update Weapons
      this.sniper.update(dt, this.playerController);
      this.knife.update(dt);

      // 3. Update Target Dummies (Billboarding health bars, damage popups, respawn timers)
      for (let i = 0; i < this.targetDummies.length; i++) {
        this.targetDummies[i].update(dt, this.camera.position);
      }

      // 4. Update Hostile Enemies (Pursuit, Collision Sliding, Melee Attacks, Death Cleanup)
      const otherEnemyPositions: THREE.Vector3[] = this.enemies.map((e) => e.position);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(
          dt,
          this.playerController.position,
          this.playerHealth,
          this.camera.position,
          otherEnemyPositions
        );
        if (enemy.isFullyRemoved()) {
          this.enemies.splice(i, 1);
        }
      }

      // 5. Update HUD with active weapon state
      this.hud.updateWeaponDisplay(
        this.activeWeaponType,
        this.activeWeaponType === 'sniper' ? this.sniper.getAmmo() : null,
        this.sniper.getStats(),
        this.sniper.getIsReloading(),
        this.sniper.getReloadProgress(),
        this.sniper.getIsScoped(),
        this.knife.getCooldownProgress(),
        this.enemies.length
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
    for (const dummy of this.targetDummies) {
      dummy.dispose();
    }
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies.length = 0;
    this.hud.dispose();
    this.renderer.dispose();
  }
}
