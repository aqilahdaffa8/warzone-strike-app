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
  }

  public heal(amount: number): void {
    if (amount <= 0 || this.isDead()) return;

    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.notify();
  }

  public reset(): void {
    this.currentHp = this.maxHp;
    this.notify();
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
