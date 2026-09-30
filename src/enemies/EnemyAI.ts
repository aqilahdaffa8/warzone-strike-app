import * as THREE from 'three';
import { EnemyConfig } from '../config/gameConfig';

export interface EnemyAttackAction {
  attacked: boolean;
  damage: number;
}

export type EnemyAIState = 'CHASE' | 'ATTACK' | 'DEAD';

/**
 * Handles Enemy movement, path steering, collision resolution against arena obstacles,
 * and melee attack triggering.
 */
export class EnemyAI {
  private readonly config: EnemyConfig;
  private readonly colliders: THREE.Box3[];

  private state: EnemyAIState = 'CHASE';
  private attackCooldownTimer: number = 0;
  private isAttackingAnim: boolean = false;
  private attackAnimTimer: number = 0;
  private readonly attackAnimDuration: number = 0.3;

  // Reusable scratch objects to prevent per-frame garbage collection
  private readonly tempBox = new THREE.Box3();
  private readonly toPlayer = new THREE.Vector3();
  private readonly moveDir = new THREE.Vector3();
  private readonly separationVec = new THREE.Vector3();

  constructor(config: EnemyConfig, colliders: THREE.Box3[]) {
    this.config = config;
    this.colliders = colliders;
    // Stagger initial attack cooldown slightly so multiple enemies don't all hit on the exact same frame
    this.attackCooldownTimer = Math.random() * 0.5;
  }

  public getState(): EnemyAIState {
    return this.state;
  }

  public getIsAttackingAnim(): boolean {
    return this.isAttackingAnim;
  }

  public getAttackAnimProgress(): number {
    if (!this.isAttackingAnim) return 0;
    return 1 - Math.max(0, this.attackAnimTimer / this.attackAnimDuration);
  }

  public setDead(): void {
    this.state = 'DEAD';
    this.isAttackingAnim = false;
  }

  /**
   * Tests whether an AABB centered at (x, y, z) intersects any arena obstacle.
   */
  public checkCollision(x: number, y: number, z: number): boolean {
    this.tempBox.min.set(x - this.config.radius, y, z - this.config.radius);
    this.tempBox.max.set(x + this.config.radius, y + this.config.height, z + this.config.radius);

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
  public resolveMovement(pos: THREE.Vector3, dx: number, dz: number): void {
    // 1. Resolve X axis
    if (dx !== 0) {
      if (!this.checkCollision(pos.x + dx, pos.y, pos.z)) {
        pos.x += dx;
      } else {
        let low = 0;
        let high = 1;
        for (let i = 0; i < 5; i++) {
          const mid = (low + high) * 0.5;
          if (this.checkCollision(pos.x + dx * mid, pos.y, pos.z)) {
            high = mid;
          } else {
            low = mid;
          }
        }
        pos.x += dx * low;
      }
    }

    // 2. Resolve Z axis
    if (dz !== 0) {
      if (!this.checkCollision(pos.x, pos.y, pos.z + dz)) {
        pos.z += dz;
      } else {
        let low = 0;
        let high = 1;
        for (let i = 0; i < 5; i++) {
          const mid = (low + high) * 0.5;
          if (this.checkCollision(pos.x, pos.y, pos.z + dz * mid)) {
            high = mid;
          } else {
            low = mid;
          }
        }
        pos.z += dz * low;
      }
    }
  }

  /**
   * Update enemy AI logic for the current frame.
   *
   * @param dt Delta time in seconds (clamped)
   * @param enemyPos Current enemy world position (modified in-place)
   * @param playerPos Current player world position
   * @param otherEnemyPositions Other enemy positions for soft crowd separation
   */
  public update(
    dt: number,
    enemyPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    otherEnemyPositions: THREE.Vector3[]
  ): EnemyAttackAction {
    if (this.state === 'DEAD') {
      return { attacked: false, damage: 0 };
    }

    // 1. Update attack animation timer
    if (this.isAttackingAnim) {
      this.attackAnimTimer -= dt;
      if (this.attackAnimTimer <= 0) {
        this.isAttackingAnim = false;
        this.attackAnimTimer = 0;
      }
    }

    // 2. Decrement attack cooldown
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    }

    // 3. Vector to player
    this.toPlayer.set(playerPos.x - enemyPos.x, 0, playerPos.z - enemyPos.z);
    const distanceToPlayer = this.toPlayer.length();

    // 4. State Determination: Chase vs Melee Attack
    if (distanceToPlayer <= this.config.attackRange) {
      this.state = 'ATTACK';
    } else {
      this.state = 'CHASE';
    }

    let attackAction: EnemyAttackAction = { attacked: false, damage: 0 };

    if (this.state === 'ATTACK') {
      // Within melee range: trigger attack if cooldown expired
      if (this.attackCooldownTimer <= 0) {
        this.attackCooldownTimer = this.config.attackCooldown;
        this.isAttackingAnim = true;
        this.attackAnimTimer = this.attackAnimDuration;
        attackAction = { attacked: true, damage: this.config.damage };
      }
    } else if (this.state === 'CHASE') {
      // Outside attack range: move towards player
      if (distanceToPlayer > 0.001) {
        this.moveDir.copy(this.toPlayer).divideScalar(distanceToPlayer);

        const step = this.config.speed * dt;
        const startX = enemyPos.x;
        const startZ = enemyPos.z;

        // Attempt direct movement with AABB collision sliding
        this.resolveMovement(enemyPos, this.moveDir.x * step, this.moveDir.z * step);

        const distMoved = Math.hypot(enemyPos.x - startX, enemyPos.z - startZ);

        // If direct movement is largely blocked (e.g. facing a flat wall perpendicular to player),
        // probe lateral tangential directions to steer around the obstacle edge
        if (distMoved < step * 0.3) {
          // Probe both left (-dz, dx) and right (dz, -dx)
          const leftX = -this.moveDir.z;
          const leftZ = this.moveDir.x;

          const rightX = this.moveDir.z;
          const rightZ = -this.moveDir.x;

          // Check if left probe is clear
          const canMoveLeft = !this.checkCollision(enemyPos.x + leftX * step * 1.5, enemyPos.y, enemyPos.z + leftZ * step * 1.5);
          const canMoveRight = !this.checkCollision(enemyPos.x + rightX * step * 1.5, enemyPos.y, enemyPos.z + rightZ * step * 1.5);

          if (canMoveLeft) {
            this.resolveMovement(enemyPos, leftX * step * 0.8, leftZ * step * 0.8);
          } else if (canMoveRight) {
            this.resolveMovement(enemyPos, rightX * step * 0.8, rightZ * step * 0.8);
          }
        }
      }
    }

    // 5. Soft Separation against other enemies (prevents stacking)
    const minDistance = this.config.radius * 2.2;
    for (let i = 0; i < otherEnemyPositions.length; i++) {
      const other = otherEnemyPositions[i];
      this.separationVec.set(enemyPos.x - other.x, 0, enemyPos.z - other.z);
      const sepDist = this.separationVec.length();
      if (sepDist > 0.001 && sepDist < minDistance) {
        const pushMag = (minDistance - sepDist) * 0.5 * Math.min(1.0, dt * 5.0);
        this.separationVec.divideScalar(sepDist).multiplyScalar(pushMag);
        this.resolveMovement(enemyPos, this.separationVec.x, this.separationVec.z);
      }
    }

    return attackAction;
  }
}
