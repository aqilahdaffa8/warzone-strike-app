import { PlayerIdentity, PlayerIdentityProvider } from './PlayerIdentityProvider';

export class MockPlayerIdentityProvider implements PlayerIdentityProvider {
  private readonly identity: PlayerIdentity;

  constructor(identity: PlayerIdentity = { playerId: 'MOCK-PLAYER-001', nickname: 'Soldier' }) {
    this.identity = identity;
  }

  public getIdentity(): PlayerIdentity {
    return this.identity;
  }
}
