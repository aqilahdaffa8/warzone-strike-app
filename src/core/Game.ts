import * as THREE from 'three';
import { Arena } from '../environment/Arena';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameStateType } from './GameState';
import { PlayerHealth } from '../player/PlayerHealth';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock: THREE.Clock;

  private readonly arena: Arena;
  private readonly playerHealth: PlayerHealth;
  private readonly playerController: PlayerController;
  private readonly hud: HUD;
  private readonly pauseMenu: PauseMenu;

  private state: GameStateType = 'MENU';
  private isRunning: boolean = false;

  private readonly startOverlay: HTMLElement | null;
  private readonly startBtn: HTMLButtonElement | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x11161d);
    this.scene.fog = new THREE.Fog(0x11161d, 35, 95);

    // 2. Camera setup (first-person perspective)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);

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

    // 7. UI Systems
    this.hud = new HUD(this.playerHealth);
    this.pauseMenu = new PauseMenu(this.playerController, this.playerHealth);
    this.pauseMenu.setOnResume(() => {
      this.canvas.requestPointerLock();
    });

    this.startOverlay = document.querySelector<HTMLElement>('#start-overlay');
    this.startBtn = document.querySelector<HTMLButtonElement>('#btn-start-game');

    // 8. Event listeners
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

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    // Prevent browser context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => e.preventDefault());

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
        break;

      case 'MENU':
        if (this.startOverlay) this.startOverlay.style.display = 'flex';
        this.pauseMenu.hide();
        this.hud.hide();
        this.playerController.setEnabled(false);
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
      this.playerController.update(dt);
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
    this.playerController.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}
