export type HealthChangeCallback = (currentHp: number, maxHp: number) => void;

/**
 * Manages player health state, damage calculation, and change events.
 */
export class PlayerHealth {
  private currentHp: number;
  private readonly maxHp: number;
  private readonly listeners: Set<HealthChangeCallback> = new Set();

  constructor(maxHp: number = 100) {
    this.maxHp = Math.max(1, maxHp);
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

  public takeDamage(amount: number): void {
    if (amount <= 0 || this.isDead()) return;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.notify();

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

  public heal(amount: number): void {
    if (amount <= 0 || this.isDead()) return;

    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.notify();
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
