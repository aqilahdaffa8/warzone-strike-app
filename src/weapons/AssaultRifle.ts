import * as THREE from 'three';
import { AssaultRifleConfig } from '../config/gameConfig';
import { PlayerController } from '../player/PlayerController';
import { Weapon, WeaponType, DamageableTarget, FireResult } from './Weapon';

export class AssaultRifle implements Weapon {
  public readonly type: WeaponType;
  public readonly name: string;

  private readonly config: AssaultRifleConfig;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly playerController: PlayerController;

  private isUnlocked: boolean = false;
  private isActive: boolean = false;

  private ammoInMag: number;
  private reserveAmmo: number;
  private currentMagCapacity: number;

  private fireTimer: number = 0;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;

  // Viewmodel Group & FX
  public readonly gunGroup: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh | null = null;
  private muzzleFlashLight: THREE.PointLight | null = null;
  private muzzleFlashTimer: number = 0;
  private recoilOffsetZ: number = 0;

  private readonly activeTracers: {
    line: THREE.Line;
    timer: number;
    maxDuration: number;
  }[] = [];

  private readonly activeImpacts: {
    mesh: THREE.Mesh;
    timer: number;
  }[] = [];

  private readonly raycaster = new THREE.Raycaster();
  private readonly cameraWorldPos = new THREE.Vector3();
  private readonly cameraWorldDir = new THREE.Vector3();

  constructor(
    type: 'akm' | 'm4',
    config: AssaultRifleConfig,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    playerController: PlayerController
  ) {
    this.type = type;
    this.config = config;
    this.name = config.name;
    this.camera = camera;
    this.scene = scene;
    this.playerController = playerController;

    this.currentMagCapacity = config.magazineCapacity;
    this.ammoInMag = config.magazineCapacity;
    this.reserveAmmo = config.reserveAmmo;

    this.raycaster.near = 0.1;
    this.raycaster.far = 250;

    this.gunGroup = new THREE.Group();
    this.buildGunModel();

    this.camera.add(this.gunGroup);
    if (!this.camera.parent) {
      this.scene.add(this.camera);
    }

    this.gunGroup.visible = false;
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
    this.gunGroup.visible = active;
    if (!active) {
      this.cancelReload();
      this.recoilOffsetZ = 0;
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getAmmo(): { inMag: number; reserve: number; maxMag: number } {
    return {
      inMag: this.ammoInMag,
      reserve: this.reserveAmmo,
      maxMag: this.currentMagCapacity,
    };
  }

  public addReserveAmmo(amount: number): void {
    this.reserveAmmo = Math.min(300, this.reserveAmmo + amount);
  }

  public upgradeMagazineCapacity(amount: number): void {
    this.currentMagCapacity += amount;
    this.ammoInMag = Math.min(this.ammoInMag + amount, this.currentMagCapacity);
  }

  public upgradeMagazine(amount: number): void {
    this.upgradeMagazineCapacity(amount);
  }

  public getMagazineCapacity(): number {
    return this.currentMagCapacity;
  }

  public resetAmmo(): void {
    this.ammoInMag = this.currentMagCapacity;
    this.reserveAmmo = this.config.reserveAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireTimer = 0;
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
    if (this.ammoInMag >= this.currentMagCapacity) return false;
    if (this.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadTimer = this.config.reloadDuration;
    return true;
  }

  public canFire(): boolean {
    return this.isActive && this.ammoInMag > 0 && !this.isReloading && this.fireTimer <= 0;
  }

  public fire(obstacles: THREE.Object3D[], targets: DamageableTarget[]): FireResult {
    if (!this.isActive) return { fired: false };
    if (this.isReloading) return { fired: false, reason: 'reloading' };
    if (this.fireTimer > 0) return { fired: false, reason: 'cooldown' };
    if (this.ammoInMag <= 0) {
      this.reload();
      return { fired: false, reason: 'empty' };
    }

    // Deduct ammo & set full-auto rate
    this.ammoInMag--;
    this.fireTimer = this.config.fireInterval;

    // Viewmodel kickback & Camera recoil
    this.recoilOffsetZ = 0.04;
    const isAKM = this.type === 'akm';
    const pitchKick = isAKM ? 0.016 : 0.011;
    const yawSway = isAKM ? 0.005 : 0.003;
    this.playerController.addRecoil(pitchKick, yawSway);

    // Muzzle Flash
    this.triggerMuzzleFlash();

    // Raycast through center of screen
    this.camera.getWorldPosition(this.cameraWorldPos);
    this.camera.getWorldDirection(this.cameraWorldDir);

    // Minor bullet spread
    const spread = isAKM ? 0.012 : 0.008;
    const spreadDir = this.cameraWorldDir.clone();
    spreadDir.x += (Math.random() - 0.5) * spread;
    spreadDir.y += (Math.random() - 0.5) * spread;
    spreadDir.normalize();

    this.raycaster.set(this.cameraWorldPos, spreadDir);

    // Collect target hitbox meshes
    const hitboxMap = new Map<THREE.Mesh, { target: DamageableTarget; isHeadshot: boolean }>();
    const meshesToTest: THREE.Mesh[] = [];

    for (const target of targets) {
      if (target.getIsDead()) continue;
      const hitboxes = target.getHitboxMeshes();
      for (const mesh of hitboxes) {
        meshesToTest.push(mesh);
        const isHead = mesh.userData?.isHead === true;
        hitboxMap.set(mesh, { target, isHeadshot: isHead });
      }
    }

    // Also include arena obstacles
    for (const obs of obstacles) {
      if ((obs as THREE.Mesh).isMesh) {
        meshesToTest.push(obs as THREE.Mesh);
      }
      obs.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child !== obs) {
          meshesToTest.push(child as THREE.Mesh);
        }
      });
    }

    const intersections = this.raycaster.intersectObjects(meshesToTest, false);
    let hitSomething = false;
    let hitTarget: DamageableTarget | undefined;
    let isHeadshotHit = false;
    let damageDealt = 0;
    let finalHitPoint = this.cameraWorldPos.clone().addScaledVector(spreadDir, 80);

    if (intersections.length > 0) {
      const hit = intersections[0];
      finalHitPoint = hit.point.clone();
      const targetData = hitboxMap.get(hit.object as THREE.Mesh);

      if (targetData && !targetData.target.getIsDead()) {
        hitSomething = true;
        hitTarget = targetData.target;
        isHeadshotHit = targetData.isHeadshot;

        const baseDmg = this.config.damage;
        damageDealt = isHeadshotHit ? baseDmg * this.config.headshotMultiplier : baseDmg;
        hitTarget.takeDamage(damageDealt, isHeadshotHit, finalHitPoint);
        this.spawnImpactSpark(finalHitPoint, 0xff3333);
      } else {
        // Hit environment or obstacle
        this.spawnImpactSpark(finalHitPoint, 0xffd700);
      }
    }

    // Spawn high velocity tracer
    this.spawnTracer(finalHitPoint);

    return {
      fired: true,
      hit: hitSomething,
      isHeadshot: isHeadshotHit,
      damage: damageDealt,
      hitPoint: finalHitPoint,
      target: hitTarget,
    };
  }

