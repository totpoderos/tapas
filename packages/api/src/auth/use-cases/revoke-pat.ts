import type { HostPatRepository } from '../../db/host-pat-repository.js';
import type { RevokePatResult } from './pat-shared.js';

export interface RevokePatDeps {
  readonly pats: HostPatRepository;
}

/** Revokes a host's own personal access token. Ownership check (A01): a host may only revoke its own. */
export class RevokePat {
  constructor(private readonly deps: RevokePatDeps) {}

  execute(patId: string, hostId: string): RevokePatResult {
    const pat = this.deps.pats.findById(patId);
    if (!pat) return { ok: false, error: { code: 'PAT_NOT_FOUND', message: 'No such token.' } };
    if (pat.hostId !== hostId)
      return { ok: false, error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };

    this.deps.pats.revoke(patId);
    return { ok: true };
  }
}
