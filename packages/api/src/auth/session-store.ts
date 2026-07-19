export interface SessionStore {
  activate(jti: string, hostId: string, expiresAt: string): void;
  revoke(jti: string): void;
  isActive(jti: string): boolean;
}
