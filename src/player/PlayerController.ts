import * as THREE from 'three';
import { PlayerConfig } from '../config/gameConfig';
import { PlayerHealth } from './PlayerHealth';

/**
 * First-person player controller handling movement, mouse look, AABB collision sliding,
 * optional jump, and sensitivity adjustments.
 */
export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly health: PlayerHealth;
  private readonly colliders: THREE.Box3[];

  // Config parameters
  private speed: number;
  private jumpSpeed: number;
  private gravity: number;
  private height: number;
  private eyeHeight: number;
  private radius: number;
  private sensitivity: number;
  private sensitivityMultiplier: number = 1.0;

  // Spatial state
  public readonly position: THREE.Vector3;
  private velocityY: number = 0;
  private isGrounded: boolean = true;
  private yaw: number = 0;
  private pitch: number = 0;
  private isEnabled: boolean = false;

  // Input tracking
  private readonly keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  // Reusable instances to prevent per-frame garbage collection
  private readonly tempBox = new THREE.Box3();
  private readonly tempMove = new THREE.Vector3();
  private readonly tempForward = new THREE.Vector3();
  private readonly tempRight = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    health: PlayerHealth,
    colliders: THREE.Box3[],
    config: PlayerConfig
  ) {
    this.camera = camera;
    this.health = health;
    this.colliders = colliders;

    this.speed = config.speed;
    this.jumpSpeed = config.jumpSpeed;
    this.gravity = config.gravity;
    this.height = config.height;
    this.eyeHeight = config.eyeHeight;
    this.radius = config.radius;
    this.sensitivity = config.mouseSensitivity;

    this.position = new THREE.Vector3(
      config.startingPosition.x,
      config.startingPosition.y,
      config.startingPosition.z
    );

    this.camera.rotation.order = 'YXZ';
    this.updateCameraTransform();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.resetInputs();
    }
  }

  public getSensitivity(): number {
    return this.sensitivity;
  }

  public setSensitivity(value: number): void {
    this.sensitivity = Math.max(0.0001, Math.min(0.01, value));
  }

  public getSensitivityMultiplier(): number {
    return this.sensitivityMultiplier;
  }

  public setSensitivityMultiplier(value: number): void {
    this.sensitivityMultiplier = Math.max(0.01, Math.min(2.0, value));
  }

  public resetInputs(): void {
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.jump = false;
  }

  public resetPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocityY = 0;
    this.isGrounded = true;
    this.yaw = 0;
    this.pitch = 0;
    this.updateCameraTransform();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'Space':
        this.keys.jump = true;
        break;
      case 'KeyH':
      case 'KeyK':
        // Debug shortcut: reduce health by 15 for acceptance verification
        this.health.takeDamage(15);
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isEnabled) return;

    this.yaw -= e.movementX * this.sensitivity * this.sensitivityMultiplier;
    this.pitch -= e.movementY * this.sensitivity * this.sensitivityMultiplier;

    // Clamp vertical look angle (-85 deg to +85 deg)
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.updateCameraTransform();
  };

  /**
   * Tests whether an AABB centered at (x, y, z) intersects any arena obstacle.
   */
  private checkCollision(x: number, y: number, z: number): boolean {
    this.tempBox.min.set(x - this.radius, y, z - this.radius);
    this.tempBox.max.set(x + this.radius, y + this.height, z + this.radius);

    for (let i = 0; i < this.colliders.length; i++) {
      if (this.tempBox.intersectsBox(this.colliders[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolves horizontal displacement per axis, enabling smooth wall sliding.
   * Uses bisection when collision occurs to close any gap flush against the collider.
   */
  private resolveMovement(dx: number, dz: number): void {
    // 1. Resolve X axis
    if (dx !== 0) {
      if (!this.checkCollision(this.position.x + dx, this.position.y, this.position.z)) {
        this.position.x += dx;
      } else {
        let low = 0;
        let high = 1;
        for (let i = 0; i < 5; i++) {
          const mid = (low + high) * 0.5;
          if (this.checkCollision(this.position.x + dx * mid, this.position.y, this.position.z)) {
            high = mid;
          } else {
            low = mid;
          }
        }
        this.position.x += dx * low;
      }
    }

    // 2. Resolve Z axis
    if (dz !== 0) {
      if (!this.checkCollision(this.position.x, this.position.y, this.position.z + dz)) {
        this.position.z += dz;
      } else {
        let low = 0;
        let high = 1;
        for (let i = 0; i < 5; i++) {
          const mid = (low + high) * 0.5;
          if (this.checkCollision(this.position.x, this.position.y, this.position.z + dz * mid)) {
            high = mid;
          } else {
            low = mid;
          }
        }
        this.position.z += dz * low;
      }
    }
  }

  public update(dt: number): void {
    if (!this.isEnabled) return;

    // 1. Horizontal movement vector based on camera yaw
    this.tempForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.tempRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.tempMove.set(0, 0, 0);
    if (this.keys.forward) this.tempMove.add(this.tempForward);
    if (this.keys.backward) this.tempMove.sub(this.tempForward);
    if (this.keys.right) this.tempMove.add(this.tempRight);
    if (this.keys.left) this.tempMove.sub(this.tempRight);

    if (this.tempMove.lengthSq() > 0) {
      this.tempMove.normalize().multiplyScalar(this.speed * dt);
      this.resolveMovement(this.tempMove.x, this.tempMove.z);
    }

    // 2. Vertical movement (jump and gravity)
    if (this.keys.jump && this.isGrounded) {
      this.velocityY = this.jumpSpeed;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocityY -= this.gravity * dt;
      this.position.y += this.velocityY * dt;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }

    // 3. Keep camera in sync with player position and eye height
    this.updateCameraTransform();
  }

  private updateCameraTransform(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
