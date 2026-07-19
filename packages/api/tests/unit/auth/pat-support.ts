import type { HostPatRepository, StoredHostPat } from '../../../src/index.js';

export class FakeHostPatRepository implements HostPatRepository {
  private readonly store = new Map<string, StoredHostPat>();
  insert(pat: StoredHostPat): void {
    this.store.set(pat.id, pat);
  }
  findById(id: string): StoredHostPat | undefined {
    return this.store.get(id);
  }
  findByTokenHash(tokenHash: string): StoredHostPat | undefined {
    return [...this.store.values()].find((pat) => pat.tokenHash === tokenHash);
  }
  revoke(id: string): void {
    const pat = this.store.get(id);
    if (pat) this.store.set(id, { ...pat, revokedAt: new Date().toISOString() });
  }
}
