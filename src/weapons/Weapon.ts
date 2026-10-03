import * as THREE from 'three';

export type WeaponType = 'sniper' | 'knife' | 'bazooka' | 'akm' | 'm4' | 'grenade';

export interface HitResult {
  damage: number;
  isHeadshot: boolean;
  remainingHp: number;
  isKilled: boolean;
}

export interface FireResult {
  fired: boolean;
  reason?: 'cooldown' | 'empty' | 'reloading';
  hit?: boolean;
  isHeadshot?: boolean;
  damage?: number;
  hitPoint?: THREE.Vector3;
  target?: DamageableTarget;
}

export interface DamageableTarget {
  readonly id: string;
  readonly position: THREE.Vector3;
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
