import * as THREE from 'three';
import { PlayerHealth } from '../player/PlayerHealth';

export interface EnemyProjectile {
  mesh: THREE.Mesh;
  light?: THREE.PointLight;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  damage: number;
  isBossShot: boolean;
  life: number;
  maxLife: number;
}

export interface ProjectileImpactSpark {
  mesh: THREE.Mesh;
  timer: number;
}

export class EnemyProjectileManager {
  private readonly scene: THREE.Scene;
  private readonly activeProjectiles: EnemyProjectile[] = [];
  private readonly activeSparks: ProjectileImpactSpark[] = [];

  // Shared Geometries & Materials to avoid memory allocation per shot
  private readonly regularBulletGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
  private readonly regularBulletMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });

  private readonly bossPlasmaGeo = new THREE.SphereGeometry(0.18, 12, 12);
  private readonly bossPlasmaMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.regularBulletGeo.rotateX(Math.PI / 2);
  }

  public getActiveCount(): number {
    return this.activeProjectiles.length;
  }

  /**
   * Spawns an enemy or boss projectile towards the player.
   */
  public spawnProjectile(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    damage: number,
    speed: number,
    isBoss: boolean = false
  ): void {
    const dir = new THREE.Vector3().subVectors(target, origin);
    const dist = dir.length();
    if (dist < 0.1) return;
    dir.normalize();

    // Slight combat inaccuracy (spread)
    const spread = isBoss ? 0.04 : 0.07;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread * 0.5;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    let mesh: THREE.Mesh;
    let light: THREE.PointLight | undefined;

    if (isBoss) {
      mesh = new THREE.Mesh(this.bossPlasmaGeo, this.bossPlasmaMat);
      light = new THREE.PointLight(0xff4400, 3, 6);
      mesh.add(light);
    } else {
      mesh = new THREE.Mesh(this.regularBulletGeo, this.regularBulletMat);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    }

    mesh.position.copy(origin);
    this.scene.add(mesh);

    this.activeProjectiles.push({
      mesh,
      light,
      position: origin.clone(),
      direction: dir,
      speed,
      damage,
      isBossShot: isBoss,
      life: 0,
      maxLife: 3.5, // 3.5 seconds max flight time
    });
  }

  /**
   * Updates projectile flight, collisions against obstacles, and hits on player.
   */
  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerHealth: PlayerHealth,
    obstacles: THREE.Object3D[]
  ): void {
    // 1. Advance and test projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.life += dt;

      const step = p.direction.clone().multiplyScalar(p.speed * dt);
      const nextPos = p.position.clone().add(step);

      let shouldRemove = false;

      // Hit Player Check (AABB cylinder around player: radius ~0.55m, height 1.8m)
      const dx = nextPos.x - playerPos.x;
      const dz = nextPos.z - playerPos.z;
      const horizontalDist = Math.hypot(dx, dz);
      const verticalDist = nextPos.y - playerPos.y;

      if (horizontalDist < 0.6 && verticalDist >= 0 && verticalDist <= 1.8) {
        // Direct hit on player!
        playerHealth.takeDamage(p.damage, p.position);
        this.spawnImpactSpark(nextPos, true);
        shouldRemove = true;
      }

      // Hit Ground / Ceiling
      if (!shouldRemove && (nextPos.y <= 0.05 || nextPos.y >= 20)) {
        this.spawnImpactSpark(nextPos, false);
        shouldRemove = true;
      }

      // Hit Obstacles (Walls, Containers, Crates, Barriers)
      if (!shouldRemove) {
        for (let j = 0; j < obstacles.length; j++) {
          const box = new THREE.Box3().setFromObject(obstacles[j]);
          if (box.containsPoint(nextPos)) {
            this.spawnImpactSpark(nextPos, false);
            shouldRemove = true;
            break;
          }
        }
      }

      // Max lifetime expired
      if (!shouldRemove && p.life >= p.maxLife) {
        shouldRemove = true;
      }

      if (shouldRemove) {
        this.scene.remove(p.mesh);
        if (p.light) {
          p.mesh.remove(p.light);
          p.light.dispose();
        }
        this.activeProjectiles.splice(i, 1);
      } else {
        p.position.copy(nextPos);
        p.mesh.position.copy(nextPos);
      }
    }

    // 2. Update Impact Sparks
    for (let i = this.activeSparks.length - 1; i >= 0; i--) {
      const spark = this.activeSparks[i];
      spark.timer -= dt;
      if (spark.timer <= 0) {
        this.scene.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        (spark.mesh.material as THREE.Material).dispose();
        this.activeSparks.splice(i, 1);
      }
    }
  }

  private spawnImpactSpark(pos: THREE.Vector3, isPlayerHit: boolean): void {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: isPlayerHit ? 0xff1100 : 0xffaa00,
    });
    const spark = new THREE.Mesh(geo, mat);
    spark.position.copy(pos);
    this.scene.add(spark);

    this.activeSparks.push({
      mesh: spark,
      timer: 0.12,
    });
  }

  public clear(): void {
    for (const p of this.activeProjectiles) {
      this.scene.remove(p.mesh);
      if (p.light) {
        p.mesh.remove(p.light);
        p.light.dispose();
      }
    }
    this.activeProjectiles.length = 0;

    for (const s of this.activeSparks) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    this.activeSparks.length = 0;
  }

  public dispose(): void {
    this.clear();
    this.regularBulletGeo.dispose();
    this.regularBulletMat.dispose();
    this.bossPlasmaGeo.dispose();
    this.bossPlasmaMat.dispose();
  }
}
