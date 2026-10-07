import * as THREE from 'three';
import { Enemy } from './Enemy';
import { EnemyConfig, BossConfig } from '../config/gameConfig';
import { getBossStats, BossScaledStats } from '../wave/WaveConfig';

const BOSS_TITLES = [
  'IRON JUGGERNAUT',
  'WARLORD GOLIATH',
  'DREADNOUGHT CENTURION',
  'APEX DESTROYER',
  'WARZONE OVERLORD',
];

/**
 * Boss enemy entity appearing on waves 5, 10, 15, 20...
 * Inherits from Enemy, featuring scaled HP, scaled primitive geometry with size cap,
 * higher melee damage, distinct obsidian/gold warlord armor, and dramatic boss health tracking.
 */
import { OrientedCollider } from '../environment/Arena';

export class Boss extends Enemy {
  public readonly bossTitle: string;
  public readonly waveNumber: number;
  public readonly appearanceIndex: number;
  public readonly bossStats: BossScaledStats;

  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    waveNumber: number,
    bossConfig: BossConfig,
    baseEnemyConfig: EnemyConfig,
    colliders: THREE.Box3[],
    scene: THREE.Scene,
    orientedColliders?: OrientedCollider[]
  ) {
    const stats = getBossStats(waveNumber, bossConfig);
    const appearanceIndex = Math.max(0, Math.floor(waveNumber / bossConfig.waveInterval) - 1);
    const titleIndex = appearanceIndex % BOSS_TITLES.length;
    const title = `${BOSS_TITLES[titleIndex]} ${appearanceIndex >= BOSS_TITLES.length ? `MK-${Math.floor(appearanceIndex / BOSS_TITLES.length) + 1}` : ''}`.trim();

    // Construct scaled EnemyConfig for Boss
    const scaledConfig: EnemyConfig = {
      maxHp: stats.hp,
      damage: stats.damage,
      speed: stats.speed,
      attackRange: stats.attackRange,
      attackCooldown: stats.attackCooldown,
      radius: baseEnemyConfig.radius * stats.scale,
      height: baseEnemyConfig.height * stats.scale,
      rangedMinDistance: 3.0,
      rangedMaxDistance: stats.rangedMaxDistance,
      rangedCooldown: stats.rangedCooldown,
      rangedDamage: stats.rangedDamage,
      rangedSpeed: stats.rangedSpeed,
    };

    super(
      id,
      spawnPos,
      scaledConfig,
      colliders,
      scene,
      stats.scale,
      true, // isBoss
      orientedColliders
    );

    this.bossTitle = title;
    this.waveNumber = waveNumber;
    this.appearanceIndex = appearanceIndex;
    this.bossStats = stats;
  }
}
