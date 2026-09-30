import * as THREE from 'three';
import { KnifeConfig } from '../config/gameConfig';
import { TargetDummy } from '../environment/TargetDummy';
import { Weapon, WeaponType } from './Weapon';

export interface KnifeAttackResult {
  attacked: boolean;
  reason?: 'cooldown' | 'inactive';
  hit?: boolean;
  isHeadshot?: boolean;
  damage?: number;
  hitPoint?: THREE.Vector3;
  target?: TargetDummy;
  hitObstacle?: boolean;
}

export class Knife implements Weapon {
  public readonly type: WeaponType = 'knife';
  public readonly name: string = 'Tactical Knife';

  private readonly config: KnifeConfig;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;

  // Active / Selected state
  private isActive: boolean = false;

  // Cooldown and Attack Animation State
  private cooldownTimer: number = 0;
  private isAttacking: boolean = false;
  private attackAnimTimer: number = 0;
  private readonly attackDuration: number = 0.22; // Quick slash swing

  // Rest transforms relative to camera
  private readonly restPos = new THREE.Vector3(0.24, -0.22, -0.42);
  private readonly restRot = new THREE.Euler(0.18, -0.2, 0.12, 'YXZ');

  // Raycaster for short-range hit detection
  private readonly raycaster: THREE.Raycaster;
  private readonly cameraWorldPos = new THREE.Vector3();
  private readonly cameraWorldDir = new THREE.Vector3();

  // First-person Knife Visuals
  public readonly knifeGroup: THREE.Group;
  private slashTrailMesh: THREE.Mesh | null = null;
  private slashTrailTimer: number = 0;

  // Active Impact Sparks
  private readonly activeImpacts: {
    mesh: THREE.Mesh;
    timer: number;
  }[] = [];

  constructor(config: KnifeConfig, camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.config = config;
    this.camera = camera;
    this.scene = scene;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.1;
    this.raycaster.far = this.config.range; // Strictly limited to knife range (2.0m)

    // Build First-Person Viewmodel Placeholder
    this.knifeGroup = new THREE.Group();
    this.buildKnifeModel();

    // Default hidden until selected
    this.knifeGroup.visible = false;
    this.camera.add(this.knifeGroup);
    if (!this.camera.parent) {
      this.scene.add(this.camera);
    }
  }

