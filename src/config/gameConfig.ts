export interface PlayerConfig {
  maxHp: number;
  speed: number;
  sprintSpeed: number;
  maxStamina: number;
  staminaDrainPerSecond: number;
  staminaRecoveryPerSecond: number;
  cameraBobFrequency: number;
  cameraBobVerticalAmplitude: number;
  cameraBobRollAmplitude: number;
  jumpSpeed: number;
  gravity: number;
  height: number;
  eyeHeight: number;
  radius: number;
  mouseSensitivity: number;
  startingPosition: { x: number; y: number; z: number };
}

export interface SniperConfig {
  bodyDamage: number;
  headshotMultiplier: number;
  fireInterval: number;
  magazineCapacity: number;
  reserveAmmo: number;
  reloadDuration: number;
  scopedFov: number;
  defaultFov: number;
}

export interface KnifeConfig {
  damage: number;
  headshotMultiplier: number;
  cooldown: number;
  range: number;
}

export interface TargetDummyConfig {
  maxHp: number;
  respawnTime: number;
}

export interface EnemyConfig {
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  radius: number;
  height: number;
  rangedMinDistance: number;
  rangedMaxDistance: number;
  rangedCooldown: number;
  rangedDamage: number;
  rangedSpeed: number;
}

export interface WaveConfig {
  totalWaves: number;
  initialEnemies: number;
  additionalEnemiesPerWave: number;
  hpScaling: number;
  damageScaling: number;
  intermissionDuration: number;
  minSpawnDistance: number;
  maxActiveEnemies: number;
  spawnInterval: number;
}

export interface BossConfig {
  waveInterval: number;
  baseHp: number;
  hpScaling: number;
  baseDamage: number;
  damageScaling: number;
  baseScale: number;
  scalePerAppearance: number;
  maxScale: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  rangedCooldown: number;
  rangedDamage: number;
  rangedSpeed: number;
  rangedMaxDistance: number;
}

export interface GrenadeConfig {
  damage: number;
  radius: number;
  fuseTime: number;
  throwSpeed: number;
  cooldown: number;
}

export interface BazookaConfig {
  damage: number;
  blastRadius: number;
  rocketSpeed: number;
  fireInterval: number;
  magazineCapacity: number;
  reserveAmmo: number;
  reloadDuration: number;
}

export interface AssaultRifleConfig {
  name: string;
  damage: number;
  headshotMultiplier: number;
  fireInterval: number;
  magazineCapacity: number;
  reserveAmmo: number;
  reloadDuration: number;
}

export interface RewardConfig {
  ammoRefill: number;
  healthHeal: number;
  grenadesGiven: number;
  rocketsGiven: number;
  magazineUpgrade: number;
  bossAmmoRefill: number;
  bossHealthHeal: number;
  bossGrenadesGiven: number;
  bossRocketsGiven: number;
  bossMagazineUpgrade: number;
}

export type MockLeaderboardMode = 'success' | 'failure' | 'timeout' | 'offline';

export interface LeaderboardConfig {
  mockMode: MockLeaderboardMode;
  submissionTimeoutMs: number;
}

export interface SupplyDropConfig {
  interactionRadius: number;
  hiddenLifetime: number;
  /** Time (seconds) the crate remains visible and claimable before disappearing. Separate from hiddenLifetime. */
  displayLifetime: number;
  arenaMinX: number;
  arenaMaxX: number; 
  arenaMinZ: number;
  arenaMaxZ: number;
  spawnMargin: number;
  maxSpawnAttempts: number;
}

export interface ScoreConfig {
  regularKill: number;
  enemyKill?: number;
  headshotBonus: number;
  bossKill: number;
  waveClearMultiplier: number;
  waveClearBonus?: number;
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  regularKill: 100,
  enemyKill: 100,
  headshotBonus: 50,
  bossKill: 1000,
  waveClearMultiplier: 500,
  waveClearBonus: 500,
};

