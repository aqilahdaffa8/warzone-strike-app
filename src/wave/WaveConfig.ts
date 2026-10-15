import { WaveConfig, BossConfig } from '../config/gameConfig';

export interface WaveScaledEnemyStats {
  enemyCount: number;
  hp: number;
  damage: number;
}

export interface BossScaledStats {
  scale: number;
  hp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  rangedDamage: number;
  rangedSpeed: number;
  rangedCooldown: number;
  rangedMaxDistance: number;
}

/**
 * Calculates number of regular enemies for a given wave.
 * Uses a soft cap to prevent overwhelming enemy counts in later waves.
 * Wave 1: initialEnemies (3)
 * Wave 2: 3 + 1 = 4
 * Wave 3: 3 + 2 = 5, etc., capped at max 22 enemies.
 */
export function getWaveEnemyCount(waveNumber: number, config: WaveConfig): number {
  const waveIndex = Math.max(0, waveNumber - 1);
  const calculated = config.initialEnemies + waveIndex * config.additionalEnemiesPerWave;
  const maxCap = 22; // Reasonable ceiling for single player arena
  return Math.min(maxCap, calculated);
}

/**
 * Calculates scaled enemy HP for a given wave (+5% per wave by default).
 */
export function getWaveEnemyHp(waveNumber: number, baseHp: number, config: WaveConfig): number {
  const waveIndex = Math.max(0, waveNumber - 1);
  return Math.round(baseHp * (1 + waveIndex * config.hpScaling));
}

/**
 * Calculates scaled enemy damage for a given wave (+5% per wave by default).
 */
export function getWaveEnemyDamage(waveNumber: number, baseDamage: number, config: WaveConfig): number {
  const waveIndex = Math.max(0, waveNumber - 1);
  return Math.round(baseDamage * (1 + waveIndex * config.damageScaling));
}

/**
 * Calculates how many bosses should spawn for a given boss encounter:
 * - Wave 5: 1 Boss (Introduction)
 * - Wave 10: 1 Boss (Empowered)
 * - Wave 15: 2 Bosses (Dual Warlords)
 * - Wave 20+: 2 Bosses (or 3 at Wave 25+)
 */
export function getBossCountForWave(waveNumber: number): number {
  if (waveNumber >= 25) return 3;
  if (waveNumber >= 15) return 2;
  return 1;
}

/**
 * Checks whether the given wave is a boss encounter wave.
 * Bosses only appear on wave intervals (multiples of 5: Wave 5, 10, 15, 20, ...).
 */
export function isBossWave(waveNumber: number, bossConfig?: BossConfig): boolean {
  if (waveNumber < 5) return false;
  const interval = bossConfig?.waveInterval ?? 5;
  return waveNumber % interval === 0;
}

/**
 * Calculates scaled boss parameters for the given boss wave.
 * Scale increases +0.25x per appearance capped at maxScale (3.5x).
 * HP increases +50% per appearance.
 */
export function getBossStats(waveNumber: number, bossConfig: BossConfig): BossScaledStats {
  const appearanceIndex = Math.max(0, Math.floor(waveNumber / bossConfig.waveInterval) - 1);

  const rawScale = bossConfig.baseScale + appearanceIndex * bossConfig.scalePerAppearance;
  const scale = Math.min(bossConfig.maxScale, Number(rawScale.toFixed(2)));

  const hp = Math.round(bossConfig.baseHp * (1 + appearanceIndex * bossConfig.hpScaling));
  const damage = Math.round(bossConfig.baseDamage * (1 + appearanceIndex * bossConfig.damageScaling));
  const rangedDamage = Math.round(bossConfig.rangedDamage * (1 + appearanceIndex * bossConfig.damageScaling));

  return {
    scale,
    hp,
    damage,
    speed: bossConfig.speed,
    attackRange: bossConfig.attackRange * (scale / bossConfig.baseScale),
    attackCooldown: bossConfig.attackCooldown,
    rangedDamage,
    rangedSpeed: bossConfig.rangedSpeed,
    rangedCooldown: Math.max(1.0, bossConfig.rangedCooldown - appearanceIndex * 0.1),
    rangedMaxDistance: bossConfig.rangedMaxDistance,
  };
}
