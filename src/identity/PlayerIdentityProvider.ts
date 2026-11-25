export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  email?: string;
  token?: string | null;
  isGuest?: boolean;
}

export interface PlayerIdentityProvider {
  getIdentity(): PlayerIdentity;
}
