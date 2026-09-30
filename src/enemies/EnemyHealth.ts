export type EnemyHealthChangeCallback = (currentHp: number, maxHp: number) => void;

/**
 * Manages individual enemy health state, damage calculation, and death events.
 */
export class EnemyHealth {
  private currentHp: number;
  private readonly maxHp: number;
  private readonly listeners: Set<EnemyHealthChangeCallback> = new Set();

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

  public takeDamage(amount: number): { actualDamage: number; remainingHp: number; isKilled: boolean } {
    if (amount <= 0 || this.isDead()) {
      return { actualDamage: 0, remainingHp: this.currentHp, isKilled: this.isDead() };
    }

    const actualDamage = Math.min(this.currentHp, amount);
    this.currentHp = Math.max(0, this.currentHp - actualDamage);
    const isKilled = this.currentHp <= 0;

    this.notify();

    return {
      actualDamage,
      remainingHp: this.currentHp,
      isKilled,
    };
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

  public onHealthChange(callback: EnemyHealthChangeCallback): () => void {
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