  private triggerMuzzleFlash(): void {
    if (this.muzzleFlashMesh) {
      this.muzzleFlashMesh.visible = true;
      this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    }
    if (this.muzzleFlashLight) {
      this.muzzleFlashLight.intensity = 3.5;
    }
    this.muzzleFlashTimer = 0.04;
  }

  private spawnTracer(endPos: THREE.Vector3): void {
    const muzzlePos = new THREE.Vector3();
    if (this.muzzleFlashMesh) {
      this.muzzleFlashMesh.getWorldPosition(muzzlePos);
    } else {
      this.camera.getWorldPosition(muzzlePos);
      muzzlePos.addScaledVector(this.cameraWorldDir, 0.4);
    }

    const geo = new THREE.BufferGeometry().setFromPoints([muzzlePos, endPos]);
    const mat = new THREE.LineBasicMaterial({
      color: this.type === 'akm' ? 0xffaa33 : 0xffdd66,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.activeTracers.push({
      line,
      timer: 0,
      maxDuration: 0.08,
    });
  }

  private spawnImpactSpark(pos: THREE.Vector3, color: number): void {
    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    const spark = new THREE.Mesh(geo, mat);
    spark.position.copy(pos);
    this.scene.add(spark);
    this.activeImpacts.push({ mesh: spark, timer: 0.12 });
  }

  public update(dt: number): void {
    if (this.fireTimer > 0) {
      this.fireTimer = Math.max(0, this.fireTimer - dt);
    }

    if (this.recoilOffsetZ > 0) {
      this.recoilOffsetZ = Math.max(0, this.recoilOffsetZ - dt * 0.4);
      this.gunGroup.position.z = -0.38 + this.recoilOffsetZ;
    } else {
      this.gunGroup.position.z = -0.38;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.reloadTimer = 0;
        const needed = this.currentMagCapacity - this.ammoInMag;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += toLoad;
        this.reserveAmmo -= toLoad;
      }
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        if (this.muzzleFlashMesh) this.muzzleFlashMesh.visible = false;
        if (this.muzzleFlashLight) this.muzzleFlashLight.intensity = 0;
      }
    }

    // Update bullet tracers
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const t = this.activeTracers[i];
      t.timer += dt;
      const mat = t.line.material as THREE.LineBasicMaterial;
      mat.opacity = 1 - t.timer / t.maxDuration;
      if (t.timer >= t.maxDuration) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        mat.dispose();
        this.activeTracers.splice(i, 1);
      }
    }

    // Update impacts
    for (let i = this.activeImpacts.length - 1; i >= 0; i--) {
      const imp = this.activeImpacts[i];
      imp.timer -= dt;
      if (imp.timer <= 0) {
        this.scene.remove(imp.mesh);
        imp.mesh.geometry.dispose();
        (imp.mesh.material as THREE.Material).dispose();
        this.activeImpacts.splice(i, 1);
      }
    }
  }

  private buildGunModel(): void {
    this.gunGroup.position.set(0.18, -0.16, -0.38);

    if (this.type === 'akm') {
      // AKM: Wooden Handguard & Stock, Dark Steel Receiver, Curved Steel Banana Mag
      const darkSteelMat = new THREE.MeshStandardMaterial({
        color: 0x222426,
        roughness: 0.4,
        metalness: 0.8,
      });
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.6,
        metalness: 0.1,
      });

      // Receiver
      const recGeo = new THREE.BoxGeometry(0.045, 0.065, 0.28);
      const rec = new THREE.Mesh(recGeo, darkSteelMat);
      this.gunGroup.add(rec);

      // Wooden Stock
      const stockGeo = new THREE.BoxGeometry(0.038, 0.085, 0.24);
      const stock = new THREE.Mesh(stockGeo, woodMat);
      stock.position.set(0, -0.02, 0.22);
      this.gunGroup.add(stock);

      // Wooden Handguard
      const handGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.16, 8);
      handGeo.rotateX(Math.PI / 2);
      const hand = new THREE.Mesh(handGeo, woodMat);
      hand.position.set(0, 0.005, -0.22);
      this.gunGroup.add(hand);

      // Barrel & Gas Tube
      const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8);
      barrelGeo.rotateX(Math.PI / 2);
      const barrel = new THREE.Mesh(barrelGeo, darkSteelMat);
      barrel.position.set(0, 0.015, -0.32);
      this.gunGroup.add(barrel);

      // Curved Banana Magazine
      const magGeo = new THREE.BoxGeometry(0.032, 0.16, 0.065);
      const mag = new THREE.Mesh(magGeo, darkSteelMat);
      mag.position.set(0, -0.1, -0.04);
      mag.rotation.x = -0.25;
      this.gunGroup.add(mag);

      // Grip
      const gripGeo = new THREE.BoxGeometry(0.032, 0.09, 0.04);
      const grip = new THREE.Mesh(gripGeo, woodMat);
      grip.position.set(0, -0.075, 0.07);
      grip.rotation.x = -0.35;
      this.gunGroup.add(grip);
    } else {
      // M4 Carbine: Tactical Matte Black, Quad Rail, STANAG Mag, Stock
      const blackMat = new THREE.MeshStandardMaterial({
        color: 0x1b1c1e,
        roughness: 0.5,
        metalness: 0.7,
      });
      const oliveMat = new THREE.MeshStandardMaterial({
        color: 0x2e3532,
        roughness: 0.6,
        metalness: 0.3,
      });

      // Upper & Lower Receiver
      const recGeo = new THREE.BoxGeometry(0.042, 0.07, 0.26);
      const rec = new THREE.Mesh(recGeo, blackMat);
      this.gunGroup.add(rec);

      // Quad Rail Handguard
      const railGeo = new THREE.BoxGeometry(0.045, 0.045, 0.2);
      const rail = new THREE.Mesh(railGeo, oliveMat);
      rail.position.set(0, 0.01, -0.21);
      this.gunGroup.add(rail);

      // Barrel & Birdcage Flash Hider
      const barrelGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.38, 8);
      barrelGeo.rotateX(Math.PI / 2);
      const barrel = new THREE.Mesh(barrelGeo, blackMat);
      barrel.position.set(0, 0.01, -0.29);
      this.gunGroup.add(barrel);

      // Buffer tube & Collapsible Stock
      const stockGeo = new THREE.BoxGeometry(0.036, 0.09, 0.22);
      const stock = new THREE.Mesh(stockGeo, oliveMat);
      stock.position.set(0, -0.01, 0.21);
      this.gunGroup.add(stock);

      // STANAG Magazine
      const magGeo = new THREE.BoxGeometry(0.03, 0.15, 0.055);
      const mag = new THREE.Mesh(magGeo, blackMat);
      mag.position.set(0, -0.095, -0.03);
      mag.rotation.x = -0.15;
      this.gunGroup.add(mag);

      // Pistol Grip
      const gripGeo = new THREE.BoxGeometry(0.032, 0.095, 0.038);
      const grip = new THREE.Mesh(gripGeo, blackMat);
      grip.position.set(0, -0.08, 0.07);
      grip.rotation.x = -0.32;
      this.gunGroup.add(grip);
    }

    // Muzzle Flash Effect (Cone & PointLight at tip of barrel)
    const flashGeo = new THREE.ConeGeometry(0.06, 0.14, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.9,
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.015, -0.52);
    this.muzzleFlashMesh.visible = false;
    this.gunGroup.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 6);
    this.muzzleFlashLight.position.set(0, 0.015, -0.52);
    this.gunGroup.add(this.muzzleFlashLight);
  }

  public dispose(): void {
    if (this.gunGroup.parent) {
      this.gunGroup.parent.remove(this.gunGroup);
    }
  }
}