  private buildKnifeModel(): void {
    // Materials
    const bladeSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe6edf3, // Polished silver cutting edge
      roughness: 0.25,
      metalness: 0.9,
    });

    const bladeSpineMat = new THREE.MeshStandardMaterial({
      color: 0x30363d, // Dark tactical coated spine
      roughness: 0.5,
      metalness: 0.7,
    });

    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x21262d, // Matte dark steel crossguard
      roughness: 0.6,
      metalness: 0.6,
    });

    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x161b22, // Textured tactical polymer
      roughness: 0.85,
      metalness: 0.1,
    });

    // 1. Blade Body (Spine + Edge)
    const spineGeo = new THREE.BoxGeometry(0.008, 0.045, 0.22);
    const spineMesh = new THREE.Mesh(spineGeo, bladeSpineMat);
    spineMesh.position.set(0, 0.02, -0.16);
    this.knifeGroup.add(spineMesh);

    // Beveled cutting edge
    const edgeGeo = new THREE.BoxGeometry(0.004, 0.02, 0.22);
    const edgeMesh = new THREE.Mesh(edgeGeo, bladeSteelMat);
    edgeMesh.position.set(0, -0.012, -0.16);
    this.knifeGroup.add(edgeMesh);

    // Angled Tanto / Clip Tip
    const tipGeo = new THREE.BoxGeometry(0.006, 0.038, 0.06);
    tipGeo.rotateX(Math.PI / 6);
    const tipMesh = new THREE.Mesh(tipGeo, bladeSteelMat);
    tipMesh.position.set(0, 0.01, -0.29);
    this.knifeGroup.add(tipMesh);

    // 2. Crossguard
    const guardGeo = new THREE.BoxGeometry(0.02, 0.07, 0.014);
    const guardMesh = new THREE.Mesh(guardGeo, guardMat);
    guardMesh.position.set(0, 0.01, -0.045);
    this.knifeGroup.add(guardMesh);

    // 3. Ergonomic Handle Grip
    const handleGeo = new THREE.BoxGeometry(0.024, 0.036, 0.13);
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.position.set(0, 0, 0.03);
    this.knifeGroup.add(handleMesh);

    // Grip Ribs / Rings
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.BoxGeometry(0.026, 0.038, 0.015);
      const ringMesh = new THREE.Mesh(ringGeo, guardMat);
      ringMesh.position.set(0, 0, -0.01 + i * 0.035);
      this.knifeGroup.add(ringMesh);
    }

    // 4. Pommel (End Cap)
    const pommelGeo = new THREE.BoxGeometry(0.028, 0.04, 0.018);
    const pommelMesh = new THREE.Mesh(pommelGeo, guardMat);
    pommelMesh.position.set(0, 0, 0.105);
    this.knifeGroup.add(pommelMesh);

    // 5. Slash Arc Trail Mesh Placeholder
    const slashGeo = new THREE.RingGeometry(0.28, 0.35, 16, 1, 0, Math.PI * 0.6);
    const slashMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.slashTrailMesh = new THREE.Mesh(slashGeo, slashMat);
    this.slashTrailMesh.position.set(-0.05, 0, -0.45);
    this.slashTrailMesh.rotation.set(-0.2, 0.3, -Math.PI / 4);
    this.slashTrailMesh.visible = false;
    this.knifeGroup.add(this.slashTrailMesh);

    // Set initial position & rotation
    this.knifeGroup.position.copy(this.restPos);
    this.knifeGroup.rotation.copy(this.restRot);
  }

  public canAttack(): boolean {
    return this.isActive && this.cooldownTimer <= 0;
  }

  public getCooldownRemaining(): number {
    return Math.max(0, this.cooldownTimer);
  }

  public getCooldownProgress(): number {
    if (this.cooldownTimer <= 0) return 0;
    return Math.min(1, this.cooldownTimer / this.config.cooldown);
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    this.knifeGroup.visible = active;
    if (!active) {
      this.isAttacking = false;
      this.attackAnimTimer = 0;
      this.knifeGroup.position.copy(this.restPos);
      this.knifeGroup.rotation.copy(this.restRot);
      if (this.slashTrailMesh) {
        this.slashTrailMesh.visible = false;
      }
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public resetCooldown(): void {
    this.cooldownTimer = 0;
    this.isAttacking = false;
    this.attackAnimTimer = 0;
  }

  public attack(obstacles: THREE.Object3D[], targetDummies: TargetDummy[]): KnifeAttackResult {
    if (!this.isActive) {
      return { attacked: false, reason: 'inactive' };
    }

    // Cooldown constraint
    if (this.cooldownTimer > 0) {
      return { attacked: false, reason: 'cooldown' };
    }

    // Trigger attack
    this.cooldownTimer = this.config.cooldown;
    this.isAttacking = true;
    this.attackAnimTimer = this.attackDuration;

    // Show visual slash swoosh
    this.triggerSlashTrail();

    // 1. Setup Camera Center Raycast
    this.camera.getWorldPosition(this.cameraWorldPos);
    this.camera.getWorldDirection(this.cameraWorldDir);
    this.raycaster.set(this.cameraWorldPos, this.cameraWorldDir);
    this.raycaster.far = this.config.range; // 2.0m maximum reach

    // 2. Gather candidate meshes: Arena obstacles + dummy hitboxes
    const candidateMeshes: THREE.Object3D[] = [...obstacles];
    for (const dummy of targetDummies) {
      if (!dummy.getIsDead()) {
        candidateMeshes.push(...dummy.getHitboxMeshes());
      }
    }

    // 3. Test intersections sorted by distance ascending (closest first)
    const intersects = this.raycaster.intersectObjects(candidateMeshes, false);

    if (intersects.length > 0) {
      const closest = intersects[0];

      // Double check range constraint (strictly <= 2.0m)
      if (closest.distance <= this.config.range) {
        const hitPoint = closest.point.clone();

        // Check if dummy hitbox was struck
        if (closest.object.userData && closest.object.userData.type === 'hitbox') {
          const dummy = closest.object.userData.target as TargetDummy;
          const isHeadshot = closest.object.userData.part === 'head';

          const damage = isHeadshot
            ? this.config.damage * this.config.headshotMultiplier
            : this.config.damage;

          dummy.takeDamage(damage, isHeadshot, hitPoint);
          this.spawnImpactSpark(hitPoint, closest.face ? closest.face.normal : undefined, true);

          return {
            attacked: true,
            hit: true,
            isHeadshot,
            damage,
            hitPoint,
            target: dummy,
          };
        } else {
          // Struck obstacle (wall, container, crate, barrier)
          // Slash impacts obstacle surface and stops; does not penetrate behind it
          this.spawnImpactSpark(hitPoint, closest.face ? closest.face.normal : undefined, false);

          return {
            attacked: true,
            hit: false,
            hitObstacle: true,
            hitPoint,
          };
        }
      }
    }

    // Missed (swung at empty air or target was further than 2.0m)
    return {
      attacked: true,
      hit: false,
    };
  }

  private triggerSlashTrail(): void {
    if (!this.slashTrailMesh) return;
    this.slashTrailMesh.visible = true;
    (this.slashTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
    this.slashTrailTimer = 0.12;
  }

  private spawnImpactSpark(point: THREE.Vector3, normal?: THREE.Vector3, isFlesh: boolean = false): void {
    const sparkColor = isFlesh ? 0xff4433 : 0xffcc33;
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const sparkMat = new THREE.MeshBasicMaterial({ color: sparkColor });
    const mesh = new THREE.Mesh(sparkGeo, sparkMat);
    mesh.position.copy(point);

    if (normal) {
      mesh.position.addScaledVector(normal, 0.03);
    }

    this.scene.add(mesh);
    this.activeImpacts.push({
      mesh,
      timer: 0.12,
    });
  }

  public update(dt: number): void {
    // 1. Decrement Cooldown Timer
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // 2. Attack Slash Animation
    if (this.isAttacking && this.isActive) {
      this.attackAnimTimer -= dt;
      if (this.attackAnimTimer <= 0) {
        this.isAttacking = false;
        this.attackAnimTimer = 0;
        this.knifeGroup.position.copy(this.restPos);
        this.knifeGroup.rotation.copy(this.restRot);
      } else {
        // Normalized progress: 0 (start) to 1 (end)
        const progress = 1 - this.attackAnimTimer / this.attackDuration;

        if (progress < 0.35) {
          // Strike phase: fast forward thrust and horizontal cut across screen
          const strikeT = progress / 0.35;
          const easeOut = Math.sin((strikeT * Math.PI) / 2);

          this.knifeGroup.position.set(
            THREE.MathUtils.lerp(this.restPos.x, -0.06, easeOut),
            THREE.MathUtils.lerp(this.restPos.y, -0.16, easeOut),
            THREE.MathUtils.lerp(this.restPos.z, -0.58, easeOut)
          );

          this.knifeGroup.rotation.set(
            THREE.MathUtils.lerp(this.restRot.x, 0.45, easeOut),
            THREE.MathUtils.lerp(this.restRot.y, 0.35, easeOut),
            THREE.MathUtils.lerp(this.restRot.z, -0.75, easeOut)
          );
        } else {
          // Recovery phase: smooth return to rest pose
          const recoverT = (progress - 0.35) / 0.65;
          const easeIn = recoverT * recoverT;

          this.knifeGroup.position.set(
            THREE.MathUtils.lerp(-0.06, this.restPos.x, easeIn),
            THREE.MathUtils.lerp(-0.16, this.restPos.y, easeIn),
            THREE.MathUtils.lerp(-0.58, this.restPos.z, easeIn)
          );

          this.knifeGroup.rotation.set(
            THREE.MathUtils.lerp(0.45, this.restRot.x, easeIn),
            THREE.MathUtils.lerp(0.35, this.restRot.y, easeIn),
            THREE.MathUtils.lerp(-0.75, this.restRot.z, easeIn)
          );
        }
      }
    }

    // 3. Update Slash Trail Fade
    if (this.slashTrailTimer > 0) {
      this.slashTrailTimer -= dt;
      if (this.slashTrailMesh) {
        const mat = this.slashTrailMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (this.slashTrailTimer / 0.12) * 0.75);
        if (this.slashTrailTimer <= 0) {
          this.slashTrailMesh.visible = false;
        }
      }
    }

    // 4. Update Active Impact Sparks
    for (let i = this.activeImpacts.length - 1; i >= 0; i--) {
      const impact = this.activeImpacts[i];
      impact.timer -= dt;
      if (impact.timer <= 0) {
        this.scene.remove(impact.mesh);
        impact.mesh.geometry.dispose();
        (impact.mesh.material as THREE.Material).dispose();
        this.activeImpacts.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    if (this.knifeGroup.parent) {
      this.knifeGroup.parent.remove(this.knifeGroup);
    }

    if (this.slashTrailMesh) {
      this.slashTrailMesh.geometry.dispose();
      (this.slashTrailMesh.material as THREE.Material).dispose();
    }

    for (const impact of this.activeImpacts) {
      this.scene.remove(impact.mesh);
      impact.mesh.geometry.dispose();
      (impact.mesh.material as THREE.Material).dispose();
    }
    this.activeImpacts.length = 0;
  }
}
