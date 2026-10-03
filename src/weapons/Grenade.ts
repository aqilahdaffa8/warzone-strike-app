import * as THREE from 'three';
import { GrenadeConfig } from '../config/gameConfig';
import { DamageableTarget } from './Weapon';

export interface ActiveGrenade {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuseTimer: number;
}

export interface ActiveExplosionEffect {
  sphereMesh: THREE.Mesh;
  light?: THREE.PointLight;
  currentRadius: number;
  maxRadius: number;
  timer: number;
  duration: number;
}

export class GrenadeManager {
  private readonly config: GrenadeConfig;
  private readonly scene: THREE.Scene;
  private readonly colliders: THREE.Box3[];

  private activeGrenades: ActiveGrenade[] = [];
  private activeExplosions: ActiveExplosionEffect[] = [];
  private throwCooldown: number = 0;
  private grenadeCount: number = 1; // Start with 1 tactical frag grenade

  public onExplosion?: (position: THREE.Vector3, radius: number) => void;

  constructor(config: GrenadeConfig, scene: THREE.Scene, colliders: THREE.Box3[]) {
    this.config = config;
    this.scene = scene;
    this.colliders = colliders;
  }

  public getGrenadeCount(): number {
    return this.grenadeCount;
  }

  public addGrenades(amount: number): void {
    this.grenadeCount = Math.min(10, this.grenadeCount + amount);
  }

  public reset(startingCount: number = 1): void {
    this.grenadeCount = startingCount;
    this.throwCooldown = 0;
    this.clearAll();
  }

  public canThrow(): boolean {
    return this.grenadeCount > 0 && this.throwCooldown <= 0;
  }

