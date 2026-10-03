export interface PlayerIdentity {
  playerId: string;
  nickname: string;
}

export interface PlayerIdentityProvider {
  getIdentity(): PlayerIdentity;
}
