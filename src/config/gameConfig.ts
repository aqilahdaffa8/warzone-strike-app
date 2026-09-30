export interface PlayerConfig {
  maxHp: number;
  speed: number;
  jumpSpeed: number;
  gravity: number;
  height: number;
  eyeHeight: number;
  radius: number;
  mouseSensitivity: number;
  startingPosition: { x: number; y: number; z: number };
}

export interface GameConfig {
  player: PlayerConfig;
}

/**
 * Temporary playtest defaults as specified in GAME_SPEC.md Section 15.
 * Values are centralized and easily tunable.
 */
export const GAME_CONFIG: GameConfig = {
  player: {
    maxHp: 100,
    speed: 6.0, // 6 m/s
    jumpSpeed: 5.0, // Optional jump vertical impulse
    gravity: 18.0, // Gravity acceleration in m/s^2
    height: 1.8, // Total player height in meters
    eyeHeight: 1.6, // Camera eye height in meters
    radius: 0.4, // AABB half-extents in XZ plane (0.8m x 0.8m footprint)
    mouseSensitivity: 0.0022, // Default radians per pixel
    startingPosition: { x: 0, y: 0, z: 12 }, // Safe open spot facing arena center
  },
};
