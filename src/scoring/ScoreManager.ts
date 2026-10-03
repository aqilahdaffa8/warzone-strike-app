import { ScoreConfig, DEFAULT_SCORE_CONFIG } from '../config/gameConfig';

export interface ScorePayload {
  gameId: string;
  playerId: string;
  nickname: string;
  sessionId: string;
  score: number;
  waveReached: number;
  bossesKilled: number;
  kills: number;
  headshots: number;
  accuracy: number;
  durationSeconds: number;
  timestamp: string;
}

export type ScoreChangeCallback = (currentScore: number, addedPoints: number, reason: string) => void;

export class ScoreManager {
  private readonly config: ScoreConfig;
  private sessionId: string;
  private score: number = 0;
  private kills: number = 0;
  private headshots: number = 0;
  private bossesKilled: number = 0;
  private shotsFired: number = 0;
  private shotsHit: number = 0;
  private waveReached: number = 1;
  private startTime: number = Date.now();
  private endTime: number | null = null;

  public onScoreChanged?: ScoreChangeCallback;

  constructor(config: ScoreConfig = DEFAULT_SCORE_CONFIG) {
    this.config = config;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  public reset(regenerateSessionId: boolean = true): void {
    if (regenerateSessionId) {
      this.sessionId = this.generateSessionId();
    }
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.bossesKilled = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.waveReached = 1;
    this.startTime = Date.now();
    this.endTime = null;

    if (this.onScoreChanged) {
      this.onScoreChanged(0, 0, 'RESET');
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getScore(): number {
    return this.score;
  }

  public getKills(): number {
    return this.kills;
  }

  public getHeadshots(): number {
    return this.headshots;
  }

  public getBossesKilled(): number {
    return this.bossesKilled;
  }

  public getWaveReached(): number {
    return this.waveReached;
  }

  public setWaveReached(wave: number): void {
    if (wave > this.waveReached) {
      this.waveReached = wave;
    }
  }

  public recordShot(hit: boolean, isHeadshot: boolean = false): void {
    this.shotsFired++;
    if (hit) {
      this.shotsHit++;
      if (isHeadshot) {
        this.headshots++;
      }
    }
  }

  public addRegularKill(isHeadshot: boolean = false): void {
    this.kills++;
    let added = this.config.regularKill;
    let reason = 'ENEMY KILL';

    if (isHeadshot) {
      added += this.config.headshotBonus;
      reason = 'HEADSHOT KILL';
    }

    this.score += added;
    if (this.onScoreChanged) {
      this.onScoreChanged(this.score, added, reason);
    }
  }

  public addBossKill(isHeadshot: boolean = false): void {
    this.kills++;
    this.bossesKilled++;
    let added = this.config.bossKill;
    let reason = 'BOSS DESTROYED';

    if (isHeadshot) {
      added += this.config.headshotBonus;
      reason = 'BOSS HEADSHOT KILL';
    }

    this.score += added;
    if (this.onScoreChanged) {
      this.onScoreChanged(this.score, added, reason);
    }
  }

  public addWaveClear(waveNumber: number): void {
    this.setWaveReached(waveNumber);
    const added = this.config.waveClearMultiplier * waveNumber;
    this.score += added;

    if (this.onScoreChanged) {
      this.onScoreChanged(this.score, added, `WAVE ${waveNumber} CLEARED`);
    }
  }

  public addCustomScore(points: number, reason: string): void {
    if (points <= 0) return;
    this.score += points;
    if (this.onScoreChanged) {
      this.onScoreChanged(this.score, points, reason);
    }
  }

  public finalizeSession(): void {
    if (this.endTime === null) {
      this.endTime = Date.now();
    }
  }

  public getDurationSeconds(): number {
    const end = this.endTime !== null ? this.endTime : Date.now();
    return Math.max(1, Math.floor((end - this.startTime) / 1000));
  }

  public getAccuracy(): number {
    if (this.shotsFired === 0) return 0;
    return Math.round((this.shotsHit / this.shotsFired) * 1000) / 10; // e.g. 75.5%
  }

  public generatePayload(playerId: string = 'MOCK-PLAYER-001', nickname: string = 'Soldier'): ScorePayload {
    this.finalizeSession();
    return {
      gameId: 'warzone-strike',
      playerId,
      nickname,
      sessionId: this.sessionId,
      score: this.score,
      waveReached: this.waveReached,
      bossesKilled: this.bossesKilled,
      kills: this.kills,
      headshots: this.headshots,
      accuracy: this.getAccuracy(),
      durationSeconds: this.getDurationSeconds(),
      timestamp: new Date(this.endTime || Date.now()).toISOString(),
    };
  }
}
