import * as THREE from 'three';
import { BazookaConfig } from '../config/gameConfig';
import { Weapon, WeaponType, DamageableTarget } from './Weapon';

export interface RocketProjectile {
  mesh: THREE.Group;
  light: THREE.PointLight;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  lifeTimer: number;
  maxLife: number;
}

export interface RocketExplosionFX {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  currentRadius: number;
  maxRadius: number;
  timer: number;
  duration: number;
}

export interface SmokePuff {
  mesh: THREE.Mesh;
  timer: number;
  duration: number;
}

export class Bazooka implements Weapon {
  public readonly type: WeaponType = 'bazooka';
  public readonly name: string = 'RPG-7 Bazooka';

  private readonly config: BazookaConfig;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;

  // Active & Unlock Status
  private isActive: boolean = false;
  private isUnlocked: boolean = false;

  // Ammo & Reload
  private magazineAmmo: number = 1;
  private reserveAmmo: number = 3;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;
  private cooldownTimer: number = 0;

  // First-person Viewmodel
  public readonly bazookaGroup: THREE.Group;
  private loadedRocketMesh: THREE.Group | null = null;
  private readonly restPos = new THREE.Vector3(0.26, -0.24, -0.48);
  private readonly restRot = new THREE.Euler(0.05, -0.08, 0.02, 'YXZ');

  // Recoil
  private recoilOffset = new THREE.Vector3();
  private recoilRot = new THREE.Euler();

  // Projectiles & FX
  private readonly activeRockets: RocketProjectile[] = [];
  private readonly activeExplosions: RocketExplosionFX[] = [];
  private readonly activeSmoke: SmokePuff[] = [];

  public onExplosion?: (position: THREE.Vector3, radius: number) => void;

  constructor(config: BazookaConfig, camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.config = config;
    this.camera = camera;
    this.scene = scene;
    this.reserveAmmo = config.reserveAmmo;

    // Viewmodel container
    this.bazookaGroup = new THREE.Group();
    this.buildBazookaModel();
    this.bazookaGroup.visible = false;
    this.camera.add(this.bazookaGroup);

    if (!this.camera.parent) {
      this.scene.add(this.camera);
    }
  }

