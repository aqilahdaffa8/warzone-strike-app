import * as THREE from 'three';
import { TargetDummyConfig } from '../config/gameConfig';
import { DamageableTarget, HitResult } from '../weapons/Weapon';

export type { HitResult };

export class TargetDummy implements DamageableTarget {
  public readonly id: string;
  public readonly group: THREE.Group;

  private readonly config: TargetDummyConfig;
  private currentHp: number;
  private isDead: boolean = false;
  private respawnTimer: number = 0;

  private readonly headMesh: THREE.Mesh;
  private readonly bodyMesh: THREE.Mesh;
  private readonly baseMesh: THREE.Mesh;

  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly headMaterial: THREE.MeshStandardMaterial;

  private flashTimer: number = 0;

  // World-space Health Bar
  private readonly healthBarGroup: THREE.Group;
  private readonly healthBarFill: THREE.Mesh;
  private readonly healthBarFillGeo: THREE.PlaneGeometry;

  // Active floating damage indicators
  private readonly activeDamagePopups: {
    sprite: THREE.Sprite;
    texture: THREE.CanvasTexture;
    life: number;
    maxLife: number;
    velocityY: number;
  }[] = [];

  constructor(id: string, position: THREE.Vector3, rotY: number = 0, config: TargetDummyConfig) {
    this.id = id;
    this.config = config;
    this.currentHp = config.maxHp;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotY;

    // 1. Materials
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x48583e, // Military Olive
      roughness: 0.7,
      metalness: 0.1,
    });

    this.headMaterial = new THREE.MeshStandardMaterial({
      color: 0xba3c30, // Distinct High-Vis Red/Crimson for Head Hitbox
      roughness: 0.6,
      metalness: 0.1,
    });

    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.8,
      metalness: 0.5,
    });

    // 2. Placeholder Geometry
    // Base plate
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.08, 16);
    this.baseMesh = new THREE.Mesh(baseGeo, standMaterial);
    this.baseMesh.position.y = 0.04;
    this.baseMesh.receiveShadow = true;
    this.group.add(this.baseMesh);

    // Support pole
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    const poleMesh = new THREE.Mesh(poleGeo, standMaterial);
    poleMesh.position.y = 0.35;
    poleMesh.castShadow = true;
    this.group.add(poleMesh);

    // Body (Capsule placeholder) - Torso hitbox
    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.75, 8, 16);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.bodyMesh.position.y = 1.1;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyMesh.userData = {
      type: 'hitbox',
      part: 'body',
      target: this,
    };
    this.group.add(this.bodyMesh);

    // Head (Sphere placeholder) - Headshot hitbox
    const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, this.headMaterial);
    this.headMesh.position.y = 1.72;
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headMesh.userData = {
      type: 'hitbox',
      part: 'head',
      target: this,
    };
    this.group.add(this.headMesh);

    // 3. Floating Health Bar Billboard
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.set(0, 2.15, 0);

    const bgBarGeo = new THREE.PlaneGeometry(0.9, 0.1);
    const bgBarMat = new THREE.MeshBasicMaterial({ color: 0x161b22, side: THREE.DoubleSide });
    const bgBarMesh = new THREE.Mesh(bgBarGeo, bgBarMat);
    this.healthBarGroup.add(bgBarMesh);

    this.healthBarFillGeo = new THREE.PlaneGeometry(0.86, 0.07);
    // Shift geometry origin so scaling x anchors to the left
    this.healthBarFillGeo.translate(0.43, 0, 0);
    const fillBarMat = new THREE.MeshBasicMaterial({ color: 0x2ea043, side: THREE.DoubleSide });
    this.healthBarFill = new THREE.Mesh(this.healthBarFillGeo, fillBarMat);
    this.healthBarFill.position.set(-0.43, 0, 0.005);
    this.healthBarGroup.add(this.healthBarFill);

    this.group.add(this.healthBarGroup);
  }

  public getHitboxMeshes(): THREE.Mesh[] {
    return [this.headMesh, this.bodyMesh];
  }

  public getHp(): number {
    return this.currentHp;
  }

  public getMaxHp(): number {
    return this.config.maxHp;
  }

  public getIsDead(): boolean {
    return this.isDead;
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

    const actualDamage = Math.min(this.currentHp, amount);
    this.currentHp = Math.max(0, this.currentHp - actualDamage);
    const isKilled = this.currentHp <= 0;

    // Flash visual feedback
    this.flashTimer = 0.15;
    this.bodyMaterial.emissive.setHex(isHeadshot ? 0xffaa00 : 0xff3333);
    this.headMaterial.emissive.setHex(0xffffff);

    // Spawn 3D floating damage text indicator
    const spawnPos = hitPoint ? hitPoint.clone() : this.group.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.spawnDamagePopup(amount, isHeadshot, spawnPos);

    // Update Health bar
    this.updateHealthBar();

    if (isKilled) {
      this.isDead = true;
      this.respawnTimer = this.config.respawnTime;
    }

    return {
      damage: actualDamage,
      isHeadshot,
      remainingHp: this.currentHp,
      isKilled,
    };
  }

  private updateHealthBar(): void {
    const ratio = Math.max(0, this.currentHp / this.config.maxHp);
    this.healthBarFill.scale.x = ratio;

    const fillMat = this.healthBarFill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.5) {
      fillMat.color.setHex(0x2ea043); // Green
    } else if (ratio > 0.25) {
      fillMat.color.setHex(0xd29922); // Orange
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

    this.group.parent?.add(sprite);

    this.activeDamagePopups.push({
      sprite,
      texture,
      life: 1.0,
      maxLife: 1.0,
      velocityY: 1.2,
    });
  }

  public reset(): void {
    this.currentHp = this.config.maxHp;
    this.isDead = false;
    this.respawnTimer = 0;
    this.group.rotation.x = 0;
    this.updateHealthBar();
    this.healthBarGroup.visible = true;
    this.headMesh.visible = true;
    this.bodyMesh.visible = true;
  }

  public update(dt: number, cameraPosition: THREE.Vector3): void {
    // 1. Billboarding health bar towards camera
    this.healthBarGroup.lookAt(cameraPosition.x, this.healthBarGroup.position.y + this.group.position.y, cameraPosition.z);

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
        this.group.parent?.remove(popup.sprite);
        popup.texture.dispose();
        popup.sprite.material.dispose();
        this.activeDamagePopups.splice(i, 1);
      }
    }

    // 4. Knockdown & Respawn
    if (this.isDead) {
      // Tilt backwards to show knockdown
      if (this.group.rotation.x > -Math.PI / 2) {
        this.group.rotation.x = Math.max(-Math.PI / 2, this.group.rotation.x - dt * 4.0);
      }

      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.reset();
      }
    } else {
      // Stand upright if recovering
      if (this.group.rotation.x < 0) {
        this.group.rotation.x = Math.min(0, this.group.rotation.x + dt * 4.0);
      }
    }
  }

  public dispose(): void {
    for (const popup of this.activeDamagePopups) {
      this.group.parent?.remove(popup.sprite);
      popup.texture.dispose();
      popup.sprite.material.dispose();
    }
    this.activeDamagePopups.length = 0;

    this.bodyMaterial.dispose();
    this.headMaterial.dispose();
    this.healthBarFillGeo.dispose();
  }
}
