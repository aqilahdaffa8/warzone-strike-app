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

export interface AmmoState {
  inMag: number;
  reserve: number;
  maxMag: number;
}

export interface Weapon {
  readonly type: WeaponType;
  readonly name: string;
  setActive(active: boolean): void;
  getIsActive(): boolean;
  reload?(): boolean;
  cancelReload?(): void;
  getIsReloading?(): boolean;
  getReloadProgress?(): number;
  getAmmo?(): AmmoState;
  dispose(): void;
}

export interface ReloadableWeapon extends Weapon {
  reload(): boolean;
  cancelReload(): void;
  getIsReloading(): boolean;
  getReloadProgress(): number;
  getAmmo(): AmmoState;
  addReserveAmmo(amount: number): void;
  upgradeMagazineCapacity(amount: number): void;
}

export interface WeaponReloadOptions {
  magazineCapacity: number;
  reserveAmmo: number;
  reloadDuration: number;
  maxReserveAmmo?: number;
}

/**
 * Reusable core weapon reload controller.
 * Handles reload timing, magazine replenishment, ammo tracking, and upgrade scaling.
 */
export class WeaponReloadLogic {
  private ammoInMag: number;
  private reserveAmmo: number;
  private currentMagCapacity: number;
  private baseReloadDuration: number;
  private reloadSpeedMultiplier: number = 1.0;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;
  private maxReserveAmmo: number;

  constructor(options: WeaponReloadOptions) {
    this.currentMagCapacity = Math.max(1, options.magazineCapacity);
    this.ammoInMag = this.currentMagCapacity;
    this.reserveAmmo = Math.max(0, options.reserveAmmo);
    this.baseReloadDuration = Math.max(0.01, options.reloadDuration);
    this.maxReserveAmmo = options.maxReserveAmmo ?? 300;
  }

  public getAmmo(): AmmoState {
    return {
      inMag: this.ammoInMag,
      reserve: this.reserveAmmo,
      maxMag: this.currentMagCapacity,
    };
  }

  public getAmmoInMag(): number {
    return this.ammoInMag;
  }

  public getReserveAmmo(): number {
    return this.reserveAmmo;
  }

  public getMagazineCapacity(): number {
    return this.currentMagCapacity;
  }

  public getIsReloading(): boolean {
    return this.isReloading;
  }

  public getReloadDuration(): number {
    return this.baseReloadDuration / this.reloadSpeedMultiplier;
  }

  public getReloadProgress(): number {
    const duration = this.getReloadDuration();
    if (!this.isReloading || duration <= 0) return 0;
    return Math.min(1.0, Math.max(0, 1.0 - this.reloadTimer / duration));
  }

  public setReloadSpeedMultiplier(multiplier: number): void {
    this.reloadSpeedMultiplier = Math.max(0.1, multiplier);
  }

  public getReloadSpeedMultiplier(): number {
    return this.reloadSpeedMultiplier;
  }

  /**
   * Attempts to begin a reload sequence.
   * Returns true if reload was initiated, false if conditions not met
   * (e.g. already reloading, full mag, empty reserve, or inactive).
   */
  public startReload(isActive: boolean = true): boolean {
    if (!isActive) return false;
    if (this.isReloading) return false;
    if (this.ammoInMag >= this.currentMagCapacity) return false;
    if (this.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadTimer = this.getReloadDuration();
    return true;
  }

  /**
   * Cancels any active reload sequence without replenishing magazine.
   */
  public cancelReload(): void {
    if (this.isReloading) {
      this.isReloading = false;
      this.reloadTimer = 0;
    }
  }

  /**
   * Advances the reload timer by delta time dt.
   * When timer expires, moves required ammo from reserve to magazine.
   * Returns true on the exact frame reload completed, false otherwise.
   */
  public update(dt: number): boolean {
    if (!this.isReloading) return false;

    this.reloadTimer -= dt;
    if (this.reloadTimer <= 0) {
      this.isReloading = false;
      this.reloadTimer = 0;
      const needed = this.currentMagCapacity - this.ammoInMag;
      const toLoad = Math.min(needed, this.reserveAmmo);
      this.ammoInMag += toLoad;
      this.reserveAmmo -= toLoad;
      return true;
    }

    return false;
  }

  /**
   * Deducts a given amount of ammo from current magazine.
   * Returns true if successful, false if insufficient ammo in magazine.
   */
  public consumeAmmo(amount: number = 1): boolean {
    if (this.ammoInMag >= amount) {
      this.ammoInMag -= amount;
      return true;
    }
    return false;
  }

  /**
   * Adds ammo to reserve stockpile up to maxReserveAmmo cap.
   */
  public addReserveAmmo(amount: number): void {
    if (amount <= 0) return;
    this.reserveAmmo = Math.min(this.maxReserveAmmo, this.reserveAmmo + amount);
  }

  /**
   * Increases magazine capacity and immediately replenishes loaded rounds.
   */
  public upgradeMagazineCapacity(amount: number): void {
    if (amount <= 0) return;
    this.currentMagCapacity += amount;
    this.ammoInMag = Math.min(this.ammoInMag + amount, this.currentMagCapacity);
  }

  /**
   * Resets magazine and reserve ammo back to specified or default values.
   */
  public resetAmmo(capacity?: number, reserve?: number): void {
    if (capacity !== undefined) this.currentMagCapacity = Math.max(1, capacity);
    if (reserve !== undefined) this.reserveAmmo = Math.max(0, reserve);
    this.ammoInMag = this.currentMagCapacity;
    this.isReloading = false;
    this.reloadTimer = 0;
  }
}
