import * as THREE from 'three';

export type HealthChangeCallback = (currentHp: number, maxHp: number) => void;
export type DamageTakenCallback = (amount: number, sourcePos?: THREE.Vector3) => void;

/**
 * Manages player health state, damage calculation, and change events.
 */
export class PlayerHealth {
  private currentHp: number;
  private maxHp: number;
  private readonly baseMaxHp: number;
  private readonly listeners: Set<HealthChangeCallback> = new Set();
  private readonly damageListeners: Set<DamageTakenCallback> = new Set();

  constructor(maxHp: number = 100) {
    this.maxHp = Math.max(1, maxHp);
    this.baseMaxHp = this.maxHp;
    this.currentHp = this.maxHp;
  }

  private hasFiredDeath: boolean = false;
  private readonly deathListeners: Set<() => void> = new Set();

  public getHp(): number {
    return this.currentHp;
  }

  public getMaxHp(): number {
    return this.maxHp;
  }

  public isDead(): boolean {
    return this.currentHp <= 0;
  }

  public takeDamage(amount: number, sourcePos?: THREE.Vector3): void {
    if (amount <= 0 || this.isDead()) return;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.notify();

    for (const listener of this.damageListeners) {
      try {
        listener(amount, sourcePos);
      } catch (err) {
        console.error('Error in PlayerHealth damage listener:', err);
      }
    }

    if (this.currentHp === 0 && !this.hasFiredDeath) {
      this.hasFiredDeath = true;
      for (const listener of this.deathListeners) {
        try {
          listener();
        } catch (err) {
          console.error('Error in PlayerHealth death listener:', err);
        }
      }
    }
  }

  public onDamageTaken(callback: DamageTakenCallback): () => void {
    this.damageListeners.add(callback);
    return () => {
      this.damageListeners.delete(callback);
    };
  }

  public heal(amount: number): void {
    if (amount <= 0 || this.isDead()) return;

    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.notify();
  }

  /** Permanently raises max HP (supply upgrade) and grants the same amount of current HP. */
  public increaseMaxHp(amount: number): void {
    if (amount <= 0 || this.isDead()) return;
    this.maxHp += amount;
    this.currentHp += amount;
    this.notify();
  }

  /** Restores the original max HP (new run). Call before reset(). */
  public resetMaxHp(): void {
    this.maxHp = this.baseMaxHp;
    this.currentHp = Math.min(this.currentHp, this.maxHp);
  }

  public reset(): void {
    this.currentHp = this.maxHp;
    this.hasFiredDeath = false;
    this.notify();
  }

  public onDeath(callback: () => void): () => void {
    this.deathListeners.add(callback);
    return () => {
      this.deathListeners.delete(callback);
    };
  }

  public onHealthChange(callback: HealthChangeCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentHp, this.maxHp);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentHp, this.maxHp);
    }
  }
}
