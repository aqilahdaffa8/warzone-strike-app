import * as THREE from 'three';
import { EnemyConfig } from '../config/gameConfig';
import { OrientedCollider, testOrientedColliders } from '../environment/Arena';

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
  private readonly orientedColliders: OrientedCollider[];

  private state: EnemyAIState = 'CHASE';
  private attackCooldownTimer: number = 0;
  private isAttackingAnim: boolean = false;
  private attackAnimTimer: number = 0;
  private readonly attackAnimDuration: number = 0.3;

  // Anti-stuck and evasion steering
  private evasionTimer: number = 0;
  private readonly evasionDir = new THREE.Vector3();

  // Reusable scratch objects to prevent per-frame garbage collection
  private readonly tempBox = new THREE.Box3();
  private readonly toPlayer = new THREE.Vector3();
  private readonly moveDir = new THREE.Vector3();
  private readonly separationVec = new THREE.Vector3();

  constructor(
    config: EnemyConfig,
    colliders: THREE.Box3[],
    orientedColliders?: OrientedCollider[]
  ) {
    this.config = config;
    this.colliders = colliders;
    this.orientedColliders = orientedColliders ?? [];
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
   * Tests whether enemy at (x, y, z) intersects any arena obstacle.
   */
  public checkCollision(x: number, y: number, z: number): boolean {
    if (this.orientedColliders.length > 0) {
      return testOrientedColliders(
        x,
        y + 0.05,
        z,
        this.config.radius,
        this.config.height - 0.1,
        this.orientedColliders
      );
    }

    this.tempBox.min.set(x - this.config.radius, y + 0.05, z - this.config.radius);
    this.tempBox.max.set(x + this.config.radius, y + this.config.height - 0.05, z + this.config.radius);

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

        // If currently executing an active evasion steer around an obstacle corner
        if (this.evasionTimer > 0) {
          this.evasionTimer -= dt;
          this.resolveMovement(enemyPos, this.evasionDir.x * step, this.evasionDir.z * step);

          // Test if forward movement path directly to player is unblocked
          const testForwardX = enemyPos.x + this.moveDir.x * step * 1.5;
          const testForwardZ = enemyPos.z + this.moveDir.z * step * 1.5;
          if (!this.checkCollision(testForwardX, enemyPos.y, testForwardZ)) {
            // Forward is clear again, end lateral evasion early!
            this.evasionTimer = 0;
          }
        } else {
          // Attempt direct movement with AABB collision sliding
          this.resolveMovement(enemyPos, this.moveDir.x * step, this.moveDir.z * step);

          const distMoved = Math.hypot(enemyPos.x - startX, enemyPos.z - startZ);

          // If direct movement is blocked or severely slowed (e.g. facing an obstacle or corner)
          if (distMoved < step * 0.5) {
            // Probe lateral tangential directions (-dz, dx) and (dz, -dx)
            const leftX = -this.moveDir.z;
            const leftZ = this.moveDir.x;
            const rightX = this.moveDir.z;
            const rightZ = -this.moveDir.x;

            const probeDistance = Math.max(step * 2.0, this.config.radius * 1.2);
            const canMoveLeft = !this.checkCollision(enemyPos.x + leftX * probeDistance, enemyPos.y, enemyPos.z + leftZ * probeDistance);
            const canMoveRight = !this.checkCollision(enemyPos.x + rightX * probeDistance, enemyPos.y, enemyPos.z + rightZ * probeDistance);

            if (canMoveLeft && canMoveRight) {
              // Both lateral sides open: pick one randomly to steer around
              const chooseLeft = Math.random() < 0.5;
              this.evasionDir.set(chooseLeft ? leftX : rightX, 0, chooseLeft ? leftZ : rightZ).normalize();
              this.evasionTimer = 0.5;
              this.resolveMovement(enemyPos, this.evasionDir.x * step, this.evasionDir.z * step);
            } else if (canMoveLeft) {
              this.evasionDir.set(leftX, 0, leftZ).normalize();
              this.evasionTimer = 0.5;
              this.resolveMovement(enemyPos, this.evasionDir.x * step, this.evasionDir.z * step);
            } else if (canMoveRight) {
              this.evasionDir.set(rightX, 0, rightZ).normalize();
              this.evasionTimer = 0.5;
              this.resolveMovement(enemyPos, this.evasionDir.x * step, this.evasionDir.z * step);
            } else {
              // Both sides blocked (e.g. concave nook or stuck between objects):
              // Apply gentle backward and diagonal nudge to free the enemy from the corner
              this.resolveMovement(
                enemyPos,
                -this.moveDir.x * step * 0.5 + (Math.random() < 0.5 ? leftX : rightX) * step * 0.4,
                -this.moveDir.z * step * 0.5 + (Math.random() < 0.5 ? leftZ : rightZ) * step * 0.4
              );
            }
          }
        }
      }
    }

    // 5. Soft Separation against other enemies (prevents stacking)
    const minDistance = this.config.radius * 2.2;
    for (let i = 0; i < otherEnemyPositions.length; i++) {
      const other = otherEnemyPositions[i];
      if (other === enemyPos) continue;
      this.separationVec.set(enemyPos.x - other.x, 0, enemyPos.z - other.z);
      let sepDist = this.separationVec.length();
      if (sepDist <= 0.001) {
        // Nudge in pseudo-random outward direction if overlapping identical positions
        this.separationVec.set(Math.sin(i * 1.7) || 0.7, 0, Math.cos(i * 1.7) || 0.7).normalize();
        sepDist = 0.001;
      }
      if (sepDist < minDistance) {
        const pushMag = (minDistance - sepDist) * 0.5 * Math.min(1.0, dt * 5.0);
        this.separationVec.divideScalar(sepDist).multiplyScalar(pushMag);
        this.resolveMovement(enemyPos, this.separationVec.x, this.separationVec.z);
      }
    }

    return attackAction;
  }
}
