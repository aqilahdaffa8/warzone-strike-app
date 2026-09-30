import * as THREE from 'three';
import { SniperConfig } from '../config/gameConfig';
import { PlayerController } from '../player/PlayerController';
import { TargetDummy } from '../environment/TargetDummy';

import { Weapon, WeaponType } from './Weapon';

export interface FireResult {
  fired: boolean;
  reason?: 'cooldown' | 'empty' | 'reloading';
  hit?: boolean;
  isHeadshot?: boolean;
  damage?: number;
  hitPoint?: THREE.Vector3;
  target?: TargetDummy;
}

export interface WeaponStats {
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  accuracy: number;
}

export class Sniper implements Weapon {
  public readonly type: WeaponType = 'sniper';
  public readonly name: string = 'Sniper Rifle';

  private readonly config: SniperConfig;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;

  // Active / Selected State
  private isActive: boolean = true;

  // Ammo & Reload State
  private ammoInMag: number;
  private reserveAmmo: number;
  private fireTimer: number = 0;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;


  // Scope & Aiming State
  private isScoped: boolean = false;

  // Session Statistics
  private shotsFired: number = 0;
  private shotsHit: number = 0;
  private headshots: number = 0;

  // Raycaster
  private readonly raycaster: THREE.Raycaster;
  private readonly cameraWorldPos = new THREE.Vector3();
  private readonly cameraWorldDir = new THREE.Vector3();

  // First-person Weapon Visuals
  public readonly gunGroup: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh | null = null;
  private muzzleFlashLight: THREE.PointLight | null = null;
  private muzzleFlashTimer: number = 0;
  private recoilOffset: number = 0;
  private recoilPitch: number = 0;

  // Active Bullet Tracers
  private readonly activeTracers: {
    line: THREE.Line;
    timer: number;
    maxDuration: number;
  }[] = [];

  // Active Impact Sparks
  private readonly activeImpacts: {
    mesh: THREE.Mesh;
    timer: number;
  }[] = [];

  constructor(config: SniperConfig, camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.config = config;
    this.camera = camera;
    this.scene = scene;

    this.ammoInMag = config.magazineCapacity;
    this.reserveAmmo = config.reserveAmmo;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.1;
    this.raycaster.far = 400;

    // Build First-Person Viewmodel Placeholder
    this.gunGroup = new THREE.Group();
    this.buildGunModel();

    // Attach gun model to camera so it moves seamlessly with first-person perspective
    this.camera.add(this.gunGroup);
    // Ensure camera is part of the scene graph
    if (!this.camera.parent) {
      this.scene.add(this.camera);
    }
  }

