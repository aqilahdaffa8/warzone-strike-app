export type WeaponType = 'sniper' | 'knife';

export interface Weapon {
  readonly type: WeaponType;
  readonly name: string;
  setActive(active: boolean): void;
  getIsActive(): boolean;
  dispose(): void;
}
