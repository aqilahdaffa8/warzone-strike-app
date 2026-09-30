import * as THREE from 'three';
import { EnemyConfig } from '../config/gameConfig';
import { DamageableTarget, HitResult } from '../weapons/Weapon';
import { EnemyHealth } from './EnemyHealth';
import { EnemyAI } from './EnemyAI';
import { PlayerHealth } from '../player/PlayerHealth';

/**
 * Enemy entity representing hostile combatants.
 * Implements DamageableTarget for weapon raycasting and headshot detection.
 */
export class Enemy implements DamageableTarget {
  public readonly id: string;
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;

  private readonly config: EnemyConfig;
  private readonly scene: THREE.Scene;
  private readonly health: EnemyHealth;
  private readonly ai: EnemyAI;

  // Placeholder Meshes & Materials
  private readonly bodyMesh: THREE.Mesh;
  private readonly headMesh: THREE.Mesh;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly headMaterial: THREE.MeshStandardMaterial;
  private readonly limbMaterial: THREE.MeshStandardMaterial;
  private readonly bladeMaterial: THREE.MeshStandardMaterial;

  // Arm Groups for Melee Attack Animation
  private readonly rightArmPivot: THREE.Group;
  private readonly leftArmPivot: THREE.Group;

  // Hitbox Meshes
  private readonly hitboxMeshes: THREE.Mesh[];

  // Hit Flash
  private flashTimer: number = 0;

  // World-Space Health Bar Billboard
  private readonly healthBarGroup: THREE.Group;
  private readonly healthBarFill: THREE.Mesh;
  private readonly healthBarFillGeo: THREE.PlaneGeometry;

  // Floating Damage Indicators
  private readonly activeDamagePopups: {
    sprite: THREE.Sprite;
    texture: THREE.CanvasTexture;
    life: number;
    maxLife: number;
    velocityY: number;
  }[] = [];

