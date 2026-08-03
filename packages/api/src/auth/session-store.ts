export interface SessionStore {
  activate(jti: string, hostId: string, expiresAt: string): Promise<void>;
  revoke(jti: string): Promise<void>;
  isActive(jti: string): Promise<boolean>;
}