  private buildBazookaModel(): void {
    // 1. Materials
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x24292e,
      roughness: 0.45,
      metalness: 0.8,
    });
    const oliveTubeMat = new THREE.MeshStandardMaterial({
      color: 0x3d4a36,
      roughness: 0.6,
      metalness: 0.4,
    });
    const woodGripMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.7,
      metalness: 0.1,
    });
    const rocketHeadMat = new THREE.MeshStandardMaterial({
      color: 0x4a5d3f,
      roughness: 0.5,
      metalness: 0.5,
    });
    const rocketBandMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      roughness: 0.3,
      metalness: 0.8,
    });

    // 2. Main Launcher Tube (Cylinder oriented along Z)
    const tubeGeo = new THREE.CylinderGeometry(0.045, 0.048, 0.72, 16);
    tubeGeo.rotateX(Math.PI / 2);
    const tubeMesh = new THREE.Mesh(tubeGeo, oliveTubeMat);
    tubeMesh.position.set(0, 0, -0.15);
    this.bazookaGroup.add(tubeMesh);

    // Front Tube Reinforcement Collar
    const collarGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.08, 16);
    collarGeo.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeo, metalMat);
    collarMesh.position.set(0, 0, -0.48);
    this.bazookaGroup.add(collarMesh);

    // Rear Exhaust Cone
    const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.045, 0.14, 16);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustMesh = new THREE.Mesh(exhaustGeo, metalMat);
    exhaustMesh.position.set(0, 0, 0.25);
    this.bazookaGroup.add(exhaustMesh);

    // 3. Pistol Grip & Trigger
    const gripGeo = new THREE.BoxGeometry(0.03, 0.12, 0.045);
    const gripMesh = new THREE.Mesh(gripGeo, woodGripMat);
    gripMesh.position.set(0, -0.09, -0.12);
    gripMesh.rotation.x = 0.2;
    this.bazookaGroup.add(gripMesh);

    // Front Support Handle
    const fGripGeo = new THREE.BoxGeometry(0.028, 0.09, 0.035);
    const fGripMesh = new THREE.Mesh(fGripGeo, woodGripMat);
    fGripMesh.position.set(0, -0.08, -0.32);
    this.bazookaGroup.add(fGripMesh);

    // Optical Sight Bracket
    const sightGeo = new THREE.BoxGeometry(0.02, 0.05, 0.1);
    const sightMesh = new THREE.Mesh(sightGeo, metalMat);
    sightMesh.position.set(-0.055, 0.05, -0.22);
    this.bazookaGroup.add(sightMesh);

    // 4. Loaded Rocket Warhead (Protruding from front of tube)
    this.loadedRocketMesh = new THREE.Group();

    // Rocket Body & Cone
    const warheadGeo = new THREE.ConeGeometry(0.075, 0.22, 16);
    warheadGeo.rotateX(-Math.PI / 2);
    const warheadMesh = new THREE.Mesh(warheadGeo, rocketHeadMat);
    warheadMesh.position.set(0, 0, -0.66);
    this.loadedRocketMesh.add(warheadMesh);

    // Gold detonation band
    const bandGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.03, 16);
    bandGeo.rotateX(Math.PI / 2);
    const bandMesh = new THREE.Mesh(bandGeo, rocketBandMat);
    bandMesh.position.set(0, 0, -0.55);
    this.loadedRocketMesh.add(bandMesh);

    this.bazookaGroup.add(this.loadedRocketMesh);

    // Initial position & rotation
    this.bazookaGroup.position.copy(this.restPos);
    this.bazookaGroup.rotation.copy(this.restRot);
  }

  public unlock(): void {
    this.isUnlocked = true;
  }

  public lock(): void {
    this.isUnlocked = false;
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    this.bazookaGroup.visible = active;
    if (!active) {
      this.cancelReload();
      this.recoilOffset.set(0, 0, 0);
      this.bazookaGroup.position.copy(this.restPos);
      this.bazookaGroup.rotation.copy(this.restRot);
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getAmmo(): { current: number; reserve: number } {
    return {
      current: this.magazineAmmo,
      reserve: this.reserveAmmo,
    };
  }

  public addRockets(count: number): void {
    this.reserveAmmo += count;
  }

  public addReserveAmmo(count: number): void {
    this.addRockets(count);
  }

  public resetAmmo(): void {
    this.magazineAmmo = this.config.magazineCapacity;
    this.reserveAmmo = this.config.reserveAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.cooldownTimer = 0;
    if (this.loadedRocketMesh) {
      this.loadedRocketMesh.visible = true;
    }
  }

  public getIsReloading(): boolean {
    return this.isReloading;
  }

  public getReloadProgress(): number {
    if (!this.isReloading || this.config.reloadDuration <= 0) return 0;
    return Math.min(1.0, 1.0 - this.reloadTimer / this.config.reloadDuration);
  }

  public cancelReload(): void {
    if (this.isReloading) {
      this.isReloading = false;
      this.reloadTimer = 0;
    }
  }

  public reload(): boolean {
    if (!this.isActive) return false;
    if (this.isReloading) return false;
    if (this.magazineAmmo >= this.config.magazineCapacity) return false;
    if (this.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadTimer = this.config.reloadDuration;
    return true;
  }

  public canFire(): boolean {
    return (
      this.isActive &&
      this.magazineAmmo > 0 &&
      !this.isReloading &&
      this.cooldownTimer <= 0
    );
  }

  public fire(): boolean {
    if (!this.canFire()) {
      if (this.magazineAmmo === 0 && !this.isReloading && this.reserveAmmo > 0) {
        this.reload();
      }
      return false;
    }

    // Deduct rocket from tube
    this.magazineAmmo = 0;
    this.cooldownTimer = this.config.fireInterval;

    // Hide loaded warhead in tube
    if (this.loadedRocketMesh) {
      this.loadedRocketMesh.visible = false;
    }

    // Recoil kickback
    this.recoilOffset.set(0.02, 0.05, 0.18);
    this.recoilRot.set(-0.25, 0.05, 0.03);

    // Launch active rocket projectile
    this.spawnRocketProjectile();

    return true;
  }

  private spawnRocketProjectile(): void {
    const launchPos = new THREE.Vector3();
    this.camera.getWorldPosition(launchPos);

    const launchDir = new THREE.Vector3();
    this.camera.getWorldDirection(launchDir);

    // Spawn slightly in front and to the right of camera
    launchPos.addScaledVector(launchDir, 0.8);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    launchPos.addScaledVector(right, 0.22);
    launchPos.y -= 0.15;

    // Create 3D projectile model
    const rocketGroup = new THREE.Group();

    // Rocket body
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3d4a36,
      roughness: 0.5,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    rocketGroup.add(body);

    // Warhead Cone
    const coneGeo = new THREE.ConeGeometry(0.07, 0.18, 12);
    coneGeo.rotateX(-Math.PI / 2);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x4a5d3f,
      roughness: 0.4,
      metalness: 0.6,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 0, -0.3);
    rocketGroup.add(cone);

    // Exhaust glow light
    const rocketLight = new THREE.PointLight(0xff7700, 3, 8);
    rocketLight.position.set(0, 0, 0.25);
    rocketGroup.add(rocketLight);

    rocketGroup.position.copy(launchPos);
    rocketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), launchDir);

    this.scene.add(rocketGroup);

    this.activeRockets.push({
      mesh: rocketGroup,
      light: rocketLight,
      position: launchPos.clone(),
      direction: launchDir.clone().normalize(),
      speed: this.config.rocketSpeed,
      lifeTimer: 0,
      maxLife: 4.0, // 4 seconds max flight
    });
  }

  public update(
    dt: number,
    obstacles: THREE.Object3D[],
    targets: DamageableTarget[]
  ): void {
    // 1. Decrement Cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // 2. Reload Timer & Handling
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.reloadTimer = 0;
        this.magazineAmmo = 1;
        this.reserveAmmo = Math.max(0, this.reserveAmmo - 1);
        if (this.loadedRocketMesh) {
          this.loadedRocketMesh.visible = true;
        }
      }
    }

    // 3. Recoil Recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), dt * 10.0);
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, dt * 10.0);
    this.recoilRot.y = THREE.MathUtils.lerp(this.recoilRot.y, 0, dt * 10.0);
    this.recoilRot.z = THREE.MathUtils.lerp(this.recoilRot.z, 0, dt * 10.0);

    // Apply viewmodel transforms
    if (this.isActive) {
      let reloadDipY = 0;
      let reloadPitch = 0;
      if (this.isReloading) {
        const progress = 1.0 - this.reloadTimer / this.config.reloadDuration;
        reloadDipY = -Math.sin(progress * Math.PI) * 0.18;
        reloadPitch = Math.sin(progress * Math.PI) * 0.45;
      }

      this.bazookaGroup.position.set(
        this.restPos.x + this.recoilOffset.x,
        this.restPos.y + this.recoilOffset.y + reloadDipY,
        this.restPos.z + this.recoilOffset.z
      );
      this.bazookaGroup.rotation.set(
        this.restRot.x + this.recoilRot.x + reloadPitch,
        this.restRot.y + this.recoilRot.y,
        this.restRot.z + this.recoilRot.z
      );
    }

    // 4. Update Active Rockets (Flight, Collision & Detonation)
    for (let i = this.activeRockets.length - 1; i >= 0; i--) {
      const rocket = this.activeRockets[i];
      rocket.lifeTimer += dt;

      // Spawn smoke puff at exhaust
      this.spawnSmokePuff(rocket.position.clone().addScaledVector(rocket.direction, -0.3));

      // Advance position
      const step = rocket.direction.clone().multiplyScalar(rocket.speed * dt);
      const nextPos = rocket.position.clone().add(step);

      // Check collision with living targets
      let impacted = false;
      let impactPoint = nextPos.clone();

      for (const target of targets) {
        if (!target.getIsDead() && target.position) {
          const dist = nextPos.distanceTo(target.position);
          if (dist < 1.4) {
            impacted = true;
            impactPoint = nextPos.clone();
            break;
          }
        }
      }

      // Check collision with obstacles & floor
      if (!impacted) {
        if (nextPos.y <= 0.1) {
          impacted = true;
          impactPoint.y = 0.1;
        } else {
          for (const obs of obstacles) {
            const box = new THREE.Box3().setFromObject(obs);
            if (box.containsPoint(nextPos)) {
              impacted = true;
              impactPoint = nextPos.clone();
              break;
            }
          }
        }
      }

      // Check timeout
      if (rocket.lifeTimer >= rocket.maxLife) {
        impacted = true;
      }

      if (impacted) {
        try {
          this.detonateRocket(impactPoint, targets);
        } catch (err) {
          console.error('Error detonating rocket:', err);
        } finally {
          this.scene.remove(rocket.mesh);
          rocket.mesh.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              m.geometry.dispose();
              if (Array.isArray(m.material)) {
                m.material.forEach((mat) => mat.dispose());
              } else {
                m.material.dispose();
              }
            }
          });
          this.activeRockets.splice(i, 1);
        }
      } else {
        rocket.position.copy(nextPos);
        rocket.mesh.position.copy(nextPos);
      }
    }

    // 5. Update Rocket Explosions FX
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      exp.timer += dt;
      const progress = Math.min(1.0, exp.timer / exp.duration);

      const currentScale = THREE.MathUtils.lerp(0.8, exp.maxRadius, progress);
      exp.mesh.scale.set(currentScale, currentScale, currentScale);

      const mat = exp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 * (1.0 - progress));

      if (exp.light) {
        exp.light.intensity = 8.0 * (1.0 - progress);
      }

      if (exp.timer >= exp.duration) {
        this.scene.remove(exp.mesh);
        exp.mesh.geometry.dispose();
        mat.dispose();
        if (exp.light) {
          this.scene.remove(exp.light);
        }
        this.activeExplosions.splice(i, 1);
      }
    }

    // 6. Update Smoke Puffs
    for (let i = this.activeSmoke.length - 1; i >= 0; i--) {
      const smoke = this.activeSmoke[i];
      smoke.timer += dt;
      const progress = smoke.timer / smoke.duration;
      const mat = smoke.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.6 * (1.0 - progress));
      smoke.mesh.scale.addScalar(dt * 0.4);

      if (smoke.timer >= smoke.duration) {
        this.scene.remove(smoke.mesh);
        smoke.mesh.geometry.dispose();
        mat.dispose();
        this.activeSmoke.splice(i, 1);
      }
    }
  }

  private spawnSmokePuff(pos: THREE.Vector3): void {
    const puffGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.6,
    });
    const puffMesh = new THREE.Mesh(puffGeo, puffMat);
    puffMesh.position.copy(pos);
    this.scene.add(puffMesh);
    this.activeSmoke.push({
      mesh: puffMesh,
      timer: 0,
      duration: 0.35,
    });
  }

  private detonateRocket(pos: THREE.Vector3, targets: DamageableTarget[]): void {
    const blastRadius = this.config.blastRadius;
    const maxDamage = this.config.damage;

    if (this.onExplosion) {
      this.onExplosion(pos, blastRadius);
    }

    // Visual expanding fireball sphere
    const expGeo = new THREE.SphereGeometry(1, 16, 16);
    const expMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.9,
    });
    const expMesh = new THREE.Mesh(expGeo, expMat);
    expMesh.position.copy(pos);
    this.scene.add(expMesh);

    // Flash light
    const light = new THREE.PointLight(0xff5500, 8, blastRadius * 2.5);
    light.position.copy(pos);
    this.scene.add(light);

    this.activeExplosions.push({
      mesh: expMesh,
      light,
      currentRadius: 0.8,
      maxRadius: blastRadius,
      timer: 0,
      duration: 0.5,
    });

    // AoE damage with falloff
    for (const target of targets) {
      if (target.getIsDead() || !target.position) continue;
      const dist = pos.distanceTo(target.position);
      if (dist <= blastRadius) {
        const falloff = 1.0 - (dist / blastRadius) * 0.5;
        const damage = Math.round(maxDamage * falloff);
        target.takeDamage(damage, false, target.position.clone().add(new THREE.Vector3(0, 1, 0)));
      }
    }
  }

  public dispose(): void {
    if (this.bazookaGroup.parent) {
      this.bazookaGroup.parent.remove(this.bazookaGroup);
    }

    for (const r of this.activeRockets) {
      this.scene.remove(r.mesh);
    }
    this.activeRockets.length = 0;

    for (const e of this.activeExplosions) {
      this.scene.remove(e.mesh);
    }
    this.activeExplosions.length = 0;

    for (const s of this.activeSmoke) {
      this.scene.remove(s.mesh);
    }
    this.activeSmoke.length = 0;
  }
}
