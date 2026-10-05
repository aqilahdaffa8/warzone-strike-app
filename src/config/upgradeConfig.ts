/**
 * Permanent supply upgrades (stackable until their cap, reset on every new run).
 * One "step" = one pick on a normal wave; boss waves grant `bossSteps` at once.
 */
export const UPGRADE_CONFIG = {
  normalSteps: 1,
  bossSteps: 2,
  reload: { perStep: 0.15, maxSteps: 4 }, // +15% reload speed per step (max +60%)
  damage: { perStep: 0.1, maxSteps: 5 }, // +10% firearm / RPG damage per step (max +50%)
  maxHp: { perStep: 20, maxSteps: 5 }, // +20 max HP per step (max +100)
} as const;

export type UpgradeKind = 'reload' | 'damage' | 'maxHp';

export interface UpgradeSteps {
  reload: number;
  damage: number;
  maxHp: number;
}
