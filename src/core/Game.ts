import * as THREE from 'three';
import { Arena } from '../environment/Arena';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameStateType } from './GameState';
import { PlayerHealth } from '../player/PlayerHealth';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { Sniper } from '../weapons/Sniper';
import { TargetDummy } from '../environment/TargetDummy';

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
  private readonly targetDummies: TargetDummy[] = [];
  private readonly hud: HUD;
  private readonly pauseMenu: PauseMenu;

  private state: GameStateType = 'MENU';
  private isRunning: boolean = false;

  private readonly startOverlay: HTMLElement | null;
  private readonly startBtn: HTMLButtonElement | null;

  // Track right-click interaction for hold-to-aim vs toggle-to-aim
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

    // 7. Weapon Systems (Sniper)
    this.sniper = new Sniper(GAME_CONFIG.sniper, this.camera, this.scene);

    // 8. Environment Target Dummies (Placed for comprehensive Phase 3 testing)
    this.spawnTargetDummies();

    // 9. UI Systems
    this.hud = new HUD(this.playerHealth, {
      onReloadRequested: () => {
        if (this.state === 'PLAYING') {
          this.sniper.reload();
        }
      },
      onResetAmmoRequested: () => {
        this.sniper.resetAmmo();
      },
      onResetDummiesRequested: () => {
        this.targetDummies.forEach((d) => d.reset());
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
    // Dummy 1: Open field target (distance ~14m from start position (0, 0, 12))
    // Ideal for testing basic fire, headshot vs body damage, and fire intervals
    const dummy1 = new TargetDummy(
      'dummy-open-midrange',
      new THREE.Vector3(-4, 0, -2),
      0,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy1);
    this.scene.add(dummy1.group);

    // Dummy 2: Long-distance target (distance ~34m from start position)
    // Ideal for testing 20° FOV sniper scope and long-range accuracy
    const dummy2 = new TargetDummy(
      'dummy-long-range',
      new THREE.Vector3(5, 0, -22),
      -Math.PI / 8,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy2);
    this.scene.add(dummy2.group);

    // Dummy 3: Placed directly behind shipping container-6 (at 0, 1.3, -6)
    // Looking from starting position (0, 0, 12) towards (0, 0, -10), container-6 completely blocks line of sight.
    // Shooting at it tests that bullets stop at the container and DO NOT penetrate walls.
    const dummy3 = new TargetDummy(
      'dummy-behind-container',
      new THREE.Vector3(0, 0, -10),
      0,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy3);
    this.scene.add(dummy3.group);

    // Dummy 4: Placed behind concrete barrier-2 (at -8, 0.5, 0)
    // Torso is covered by the barrier, but head is exposed above the barrier
    const dummy4 = new TargetDummy(
      'dummy-behind-barrier',
      new THREE.Vector3(-8, 0, 3),
      Math.PI,
      GAME_CONFIG.dummy
    );
    this.targetDummies.push(dummy4);
    this.scene.add(dummy4.group);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    // Prevent browser context menu on right click to allow sniper scoping
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse button events for Weapon Fire (left) and Scope (right)
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);

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

  private onMouseDown = (e: MouseEvent): void => {
    if (this.state !== 'PLAYING' || document.pointerLockElement !== this.canvas) {
      return;
    }

    // Left click: Fire sniper
    if (e.button === 0) {
      this.sniper.fire(this.arena.getRaycastObstacles(), this.targetDummies);
    }

    // Right click: Scope
    if (e.button === 2) {
      this.rightMouseDownTime = performance.now();
      this.wasScopedOnMouseDown = this.sniper.getIsScoped();
      this.sniper.setScoped(true);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.state !== 'PLAYING') return;

    if (e.button === 2) {
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

    // R: Reload
    if (e.code === 'KeyR') {
      this.sniper.reload();
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

  private setState(newState: GameStateType): void {
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
        this.sniper.setScoped(false); // Unscope when paused
        break;

      case 'MENU':
        if (this.startOverlay) this.startOverlay.style.display = 'flex';
        this.pauseMenu.hide();
        this.hud.hide();
        this.playerController.setEnabled(false);
        this.sniper.setScoped(false);
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

    if (this.state === 'PLAYING') {
      // 1. Update Player Movement & Look
      this.playerController.update(dt);

      // 2. Update Sniper (Fire timer, reload timer, FOV zoom interpolation, visuals)
      this.sniper.update(dt, this.playerController);

      // 3. Update Target Dummies (Billboarding health bars, damage popups, respawn timers)
      for (let i = 0; i < this.targetDummies.length; i++) {
        this.targetDummies[i].update(dt, this.camera.position);
      }

      // 4. Update HUD (Ammo, reload progress bar, scope overlay, stats)
      this.hud.updateWeaponState(
        this.sniper.getAmmo(),
        this.sniper.getStats(),
        this.sniper.getIsReloading(),
        this.sniper.getReloadProgress(),
        this.sniper.getIsScoped()
      );
    }

    this.render();
    requestAnimationFrame(this.loop);
  };

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

    this.playerController.dispose();
    this.sniper.dispose();
    for (const dummy of this.targetDummies) {
      dummy.dispose();
    }
    this.hud.dispose();
    this.renderer.dispose();
  }
}
