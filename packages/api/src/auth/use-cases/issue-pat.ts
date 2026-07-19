import type { Clock, IdGenerator } from '../../audit/audit-projection.js';
import type { HostPatRepository } from '../../db/host-pat-repository.js';
import { generatePatToken, hashPatToken } from '../pat-hasher.js';
import type { IssuePatResult } from './pat-shared.js';

export interface IssuePatDeps {
  readonly pats: HostPatRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Issues a host a personal access token for external clients (e.g. the MCP server) — shown once. */
export class IssuePat {
  constructor(private readonly deps: IssuePatDeps) {}

  execute(hostId: string): IssuePatResult {
    const token = generatePatToken();
    const pat = {
      id: this.deps.ids.next(),
      hostId,
      tokenHash: hashPatToken(token),
      createdAt: this.deps.clock.now(),
      revokedAt: null,
    };
    this.deps.pats.insert(pat);
    return { patId: pat.id, token };
  }
}
