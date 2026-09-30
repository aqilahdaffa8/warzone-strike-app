import * as THREE from 'three';

export type WeaponType = 'sniper' | 'knife';

export interface HitResult {
  damage: number;
  isHeadshot: boolean;
  remainingHp: number;
  isKilled: boolean;
}

export interface DamageableTarget {
  readonly id: string;
  takeDamage(amount: number, isHeadshot: boolean, hitPoint?: THREE.Vector3): HitResult;
  getHitboxMeshes(): THREE.Mesh[];
  getIsDead(): boolean;
}

export interface Weapon {
  readonly type: WeaponType;
  readonly name: string;
  setActive(active: boolean): void;
  getIsActive(): boolean;
  dispose(): void;
}