  private buildGunModel(): void {
    // Gun Materials
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2328, // Dark military steel
      roughness: 0.4,
      metalness: 0.8,
    });

    const stockMat = new THREE.MeshStandardMaterial({
      color: 0x313936, // Tactical olive polymer
      roughness: 0.8,
      metalness: 0.1,
    });

    const scopeMat = new THREE.MeshStandardMaterial({
      color: 0x111317, // Matte black
      roughness: 0.3,
      metalness: 0.7,
    });

    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x388bfd, // Scope lens reflection
    });

    // 1. Receiver / Main Body
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.08, 0.45);
    const bodyMesh = new THREE.Mesh(bodyGeo, metalMat);
    bodyMesh.position.set(0, 0, 0);
    this.gunGroup.add(bodyMesh);

    // 2. Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.5, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeo, metalMat);
    barrelMesh.position.set(0, 0.02, -0.45);
    this.gunGroup.add(barrelMesh);

    // Muzzle Brake
    const brakeGeo = new THREE.BoxGeometry(0.035, 0.035, 0.08);
    const brakeMesh = new THREE.Mesh(brakeGeo, metalMat);
    brakeMesh.position.set(0, 0.02, -0.72);
    this.gunGroup.add(brakeMesh);

    // 3. Sniper Scope Tube
    const scopeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 16);
    scopeGeo.rotateX(Math.PI / 2);
    const scopeMesh = new THREE.Mesh(scopeGeo, scopeMat);
    scopeMesh.position.set(0, 0.08, -0.05);
    this.gunGroup.add(scopeMesh);

    // Scope Mounts
    const mountGeo = new THREE.BoxGeometry(0.02, 0.04, 0.03);
    const mount1 = new THREE.Mesh(mountGeo, metalMat);
    mount1.position.set(0, 0.05, 0.05);
    const mount2 = new THREE.Mesh(mountGeo, metalMat);
    mount2.position.set(0, 0.05, -0.15);
    this.gunGroup.add(mount1);
    this.gunGroup.add(mount2);

    // Scope Lens
    const lensGeo = new THREE.CircleGeometry(0.022, 16);
    const lensMesh = new THREE.Mesh(lensGeo, glassMat);
    lensMesh.position.set(0, 0.08, -0.201);
    this.gunGroup.add(lensMesh);

    // 4. Stock / Grip
    const stockGeo = new THREE.BoxGeometry(0.055, 0.12, 0.28);
    const stockMesh = new THREE.Mesh(stockGeo, stockMat);
    stockMesh.position.set(0, -0.04, 0.3);
    this.gunGroup.add(stockMesh);

    // 5. Magazine
    const magGeo = new THREE.BoxGeometry(0.045, 0.14, 0.08);
    const magMesh = new THREE.Mesh(magGeo, metalMat);
    magMesh.position.set(0, -0.1, -0.05);
    magMesh.rotation.x = 0.15;
    this.gunGroup.add(magMesh);

    // 6. Muzzle Flash Placeholder (Brief flash quad + point light)
    const flashGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.02, -0.78);
    this.muzzleFlashMesh.visible = false;
    this.gunGroup.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 2.5, 4);
    this.muzzleFlashLight.position.set(0, 0.02, -0.78);
    this.muzzleFlashLight.visible = false;
    this.gunGroup.add(this.muzzleFlashLight);

    // Default first-person rest position (bottom-right of viewport)
    this.gunGroup.position.set(0.24, -0.22, -0.52);
    this.gunGroup.rotation.set(0.04, -0.05, 0);
  }

  public canFire(): boolean {
    return this.fireTimer <= 0 && !this.isReloading && this.ammoInMag > 0;
  }

  public fire(obstacles: THREE.Object3D[], targetDummies: TargetDummy[]): FireResult {
    // Check reload constraint
    if (this.isReloading) {
      return { fired: false, reason: 'reloading' };
    }

    // Check fire interval cooldown constraint
    if (this.fireTimer > 0) {
      return { fired: false, reason: 'cooldown' };
    }

    // Check magazine ammo constraint
    if (this.ammoInMag <= 0) {
      // Auto-trigger reload if player has reserve ammo
      if (this.reserveAmmo > 0) {
        this.reload();
      }
      return { fired: false, reason: 'empty' };
    }

    // --- EXECUTE SHOT ---
    this.ammoInMag--;
    this.fireTimer = this.config.fireInterval;
    this.shotsFired++;

    // Weapon visual feedback: recoil kick
    this.recoilOffset = 0.08;
    this.recoilPitch = 0.06;
    this.triggerMuzzleFlash();

    // 1. Setup Camera Center Ray
    this.camera.getWorldPosition(this.cameraWorldPos);
    this.camera.getWorldDirection(this.cameraWorldDir);
    this.raycaster.set(this.cameraWorldPos, this.cameraWorldDir);

    // 2. Gather all candidate meshes: Arena obstacles + dummy hitboxes
    const candidateMeshes: THREE.Object3D[] = [...obstacles];
    for (const dummy of targetDummies) {
      if (!dummy.getIsDead()) {
        candidateMeshes.push(...dummy.getHitboxMeshes());
      }
    }

    // 3. Test intersections sorted by distance ascending (closest first)
    const intersects = this.raycaster.intersectObjects(candidateMeshes, false);

    let hitPoint: THREE.Vector3;
    let hitResult: FireResult;

    if (intersects.length > 0) {
      const closest = intersects[0];
      hitPoint = closest.point.clone();

      // Check if closest hit object is a dummy hitbox
      if (closest.object.userData && closest.object.userData.type === 'hitbox') {
        const dummy = closest.object.userData.target as TargetDummy;
        const isHeadshot = closest.object.userData.part === 'head';

        const damage = isHeadshot
          ? this.config.bodyDamage * this.config.headshotMultiplier
          : this.config.bodyDamage;

        this.shotsHit++;
        if (isHeadshot) {
          this.headshots++;
        }

        dummy.takeDamage(damage, isHeadshot, hitPoint);

        hitResult = {
          fired: true,
          hit: true,
          isHeadshot,
          damage,
          hitPoint,
          target: dummy,
        };
      } else {
        // Bullet hit an obstacle (wall, container, crate, barrier, or ground).
        // It STOPS HERE and does NOT penetrate into objects behind it.
        this.spawnImpactSpark(hitPoint, closest.face ? closest.face.normal : undefined);

        hitResult = {
          fired: true,
          hit: false,
          hitPoint,
        };
      }
    } else {
      // Bullet shot into the open sky (max distance)
      hitPoint = this.cameraWorldPos.clone().add(this.cameraWorldDir.clone().multiplyScalar(150));
      hitResult = {
        fired: true,
        hit: false,
        hitPoint,
      };
    }

    // 4. Spawn Bullet Tracer Line
    this.spawnTracer(this.cameraWorldPos, hitPoint);

    return hitResult;
  }

  public reload(): boolean {
    if (this.isReloading) return false;
    if (this.ammoInMag >= this.config.magazineCapacity) return false;
    if (this.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadTimer = this.config.reloadDuration;

    // Reloading automatically unscopes
    if (this.isScoped) {
      this.setScoped(false);
    }

    return true;
  }

  public setScoped(scoped: boolean): void {
    if (this.isScoped === scoped) return;
    this.isScoped = scoped;
  }

  public toggleScoped(): void {
    this.setScoped(!this.isScoped);
  }

  public getIsScoped(): boolean {
    return this.isScoped;
  }

  public getIsReloading(): boolean {
    return this.isReloading;
  }

  public getReloadProgress(): number {
    if (!this.isReloading) return 0;
    return Math.max(0, Math.min(1, 1 - this.reloadTimer / this.config.reloadDuration));
  }

  public getAmmo(): { inMag: number; reserve: number; maxMag: number } {
    return {
      inMag: this.ammoInMag,
      reserve: this.reserveAmmo,
      maxMag: this.config.magazineCapacity,
    };
  }

  public getStats(): WeaponStats {
    const accuracy = this.shotsFired > 0 ? (this.shotsHit / this.shotsFired) * 100 : 0;
    return {
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      headshots: this.headshots,
      accuracy: Math.round(accuracy * 10) / 10,
    };
  }

  public cancelReload(): void {
    if (this.isReloading) {
      this.isReloading = false;
      this.reloadTimer = 0;
    }
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (!active) {
      this.cancelReload();
      this.setScoped(false);
      this.gunGroup.visible = false;
      if (this.muzzleFlashMesh) this.muzzleFlashMesh.visible = false;
      if (this.muzzleFlashLight) this.muzzleFlashLight.visible = false;
    } else {
      this.gunGroup.visible = true;
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public resetAmmo(): void {
    this.ammoInMag = this.config.magazineCapacity;
    this.reserveAmmo = this.config.reserveAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireTimer = 0;
  }

  public resetStats(): void {
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.headshots = 0;
  }

  private triggerMuzzleFlash(): void {
    this.muzzleFlashTimer = 0.05;
    if (this.muzzleFlashMesh) this.muzzleFlashMesh.visible = true;
    if (this.muzzleFlashLight) this.muzzleFlashLight.visible = true;
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    // Offset start from right-hand eye position towards muzzle
    const start = from.clone().add(new THREE.Vector3(0.18, -0.15, -0.3).applyQuaternion(this.camera.quaternion));
    const points = [start, to];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffea79,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });

    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.activeTracers.push({
      line,
      timer: 0.06,
      maxDuration: 0.06,
    });
  }

  private spawnImpactSpark(point: THREE.Vector3, normal?: THREE.Vector3): void {
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
    const mesh = new THREE.Mesh(sparkGeo, sparkMat);
    mesh.position.copy(point);

    if (normal) {
      mesh.position.addScaledVector(normal, 0.04);
    }

    this.scene.add(mesh);
    this.activeImpacts.push({
      mesh,
      timer: 0.12,
    });
  }

  public update(dt: number, playerController: PlayerController): void {
    // 1. Fire Interval Timer
    if (this.fireTimer > 0) {
      this.fireTimer = Math.max(0, this.fireTimer - dt);
    }

    // 2. Reload Timer
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const needed = this.config.magazineCapacity - this.ammoInMag;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += toLoad;
        this.reserveAmmo -= toLoad;
      }
    }

    // If weapon is inactive (e.g. switched to knife), hide viewmodel and do not touch FOV/sensitivity
    if (!this.isActive) {
      this.gunGroup.visible = false;
    } else {
      // 3. Scope FOV & Sensitivity Interpolation
      const targetFov = this.isScoped ? this.config.scopedFov : this.config.defaultFov;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1.0, dt * 18.0));
        this.camera.updateProjectionMatrix();
      } else {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }

      // Dynamic mouse sensitivity multiplier according to zoom level
      const sensMultiplier = this.camera.fov / this.config.defaultFov;
      playerController.setSensitivityMultiplier(sensMultiplier);

      // 4. Viewmodel Visibility & Recoil Recovery
      if (this.isScoped && this.camera.fov < 40) {
        // Hide gun model while scoped so scope overlay is completely clean
        this.gunGroup.visible = false;
      } else {
        this.gunGroup.visible = true;

        // Recover recoil smoothly
        this.recoilOffset = Math.max(0, this.recoilOffset - dt * 0.45);
        this.recoilPitch = Math.max(0, this.recoilPitch - dt * 0.35);

        // Idle rest position + recoil kick
        this.gunGroup.position.set(0.24, -0.22, -0.52 + this.recoilOffset);
        this.gunGroup.rotation.set(0.04 + this.recoilPitch, -0.05, 0);
      }
    }


    // 5. Muzzle Flash Decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        if (this.muzzleFlashMesh) this.muzzleFlashMesh.visible = false;
        if (this.muzzleFlashLight) this.muzzleFlashLight.visible = false;
      }
    }

    // 6. Update Tracers
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      tracer.timer -= dt;
      const mat = tracer.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, tracer.timer / tracer.maxDuration);

      if (tracer.timer <= 0) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        mat.dispose();
        this.activeTracers.splice(i, 1);
      }
    }

    // 7. Update Impacts
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
    if (this.gunGroup.parent) {
      this.gunGroup.parent.remove(this.gunGroup);
    }

    for (const tracer of this.activeTracers) {
      this.scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      (tracer.line.material as THREE.Material).dispose();
    }
    this.activeTracers.length = 0;

    for (const impact of this.activeImpacts) {
      this.scene.remove(impact.mesh);
      impact.mesh.geometry.dispose();
      (impact.mesh.material as THREE.Material).dispose();
    }
    this.activeImpacts.length = 0;
  }
}
