import type { HostPatRepository, StoredHostPat } from '../../../src/index.js';

export class FakeHostPatRepository implements HostPatRepository {
  private readonly store = new Map<string, StoredHostPat>();
  async insert(pat: StoredHostPat): Promise<void> {
    this.store.set(pat.id, pat);
  }
  async findById(id: string): Promise<StoredHostPat | undefined> {
    return this.store.get(id);
  }
  async findByTokenHash(tokenHash: string): Promise<StoredHostPat | undefined> {
    return [...this.store.values()].find((pat) => pat.tokenHash === tokenHash);
  }
  async revoke(id: string): Promise<void> {
    const pat = this.store.get(id);
    if (pat) this.store.set(id, { ...pat, revokedAt: new Date().toISOString() });
  }
}