  public throwGrenade(camera: THREE.Camera): boolean {
    if (!this.canThrow()) return false;

    this.grenadeCount--;
    this.throwCooldown = this.config.cooldown;

    // Create 3D Grenade Model (Military fragmentation sphere with pin)
    const grenadeGroup = new THREE.Group();

    const bodyGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x303b2b, // Olive Drab military casing
      roughness: 0.5,
      metalness: 0.6,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    grenadeGroup.add(bodyMesh);

    // Pin & Lever top collar
    const pinGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8);
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Brass safety pin collar
      roughness: 0.3,
      metalness: 0.8,
    });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.set(0, 0.09, 0);
    grenadeGroup.add(pinMesh);

    // Initial position: just in front of camera
    const spawnPos = new THREE.Vector3();
    camera.getWorldPosition(spawnPos);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    spawnPos.addScaledVector(forward, 0.4);
    spawnPos.y -= 0.1;

    grenadeGroup.position.copy(spawnPos);
    this.scene.add(grenadeGroup);

    // Forward velocity + slight upward arc
    const velocity = forward.clone().multiplyScalar(this.config.throwSpeed);
    velocity.y += 3.5; // Upward arc impulse

    this.activeGrenades.push({
      mesh: grenadeGroup,
      position: spawnPos,
      velocity,
      fuseTimer: this.config.fuseTime,
    });

    return true;
  }

  public update(dt: number, targets: DamageableTarget[]): void {
    if (this.throwCooldown > 0) {
      this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    }

    // 1. Update In-Flight Grenades
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuseTimer -= dt;

      // Gravity acceleration (18 m/s^2)
      g.velocity.y -= 18.0 * dt;

      // Integrate position
      g.position.x += g.velocity.x * dt;
      g.position.y += g.velocity.y * dt;
      g.position.z += g.velocity.z * dt;

      // Floor bounce (y = 0.09 is radius)
      if (g.position.y <= 0.09) {
        g.position.y = 0.09;
        g.velocity.y = -g.velocity.y * 0.42; // Elasticity bounce
        g.velocity.x *= 0.78; // Floor friction
        g.velocity.z *= 0.78;
      }

      // Safe collision bounce against arena obstacle AABBs (with position pushout to prevent getting trapped)
      const grenadeBox = new THREE.Box3().setFromCenterAndSize(
        g.position,
        new THREE.Vector3(0.2, 0.2, 0.2)
      );
      for (const col of this.colliders) {
        if (grenadeBox.intersectsBox(col)) {
          g.position.x -= g.velocity.x * dt * 1.5;
          g.position.z -= g.velocity.z * dt * 1.5;
          g.velocity.x = -g.velocity.x * 0.4;
          g.velocity.z = -g.velocity.z * 0.4;
          break;
        }
      }

      // Direct impact detonation if hitting an active enemy combatant
      for (const target of targets) {
        if (!target.getIsDead() && target.position) {
          if (g.position.distanceTo(target.position) < 0.8) {
            g.fuseTimer = 0; // Detonate immediately on direct enemy contact
            break;
          }
        }
      }

      // Tumble rotation
      g.mesh.rotation.x += dt * 8.0;
      g.mesh.rotation.y += dt * 5.0;
      g.mesh.position.copy(g.position);

      // Detonation on fuse expiry or direct impact (with guaranteed cleanup)
      if (g.fuseTimer <= 0) {
        try {
          this.detonate(g.position, targets);
        } catch (err) {
          console.error('Error detonating grenade:', err);
        } finally {
          this.scene.remove(g.mesh);
          this.activeGrenades.splice(i, 1);
        }
      }
    }

    // 2. Update Explosion Shockwave FX
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      exp.timer += dt;
      const progress = Math.min(1.0, exp.timer / exp.duration);

      // Expand sphere shockwave
      const currentScale = THREE.MathUtils.lerp(0.5, exp.maxRadius, progress);
      exp.sphereMesh.scale.set(currentScale, currentScale, currentScale);

      // Fade out material
      const mat = exp.sphereMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 * (1.0 - progress));

      // Dim light
      if (exp.light) {
        exp.light.intensity = 5.0 * (1.0 - progress);
      }

      if (exp.timer >= exp.duration) {
        this.scene.remove(exp.sphereMesh);
        exp.sphereMesh.geometry.dispose();
        mat.dispose();
        if (exp.light) {
          this.scene.remove(exp.light);
        }
        this.activeExplosions.splice(i, 1);
      }
    }
  }

  private detonate(pos: THREE.Vector3, targets: DamageableTarget[]): void {
    const blastRadius = this.config.radius;
    const maxDamage = this.config.damage;

    if (this.onExplosion) {
      this.onExplosion(pos, blastRadius);
    }

    // 1. Visual Expanding Shockwave Mesh
    const expGeo = new THREE.SphereGeometry(1, 16, 16);
    const expMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
    });
    const expMesh = new THREE.Mesh(expGeo, expMat);
    expMesh.position.copy(pos);
    this.scene.add(expMesh);

    // Dynamic explosion light flash
    const light = new THREE.PointLight(0xff5500, 5, blastRadius * 2);
    light.position.copy(pos);
    this.scene.add(light);

    this.activeExplosions.push({
      sphereMesh: expMesh,
      light,
      currentRadius: 0.5,
      maxRadius: blastRadius,
      timer: 0,
      duration: 0.4,
    });

    // 2. Deal AoE damage to all living enemies within blastRadius
    for (const target of targets) {
      if (target.getIsDead()) continue;

      const dist = pos.distanceTo(target.position);
      if (dist <= blastRadius) {
        // Damage falloff: 100% at center down to 50% at periphery
        const falloff = 1.0 - (dist / blastRadius) * 0.5;
        const damage = Math.round(maxDamage * falloff);

        target.takeDamage(damage, false, target.position.clone().add(new THREE.Vector3(0, 1.0, 0)));
      }
    }
  }

  public clearAll(): void {
    for (const g of this.activeGrenades) {
      this.scene.remove(g.mesh);
    }
    this.activeGrenades.length = 0;

    for (const exp of this.activeExplosions) {
      this.scene.remove(exp.sphereMesh);
      exp.sphereMesh.geometry.dispose();
      (exp.sphereMesh.material as THREE.Material).dispose();
      if (exp.light) this.scene.remove(exp.light);
    }
    this.activeExplosions.length = 0;
  }

  public dispose(): void {
    this.clearAll();
  }
}
