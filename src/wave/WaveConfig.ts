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
 * Wave 1: initialEnemies (5)
 * Wave 2: 5 + 2 = 7
 * Wave 3: 5 + 4 = 9, etc.
 */
export function getWaveEnemyCount(waveNumber: number, config: WaveConfig): number {
  const waveIndex = Math.max(0, waveNumber - 1);
  return config.initialEnemies + waveIndex * config.additionalEnemiesPerWave;
}

/**
 * Calculates scaled enemy HP for a given wave (+12% per wave by default).
 */
export function getWaveEnemyHp(waveNumber: number, baseHp: number, config: WaveConfig): number {
  const waveIndex = Math.max(0, waveNumber - 1);
  return Math.round(baseHp * (1 + waveIndex * config.hpScaling));
}

/**
 * Calculates scaled enemy damage for a given wave (+8% per wave by default).
 */
export function getWaveEnemyDamage(waveNumber: number, baseDamage: number, config: WaveConfig): number {
  const waveIndex = Math.max(0, waveNumber - 1);
  return Math.round(baseDamage * (1 + waveIndex * config.damageScaling));
}

/**
 * Calculates how many bosses should spawn for a given boss encounter:
 * - Wave < 6 (e.g. Wave 5): 1 Boss
 * - Wave >= 6 and < 8 (e.g. Wave 6, 7): 2 Bosses
 * - Wave >= 8 (e.g. Wave 8, 10, 12, ...): 3 Bosses
 */
export function getBossCountForWave(waveNumber: number): number {
  if (waveNumber >= 8) return 3;
  if (waveNumber >= 6) return 2;
  return 1;
}

/**
 * Checks whether the given wave is a boss encounter wave.
 * - Wave 5: Initial Warlord (1 Boss)
 * - Wave 6: Dual Warlords (2 Bosses)
 * - Wave 8+: Triple Warlords (3 Bosses) on wave 8, and subsequent even waves / interval waves.
 */
export function isBossWave(waveNumber: number, bossConfig?: BossConfig): boolean {
  if (waveNumber < 5) return false;
  if (waveNumber === 5 || waveNumber === 6) return true;
  if (waveNumber >= 8 && (waveNumber % 2 === 0 || (bossConfig && waveNumber % bossConfig.waveInterval === 0))) {
    return true;
  }
  if (bossConfig && waveNumber % bossConfig.waveInterval === 0) return true;
  return false;
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