export interface GameConfig {
  player: PlayerConfig;
  sniper: SniperConfig;
  knife: KnifeConfig;
  dummy: TargetDummyConfig;
  enemy: EnemyConfig;
  wave: WaveConfig;
  boss: BossConfig;
  grenade: GrenadeConfig;
  bazooka: BazookaConfig;
  akm: AssaultRifleConfig;
  m4: AssaultRifleConfig;
  reward: RewardConfig;
  score: ScoreConfig;
  leaderboard: LeaderboardConfig;
  supplyDrop: SupplyDropConfig;
}

/**
 * Temporary playtest defaults as specified in GAME_SPEC.md Section 15.
 * Values are centralized and easily tunable.
 */
export const GAME_CONFIG: GameConfig = {
  player: {
    maxHp: 100,
    speed: 6.0, // 6 m/s normal run
    sprintSpeed: 10.5, // 10.5 m/s fast sprint when holding SHIFT
    maxStamina: 100,
    staminaDrainPerSecond: 25,
    staminaRecoveryPerSecond: 18,
    cameraBobFrequency: 2.0,
    cameraBobVerticalAmplitude: 0.025,
    cameraBobRollAmplitude: 0.006,
    jumpSpeed: 5.0, // Optional jump vertical impulse
    gravity: 18.0, // Gravity acceleration in m/s^2
    height: 1.8, // Total player height in meters
    eyeHeight: 1.6, // Camera eye height in meters
    radius: 0.4, // AABB half-extents in XZ plane (0.8m x 0.8m footprint)
    mouseSensitivity: 0.0022, // Default radians per pixel
    startingPosition: { x: 0, y: 0, z: 12 }, // Safe open spot facing arena center
  },
  sniper: {
    bodyDamage: 80,
    headshotMultiplier: 2.5,
    fireInterval: 1.5, // 1.5s
    magazineCapacity: 5,
    reserveAmmo: 30,
    reloadDuration: 1.8, // Reduced from 2.5s for snappy gameplay
    scopedFov: 20, // 20 degrees scope
    defaultFov: 75, // 75 degrees normal
  },
  knife: {
    damage: 35, // 35 damage per swing
    headshotMultiplier: 1.5, // 1.5x multiplier for headshots
    cooldown: 0.6, // 0.6s attack cooldown
    range: 2.0, // 2.0m melee range
  },
  dummy: {
    maxHp: 100,
    respawnTime: 2.0, // 2.0s respawn after knockdown
  },
  enemy: {
    maxHp: 100, // 100 HP
    damage: 10, // 10 damage per melee hit
    speed: 3.5, // 3.5 m/s movement speed
    attackRange: 2.0, // 2.0 m attack range
    attackCooldown: 1.0, // 1.0 s attack interval
    radius: 0.4, // AABB half-extents in XZ plane (0.8m diameter)
    height: 1.8, // 1.8m height
    rangedMinDistance: 3.5, // Min distance to engage with rifle
    rangedMaxDistance: 26.0, // Max distance for ranged weapon fire
    rangedCooldown: 2.2, // Interval between shots (seconds)
    rangedDamage: 8, // Base bullet damage to player
    rangedSpeed: 22.0, // Bullet tracer velocity in m/s
  },
  wave: {
    totalWaves: 999999, // Endless waves without ceiling
    initialEnemies: 3, // Wave 1: 3 enemies (balanced early progression)
    additionalEnemiesPerWave: 2, // +2 enemies per wave
    hpScaling: 0.12, // +12% enemy HP per wave (challenging progression)
    damageScaling: 0.08, // +8% enemy damage per wave
    intermissionDuration: 10.0, // 10s intermission between waves (airdrop collection window)
    minSpawnDistance: 20.0, // 20m minimum spawn distance from player
    maxActiveEnemies: 15, // Maximum 15 active enemies in arena concurrently
    spawnInterval: 0.8, // 0.8s interval between spawning queued enemies
  },
  boss: {
    waveInterval: 5, // Baseline interval (5, 6, 8, 10, 12... have specialized multi-boss rules)
    baseHp: 1000, // Wave 5 boss HP = 1000
    hpScaling: 0.50, // +50% HP per subsequent boss appearance (1000, 1500, 2000...)
    baseDamage: 25, // 25 melee damage per strike
    damageScaling: 0.20, // +20% damage per subsequent appearance
    baseScale: 2.0, // 2.0x standard enemy size
    scalePerAppearance: 0.25, // +0.25x scale per boss appearance
    maxScale: 3.5, // Capped at 3.5x maximum scale
    speed: 2.8, // Slightly heavier / deliberate movement (2.8 m/s)
    attackRange: 2.8, // Extended melee reach for giant boss
    attackCooldown: 1.2, // 1.2s attack cooldown
    rangedCooldown: 1.5, // Rapid burst fire interval for Boss Plasma Cannons
    rangedDamage: 22, // Heavy plasma damage per hit
    rangedSpeed: 26.0, // High-speed plasma bolts
    rangedMaxDistance: 32.0, // 32m plasma reach
  },
  grenade: {
    damage: 250, // Massive 250 AoE explosion damage to wipe groups
    radius: 6.0, // 6.0 meter blast radius
    fuseTime: 1.2, // 1.2s fuse after throw before detonation
    throwSpeed: 18.0, // 18 m/s forward throw impulse
    cooldown: 0.8, // 0.8s throw cooldown
  },
  bazooka: {
    damage: 350, // 350 massive rocket explosion damage
    blastRadius: 7.0, // 7.0 meter blast radius
    rocketSpeed: 35.0, // 35 m/s rocket projectile velocity
    fireInterval: 1.8, // 1.8s between shots
    magazineCapacity: 1, // Single-shot tube launcher
    reserveAmmo: 3, // 3 rockets
    reloadDuration: 1.8, // Reduced from 2.2s for faster reload
  },
  akm: {
    name: 'AKM ASSAULT RIFLE',
    damage: 36, // Heavy 7.62mm stopping power
    headshotMultiplier: 2.0,
    fireInterval: 0.12, // 500 RPM full-auto
    magazineCapacity: 30,
    reserveAmmo: 90,
    reloadDuration: 1.6, // 1.6s reload
  },
  m4: {
    name: 'M4 CARBINE',
    damage: 28, // Fast 5.56mm rapid fire
    headshotMultiplier: 2.0,
    fireInterval: 0.088, // ~680 RPM high rate of fire
    magazineCapacity: 30,
    reserveAmmo: 120,
    reloadDuration: 1.5, // 1.5s snappy reload
  },
  reward: {
    ammoRefill: 25, // +25 reserve ammo on regular wave clear
    healthHeal: 40, // +40 HP health recovery
    grenadesGiven: 1, // +1 Tactical Frag Grenade per wave
    rocketsGiven: 2, // +2 RPG Rockets per wave
    magazineUpgrade: 2, // +2 magazine capacity upgrade for Sniper Rifle
    bossAmmoRefill: 45, // Full reserve ammo on Boss wave clear
    bossHealthHeal: 100, // Full 100 HP heal on Boss defeat
    bossGrenadesGiven: 3, // +3 Frag Grenades on Boss defeat
    bossRocketsGiven: 4, // +4 RPG Rockets on Boss defeat
    bossMagazineUpgrade: 3, // +3 magazine capacity upgrade on Boss defeat
  },
  score: DEFAULT_SCORE_CONFIG,
  leaderboard: {
    mockMode: 'success',
    submissionTimeoutMs: 10000,
  },
  supplyDrop: {
    interactionRadius: 2.5,
    hiddenLifetime: 10.0,    // Time (seconds) crate stays hidden in mini-timeline before becoming visible
    displayLifetime: 45.0,   // Time (seconds) crate is visible and claimable before auto-disappearing
    arenaMinX: -29,
    arenaMaxX: 29,
    arenaMinZ: -29,
    arenaMaxZ: 29,
    spawnMargin: 1.0,
    maxSpawnAttempts: 30,
  },
};