  // Death State and Cleanup
  private isDead: boolean = false;
  private deathTimer: number = 0;
  private readonly deathDuration: number = 1.2; // 1.2s total death animation before cleanup
  private isFullyDisposed: boolean = false;

  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    config: EnemyConfig,
    colliders: THREE.Box3[],
    scene: THREE.Scene
  ) {
    this.id = id;
    this.config = config;
    this.scene = scene;

    this.group = new THREE.Group();
    this.group.position.copy(spawnPos);
    this.position = this.group.position;

    this.health = new EnemyHealth(config.maxHp);
    this.ai = new EnemyAI(config, colliders);

    // 1. Materials
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b2b33, // Tactical charcoal urban suit
      roughness: 0.7,
      metalness: 0.2,
      transparent: true,
      opacity: 1.0,
    });

    this.headMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b1e1e, // High-contrast Crimson Red helmet / head
      roughness: 0.5,
      metalness: 0.3,
      transparent: true,
      opacity: 1.0,
    });

    this.limbMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2328, // Dark limbs
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 1.0,
    });

    this.bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x8fa3b8, // Tactical blade edge
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 1.0,
    });

    // 2. Geometry: Body (Capsule) & Head (Sphere)
    // Torso / Body (y: 0.2 to 1.5)
    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.75, 8, 16);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.bodyMesh.position.y = 0.95;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyMesh.userData = {
      type: 'hitbox',
      part: 'body',
      target: this,
    };
    this.group.add(this.bodyMesh);

    // Tactical Armor Vest Plate (visual distinction)
    const vestGeo = new THREE.BoxGeometry(0.55, 0.5, 0.42);
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x422222, // Dark crimson armored plate
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 1.0,
    });
    const vestMesh = new THREE.Mesh(vestGeo, vestMat);
    vestMesh.position.y = 0.95;
    vestMesh.castShadow = true;
    this.group.add(vestMesh);

    // Head (Sphere) - Distinct headshot hitbox
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, this.headMaterial);
    this.headMesh.position.y = 1.62;
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headMesh.userData = {
      type: 'hitbox',
      part: 'head',
      target: this,
    };
    this.group.add(this.headMesh);

    // Glowing Eyes / Visor (tactical combatant indicator)
    const visorGeo = new THREE.BoxGeometry(0.28, 0.06, 0.12);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 1.62, 0.18);
    this.group.add(visorMesh);

    // 3. Arms & Melee Weapon
    // Right Arm Pivot (Shoulder at y = 1.25, x = 0.36)
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.36, 1.25, 0);

    const armGeo = new THREE.BoxGeometry(0.12, 0.42, 0.12);
    const rightArmMesh = new THREE.Mesh(armGeo, this.limbMaterial);
    rightArmMesh.position.set(0, -0.21, 0);
    rightArmMesh.castShadow = true;
    this.rightArmPivot.add(rightArmMesh);

    // Melee Blade attached to right hand
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.28, 0.08);
    const bladeMesh = new THREE.Mesh(bladeGeo, this.bladeMaterial);
    bladeMesh.position.set(0, -0.42, 0.1);
    bladeMesh.rotation.x = Math.PI / 4;
    this.rightArmPivot.add(bladeMesh);

    this.group.add(this.rightArmPivot);

    // Left Arm Pivot (Shoulder at y = 1.25, x = -0.36)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.36, 1.25, 0);

    const leftArmMesh = new THREE.Mesh(armGeo, this.limbMaterial);
    leftArmMesh.position.set(0, -0.21, 0);
    leftArmMesh.castShadow = true;
    this.leftArmPivot.add(leftArmMesh);

    this.group.add(this.leftArmPivot);

    this.hitboxMeshes = [this.headMesh, this.bodyMesh];

    // 4. Overhead Health Bar Billboard
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.set(0, 2.05, 0);

    const bgBarGeo = new THREE.PlaneGeometry(0.85, 0.09);
    const bgBarMat = new THREE.MeshBasicMaterial({ color: 0x161b22, side: THREE.DoubleSide });
    const bgBarMesh = new THREE.Mesh(bgBarGeo, bgBarMat);
    this.healthBarGroup.add(bgBarMesh);

    this.healthBarFillGeo = new THREE.PlaneGeometry(0.81, 0.06);
    this.healthBarFillGeo.translate(0.405, 0, 0);
    const fillBarMat = new THREE.MeshBasicMaterial({ color: 0x2ea043, side: THREE.DoubleSide });
    this.healthBarFill = new THREE.Mesh(this.healthBarFillGeo, fillBarMat);
    this.healthBarFill.position.set(-0.405, 0, 0.005);
    this.healthBarGroup.add(this.healthBarFill);

    this.group.add(this.healthBarGroup);

    // Add group to scene and compute initial world matrices
    this.scene.add(this.group);
    this.group.updateMatrixWorld(true);
  }

  public getHitboxMeshes(): THREE.Mesh[] {
    if (this.isDead) return [];
    return this.hitboxMeshes;
  }

  public getHp(): number {
    return this.health.getHp();
  }

  public getMaxHp(): number {
    return this.health.getMaxHp();
  }

  public getIsDead(): boolean {
    return this.isDead;
  }

  public isFullyRemoved(): boolean {
    return this.isFullyDisposed;
  }

  public takeDamage(amount: number, isHeadshot: boolean, hitPoint?: THREE.Vector3): HitResult {
    if (this.isDead) {
      return {
        damage: 0,
        isHeadshot,
        remainingHp: 0,
        isKilled: false,
      };
    }

    const { actualDamage, remainingHp, isKilled } = this.health.takeDamage(amount);

    // Emissive Hit Flash
    this.flashTimer = 0.15;
    this.bodyMaterial.emissive.setHex(isHeadshot ? 0xffbb00 : 0xff3333);
    this.headMaterial.emissive.setHex(0xffffff);

    // Floating 3D Damage Indicator
    const spawnPos = hitPoint
      ? hitPoint.clone()
      : this.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.spawnDamagePopup(amount, isHeadshot, spawnPos);

    // Update Overhead Health Bar
    this.updateHealthBar();

    if (isKilled) {
      this.triggerDeath();
    }

    return {
      damage: actualDamage,
      isHeadshot,
      remainingHp,
      isKilled,
    };
  }

  private triggerDeath(): void {
    this.isDead = true;
    this.deathTimer = this.deathDuration;
    this.ai.setDead();

    // Disable hitboxes so dead enemies don't block shots
    this.bodyMesh.userData = {};
    this.headMesh.userData = {};

    // Hide health bar
    this.healthBarGroup.visible = false;
  }

  private updateHealthBar(): void {
    const ratio = Math.max(0, this.health.getHp() / this.config.maxHp);
    this.healthBarFill.scale.x = ratio;

    const fillMat = this.healthBarFill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.5) {
      fillMat.color.setHex(0x2ea043); // Green
    } else if (ratio > 0.25) {
      fillMat.color.setHex(0xd29922); // Amber
    } else {
      fillMat.color.setHex(0xf85149); // Red
    }
  }

  private spawnDamagePopup(amount: number, isHeadshot: boolean, worldPos: THREE.Vector3): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 128);

    if (isHeadshot) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText('HEADSHOT!', 128, 45);

      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 48px monospace';
      ctx.fillText(`-${amount}`, 128, 95);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(`-${amount}`, 128, 70);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.5, 0.75, 1);
    sprite.position.copy(worldPos);
    sprite.position.y += 0.2;

    this.scene.add(sprite);

    this.activeDamagePopups.push({
      sprite,
      texture,
      life: 1.0,
      maxLife: 1.0,
      velocityY: 1.2,
    });
  }

  /**
   * Update enemy state for the frame.
   */
  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerHealth: PlayerHealth,
    cameraPos: THREE.Vector3,
    otherEnemyPositions: THREE.Vector3[]
  ): void {
    if (this.isFullyDisposed) return;

    // 1. Billboarding health bar to face camera
    if (!this.isDead) {
      this.healthBarGroup.lookAt(
        cameraPos.x,
        this.healthBarGroup.position.y + this.group.position.y,
        cameraPos.z
      );
    }

    // 2. Hit flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.bodyMaterial.emissive.setHex(0x000000);
        this.headMaterial.emissive.setHex(0x000000);
      }
    }

    // 3. Update floating damage popups
    for (let i = this.activeDamagePopups.length - 1; i >= 0; i--) {
      const popup = this.activeDamagePopups[i];
      popup.life -= dt;
      popup.sprite.position.y += popup.velocityY * dt;
      popup.velocityY = Math.max(0.2, popup.velocityY - dt * 0.8);

      const alpha = Math.max(0, popup.life / popup.maxLife);
      popup.sprite.material.opacity = alpha;

      if (popup.life <= 0) {
        this.scene.remove(popup.sprite);
        popup.texture.dispose();
        popup.sprite.material.dispose();
        this.activeDamagePopups.splice(i, 1);
      }
    }

    // 4. Death Animation & Scene Removal
    if (this.isDead) {
      this.deathTimer -= dt;

      // Collapse backwards to floor
      if (this.group.rotation.x > -Math.PI / 2) {
        this.group.rotation.x = Math.max(-Math.PI / 2, this.group.rotation.x - dt * 3.5);
      }

      // Fade out meshes
      const fadeProgress = Math.max(0, this.deathTimer / (this.deathDuration * 0.5));
      const opacity = Math.min(1.0, fadeProgress);
      this.bodyMaterial.opacity = opacity;
      this.headMaterial.opacity = opacity;
      this.limbMaterial.opacity = opacity;
      this.bladeMaterial.opacity = opacity;

      // When death sequence finishes: full resource cleanup
      if (this.deathTimer <= 0) {
        this.dispose();
      }
      return;
    }

    // 5. AI Update (Pursuit, Collision Sliding, and Melee Attack)
    const attackAction = this.ai.update(dt, this.position, playerPos, otherEnemyPositions);

    // Face towards player horizontally
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    if (Math.hypot(dx, dz) > 0.001) {
      const targetYaw = Math.atan2(dx, dz);
      // Smoothly rotate towards player
      let diff = targetYaw - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1.0, dt * 10.0);
    }

    // If AI triggered a melee attack, deal damage to PlayerHealth
    if (attackAction.attacked) {
      playerHealth.takeDamage(attackAction.damage);
    }

    // 6. Arm Swing / Melee Slash Animation
    if (this.ai.getIsAttackingAnim()) {
      const progress = this.ai.getAttackAnimProgress();
      // Strike phase (0.0 to 0.4): right arm snaps forward and down
      if (progress < 0.4) {
        const strikeT = progress / 0.4;
        const swing = Math.sin((strikeT * Math.PI) / 2);
        this.rightArmPivot.rotation.x = -Math.PI * 0.55 * swing;
        this.rightArmPivot.rotation.y = -Math.PI * 0.25 * swing;
        this.leftArmPivot.rotation.x = Math.PI * 0.2 * swing;
      } else {
        // Recovery phase (0.4 to 1.0): smooth return to ready pose
        const recoverT = (progress - 0.4) / 0.6;
        const recover = 1 - recoverT;
        this.rightArmPivot.rotation.x = -Math.PI * 0.55 * recover;
        this.rightArmPivot.rotation.y = -Math.PI * 0.25 * recover;
        this.leftArmPivot.rotation.x = Math.PI * 0.2 * recover;
      }
    } else {
      // Idle / Running Arm Bobbing
      const walkCycle = Math.sin(performance.now() * 0.008) * 0.3;
      this.rightArmPivot.rotation.x = walkCycle;
      this.leftArmPivot.rotation.x = -walkCycle;
      this.rightArmPivot.rotation.y = 0;
    }

    // Keep world transformation matrices up to date for precise weapon raycasting
    this.group.updateMatrixWorld(true);
  }

  /**
   * Disposes all meshes, geometries, materials, and textures from Three.js scene
   * to guarantee no memory leak when an enemy dies.
   */
  public dispose(): void {
    if (this.isFullyDisposed) return;
    this.isFullyDisposed = true;

    // Remove group from scene
    this.scene.remove(this.group);

    // Dispose all active damage popups
    for (const popup of this.activeDamagePopups) {
      this.scene.remove(popup.sprite);
      popup.texture.dispose();
      popup.sprite.material.dispose();
    }
    this.activeDamagePopups.length = 0;

    // Dispose geometries and materials of child meshes
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });

    this.healthBarFillGeo.dispose();
  }
}
