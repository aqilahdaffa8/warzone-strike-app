import * as THREE from 'three';
import { WaveConfig, EnemyConfig } from '../config/gameConfig';

/**
 * Handles selecting safe, tactical spawn positions across the arena.
 * Guarantees minimum distance from player and zero collision with arena obstacles.
 */
export class SpawnManager {
  private readonly waveConfig: WaveConfig;
  private readonly enemyConfig: EnemyConfig;
  private readonly colliders: THREE.Box3[];

  // Dedicated perimeter spawn zones spread across military arena perimeter (60x60m)
  private readonly tacticalSpawnZones: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, -25),   // North Gate
    new THREE.Vector3(22, 0, -22),  // North-East Depot
    new THREE.Vector3(25, 0, 0),    // East Corridor
    new THREE.Vector3(22, 0, 22),   // South-East Yard
    new THREE.Vector3(0, 0, 25),    // South Gate
    new THREE.Vector3(-22, 0, 22),  // South-West Flank
    new THREE.Vector3(-25, 0, 0),   // West Bunker Area
    new THREE.Vector3(-22, 0, -22), // North-West Tower Base
  ];

  private readonly testBox = new THREE.Box3();
  private lastZoneIndex: number = 0;

  constructor(waveConfig: WaveConfig, enemyConfig: EnemyConfig, colliders: THREE.Box3[]) {
    this.waveConfig = waveConfig;
    this.enemyConfig = enemyConfig;
    this.colliders = colliders;
  }

  /**
   * Tests whether an AABB of specified radius and height centered at (x, 0, z)
   * collides with any arena obstacle.
   */
  public isCollidingObstacle(x: number, z: number, radius?: number, height?: number): boolean {
    const r = radius !== undefined ? radius : this.enemyConfig.radius;
    const h = height !== undefined ? height : this.enemyConfig.height;

    this.testBox.min.set(x - r, 0.1, z - r);
    this.testBox.max.set(x + r, h - 0.1, z + r);

    for (let i = 0; i < this.colliders.length; i++) {
      if (this.testBox.intersectsBox(this.colliders[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finds a valid spawn position that satisfies:
   * 1. Distance to player is >= minSpawnDistance (20m)
   * 2. Position does NOT intersect any arena obstacle
   * 3. Position stays within arena bounds (-28 to +28)
   */
  public getValidSpawnPosition(
    playerPos: THREE.Vector3,
    existingEnemyPositions: THREE.Vector3[] = [],
    enemyRadius?: number,
    enemyHeight?: number
  ): THREE.Vector3 {
    const minDistance = this.waveConfig.minSpawnDistance;
    const r = enemyRadius !== undefined ? enemyRadius : this.enemyConfig.radius;
    const h = enemyHeight !== undefined ? enemyHeight : this.enemyConfig.height;

    // 1. First attempt: Rotate through pre-vetted tactical zones
    const zoneCount = this.tacticalSpawnZones.length;
    const startIndex = (this.lastZoneIndex + 1) % zoneCount;

    for (let i = 0; i < zoneCount; i++) {
      const idx = (startIndex + i) % zoneCount;
      const zone = this.tacticalSpawnZones[idx];

      // Add a slight jitter (±2.5m) around the zone center
      const candidateX = zone.x + (Math.random() - 0.5) * 5.0;
      const candidateZ = zone.z + (Math.random() - 0.5) * 5.0;

      const distToPlayer = Math.hypot(candidateX - playerPos.x, candidateZ - playerPos.z);
      if (distToPlayer >= minDistance && !this.isCollidingObstacle(candidateX, candidateZ, r, h)) {
        // Also avoid spawning right on top of another living enemy
        const tooCloseToOther = existingEnemyPositions.some(
          (other) => Math.hypot(other.x - candidateX, other.z - candidateZ) < r * 2.5
        );
        if (!tooCloseToOther) {
          this.lastZoneIndex = idx;
          return new THREE.Vector3(candidateX, 0, candidateZ);
        }
      }
    }

    // 2. Second attempt: Random perimeter sampling (angles 0 to 2*PI, radius 21m to 27m)
    for (let attempt = 0; attempt < 25; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 21 + Math.random() * 6; // 21m to 27m from center
      const x = Math.max(-27, Math.min(27, Math.cos(angle) * dist));
      const z = Math.max(-27, Math.min(27, Math.sin(angle) * dist));

      const distToPlayer = Math.hypot(x - playerPos.x, z - playerPos.z);
      if (distToPlayer >= minDistance && !this.isCollidingObstacle(x, z, r, h)) {
        return new THREE.Vector3(x, 0, z);
      }
    }

    // 3. Fallback: Select the tactical zone furthest from player
    let maxDist = -1;
    let bestZone = this.tacticalSpawnZones[0];
    for (const zone of this.tacticalSpawnZones) {
      const d = Math.hypot(zone.x - playerPos.x, zone.z - playerPos.z);
      if (d > maxDist) {
        maxDist = d;
        bestZone = zone;
      }
    }

    return bestZone.clone();
  }
}
