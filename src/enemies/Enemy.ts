import * as THREE from 'three';
import { EnemyConfig } from '../config/gameConfig';
import { DamageableTarget, HitResult } from '../weapons/Weapon';
import { EnemyHealth } from './EnemyHealth';
import { EnemyAI } from './EnemyAI';
import { PlayerHealth } from '../player/PlayerHealth';
import { EnemyProjectileManager } from './EnemyProjectileManager';
import { audio } from '../audio/AudioManager';
import { OrientedCollider } from '../environment/Arena';

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
  private rangedCooldownTimer: number = Math.random() * 1.5;

  // Placeholder Meshes & Materials
  private readonly bodyMesh: THREE.Mesh;
  private readonly headMesh: THREE.Mesh;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly headMaterial: THREE.MeshStandardMaterial;
  private readonly limbMaterial: THREE.MeshStandardMaterial;
  private readonly bladeMaterial: THREE.MeshStandardMaterial;
  private readonly vestMaterial: THREE.MeshStandardMaterial;
  private readonly visorMaterial: THREE.MeshBasicMaterial;

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

  public readonly isBossEnemy: boolean;
  public readonly scaleMultiplier: number;

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
    scene: THREE.Scene,
    scale: number = 1.0,
    isBoss: boolean = false,
    orientedColliders?: OrientedCollider[]
  ) {
    this.id = id;
    this.config = config;
    this.scene = scene;
    this.scaleMultiplier = scale;
    this.isBossEnemy = isBoss;

    this.group = new THREE.Group();
    this.group.position.copy(spawnPos);
    this.position = this.group.position;
    if (scale !== 1.0) {
      this.group.scale.set(scale, scale, scale);
    }

    this.health = new EnemyHealth(config.maxHp);
    this.ai = new EnemyAI(config, colliders, orientedColliders);

    // 1. Materials (Customized appearance for standard enemy vs heavyweight warlord Boss)
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x141820 : 0x2b2b33, // Obsidian warlord armor for Boss
      roughness: isBoss ? 0.4 : 0.7,
      metalness: isBoss ? 0.7 : 0.2,
      transparent: true,
      opacity: 1.0,
    });

    this.headMaterial = new THREE.MeshStandardMaterial({
      color: isBoss ? 0xa81c1c : 0x8b1e1e, // High-contrast Crimson Red helmet / head
      roughness: 0.4,
      metalness: isBoss ? 0.6 : 0.3,
      transparent: true,
      opacity: 1.0,
    });

    this.limbMaterial = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x0f1115 : 0x1f2328, // Dark limbs
      roughness: 0.7,
      metalness: isBoss ? 0.5 : 0.2,
      transparent: true,
      opacity: 1.0,
    });

    this.bladeMaterial = new THREE.MeshStandardMaterial({
      color: isBoss ? 0xd4af37 : 0x8fa3b8, // Gilded blade for Boss, steel for standard
      roughness: 0.25,
      metalness: 0.9,
      transparent: true,
      opacity: 1.0,
    });

    this.vestMaterial = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x361818 : 0x422222, // Heavy reinforced vest
      roughness: 0.5,
      metalness: isBoss ? 0.4 : 0.1,
      transparent: true,
      opacity: 1.0,
    });

    this.visorMaterial = new THREE.MeshBasicMaterial({
      color: isBoss ? 0xff7700 : 0xff3b30, // Piercing amber-orange visor for Boss
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
    const vestMesh = new THREE.Mesh(vestGeo, this.vestMaterial);
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
    const visorMesh = new THREE.Mesh(visorGeo, this.visorMaterial);
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

    // Ranged Rifle attached to left hand for standard enemy
    if (!isBoss) {
      const rifleGroup = new THREE.Group();
      rifleGroup.position.set(0, -0.35, 0.15);

      const rifleBodyGeo = new THREE.BoxGeometry(0.08, 0.1, 0.42);
      const rifleBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.8, roughness: 0.4 });
      const rifleBody = new THREE.Mesh(rifleBodyGeo, rifleBodyMat);
      rifleGroup.add(rifleBody);

      const rifleBarrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8);
      rifleBarrelGeo.rotateX(Math.PI / 2);
      const rifleBarrel = new THREE.Mesh(rifleBarrelGeo, rifleBodyMat);
      rifleBarrel.position.set(0, 0.02, 0.28);
      rifleGroup.add(rifleBarrel);

      const rifleMagGeo = new THREE.BoxGeometry(0.05, 0.14, 0.08);
      const rifleMag = new THREE.Mesh(rifleMagGeo, rifleBodyMat);
      rifleMag.position.set(0, -0.1, 0.05);
      rifleMag.rotation.x = -0.2;
      rifleGroup.add(rifleMag);

      this.leftArmPivot.add(rifleGroup);
    }

    this.group.add(this.leftArmPivot);

    if (isBoss) {
      // Warlord Crown Crest atop helmet
      const crestGeo = new THREE.ConeGeometry(0.08, 0.28, 4);
      const crestMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
      const crestMesh = new THREE.Mesh(crestGeo, crestMat);
      crestMesh.position.set(0, 1.95, 0);
      crestMesh.castShadow = true;
      this.group.add(crestMesh);

      // Heavy Pauldrons (Spiked shoulder plates)
      const pauldronGeo = new THREE.BoxGeometry(0.24, 0.16, 0.28);
      const pauldronMat = new THREE.MeshStandardMaterial({ color: 0x4a1818, metalness: 0.5, roughness: 0.5 });
      const pRight = new THREE.Mesh(pauldronGeo, pauldronMat);
      pRight.position.set(0.42, 1.32, 0);
      pRight.castShadow = true;
      this.group.add(pRight);

      const pLeft = new THREE.Mesh(pauldronGeo, pauldronMat);
      pLeft.position.set(-0.42, 1.32, 0);
      pLeft.castShadow = true;
      this.group.add(pLeft);

      // Twin Heavy Plasma Cannons on Boss Shoulders
      const cannonGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.75, 12);
      cannonGeo.rotateX(Math.PI / 2);
      const cannonMat = new THREE.MeshStandardMaterial({ color: 0x1a1515, metalness: 0.85, roughness: 0.3 });
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

      const cRight = new THREE.Mesh(cannonGeo, cannonMat);
      cRight.position.set(0.46, 1.45, 0.25);
      cRight.castShadow = true;
      this.group.add(cRight);

      const ringRGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.08, 12);
      ringRGeo.rotateX(Math.PI / 2);
      const ringR = new THREE.Mesh(ringRGeo, ringMat);
      ringR.position.set(0.46, 1.45, 0.58);
      this.group.add(ringR);

      const cLeft = new THREE.Mesh(cannonGeo, cannonMat);
      cLeft.position.set(-0.46, 1.45, 0.25);
      cLeft.castShadow = true;
      this.group.add(cLeft);

      const ringL = new THREE.Mesh(ringRGeo, ringMat);
      ringL.position.set(-0.46, 1.45, 0.58);
      this.group.add(ringL);
    }

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

  public isBoss(): boolean {
    return this.isBossEnemy;
  }

  public getHealth(): EnemyHealth {
    return this.health;
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

    this.lastHitWasHeadshot = isHeadshot;
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

  private lastHitWasHeadshot: boolean = false;

  public getLastHitWasHeadshot(): boolean {
    return this.lastHitWasHeadshot;
  }

  private readonly deathListeners: ((enemy: Enemy, isHeadshot: boolean) => void)[] = [];

  public onDeath(callback: (enemy: Enemy, isHeadshot: boolean) => void): () => void {
    this.deathListeners.push(callback);
    return () => {
      const idx = this.deathListeners.indexOf(callback);
      if (idx !== -1) {
        this.deathListeners.splice(idx, 1);
      }
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

    // Notify registered death listeners
    for (const listener of this.deathListeners) {
      try {
        listener(this, this.lastHitWasHeadshot);
      } catch (err) {
        console.error('Error in enemy onDeath listener:', err);
      }
    }
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
    otherEnemyPositions: THREE.Vector3[],
    projectileManager?: EnemyProjectileManager,
    obstacles?: THREE.Object3D[]
  ): void {
    if (this.isFullyDisposed) return;

    // 1. Billboarding health bar to face camera (Cylindrical Yaw-only billboard)
    if (!this.isDead) {
      const dx = cameraPos.x - this.position.x;
      const dz = cameraPos.z - this.position.z;
      if (Math.hypot(dx, dz) > 0.001) {
        const worldYawToCamera = Math.atan2(dx, dz);
        this.healthBarGroup.rotation.set(0, worldYawToCamera - this.group.rotation.y, 0);
      }
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
      this.vestMaterial.opacity = opacity;
      this.visorMaterial.opacity = opacity;

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
      playerHealth.takeDamage(attackAction.damage, this.position);
      audio.enemyMelee(this.position, this.isBossEnemy);
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

    // 7. Ranged Attack Execution (Standard Tactical Rifle or Boss Dual Plasma Cannons)
    if (projectileManager && !this.isDead) {
      const distToPlayer = Math.hypot(playerPos.x - this.position.x, playerPos.z - this.position.z);
      if (distToPlayer >= this.config.rangedMinDistance && distToPlayer <= this.config.rangedMaxDistance) {
        this.rangedCooldownTimer -= dt;
        if (this.rangedCooldownTimer <= 0) {
          let hasLos = true;
          if (obstacles && obstacles.length > 0) {
            const eyePos = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
            const playerCenter = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
            const rayDir = new THREE.Vector3().subVectors(playerCenter, eyePos);
            const rayDist = rayDir.length();
            rayDir.normalize();

            const ray = new THREE.Ray(eyePos, rayDir);
            for (let j = 0; j < obstacles.length; j++) {
              const b = new THREE.Box3().setFromObject(obstacles[j]);
              const hit = ray.intersectBox(b, new THREE.Vector3());
              if (hit && hit.distanceTo(eyePos) < rayDist - 0.5) {
                hasLos = false;
                break;
              }
            }
          }

          if (hasLos) {
            this.rangedCooldownTimer = this.config.rangedCooldown + (Math.random() - 0.5) * 0.4;
            const targetPos = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));

            if (this.isBossEnemy) {
              // Boss fires Dual Heavy Plasma Cannons
              const rightCannonPos = new THREE.Vector3(0.46, 1.45, 0.6).applyMatrix4(this.group.matrixWorld);
              const leftCannonPos = new THREE.Vector3(-0.46, 1.45, 0.6).applyMatrix4(this.group.matrixWorld);

              projectileManager.spawnProjectile(
                rightCannonPos,
                targetPos,
                this.config.rangedDamage,
                this.config.rangedSpeed,
                true
              );
              projectileManager.spawnProjectile(
                leftCannonPos,
                targetPos,
                this.config.rangedDamage,
                this.config.rangedSpeed,
                true
              );
              audio.enemyShot(this.position, true);
            } else {
              // Standard enemy fires tactical assault rifle from left arm
              const rifleMuzzlePos = new THREE.Vector3(-0.36, 1.0, 0.5).applyMatrix4(this.group.matrixWorld);
              projectileManager.spawnProjectile(
                rifleMuzzlePos,
                targetPos,
                this.config.rangedDamage,
                this.config.rangedSpeed,
                false
              );
              audio.enemyShot(this.position, false);
            }
          }
        }
      }
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
