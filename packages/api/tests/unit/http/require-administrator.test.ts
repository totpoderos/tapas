import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HostAccount } from '@tapas/domain';
import { requireAdministrator } from '../../../src/http/require-administrator.js';
import type { HostAccountRepository } from '../../../src/db/host-account-repository.js';
import type { SecurityEventInput, SecurityEventLog } from '../../../src/security/security-event.js';
import type { HostSession } from '../../../src/http/require-host-session.js';

class FakeHostAccounts implements HostAccountRepository {
  private readonly byId = new Map<string, HostAccount>();
  constructor(...accounts: HostAccount[]) {
    for (const account of accounts) this.byId.set(account.id, account);
  }
  insert(): void {}
  update(): void {}
  findByEmail(): undefined {
    return undefined;
  }
  findById(id: string): HostAccount | undefined {
    return this.byId.get(id);
  }
  listAll(): HostAccount[] {
    return [...this.byId.values()];
  }
}

class RecordingSecurityLog implements SecurityEventLog {
  readonly recorded: SecurityEventInput[] = [];
  record(event: SecurityEventInput): void {
    this.recorded.push(event);
  }
  list(): never[] {
    return [];
  }
}

function administrator(id: string): HostAccount {
  return HostAccount.rehydrate(id, `${id}@example.com`, 'hash', 'admin', 0, null);
}

function ordinaryHost(id: string): HostAccount {
  return HostAccount.rehydrate(id, `${id}@example.com`, 'hash', 'host', 0, null);
}

function makeReply(): { reply: FastifyReply; status: () => number | undefined } {
  let status: number | undefined;
  const stub = {
    code(next: number) {
      status = next;
      return stub;
    },
    async send() {
      return stub;
    },
  };
  return { reply: stub as unknown as FastifyReply, status: () => status };
}

function makeRequest(hostSession?: HostSession): FastifyRequest {
  return { hostSession, ip: '127.0.0.1' } as unknown as FastifyRequest;
}

describe('requireAdministrator', () => {
  it('lets an administrator on a cookie session through', async () => {
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(administrator('host-1')),
      securityLog: new RecordingSecurityLog(),
    });
    const { reply, status } = makeReply();

    await step(makeRequest({ id: 'host-1', authenticatedBy: 'session' }), reply);

    expect(status()).toBeUndefined();
  });

  it('refuses an ordinary host as not allowed', async () => {
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(ordinaryHost('host-2')),
      securityLog: new RecordingSecurityLog(),
    });
    const { reply, status } = makeReply();

    await step(makeRequest({ id: 'host-2', authenticatedBy: 'session' }), reply);

    expect(status()).toBe(403);
  });

  it('refuses an administrator arriving by personal access token', async () => {
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(administrator('host-1')),
      securityLog: new RecordingSecurityLog(),
    });
    const { reply, status } = makeReply();

    await step(makeRequest({ id: 'host-1', authenticatedBy: 'personal-access-token' }), reply);

    expect(status()).toBe(403);
  });

  it('reads the role from the account store, not from the session', async () => {
    // The account is no longer an administrator; a stale session claiming
    // otherwise must not get through, because refreshing a session carries the
    // old role forward indefinitely.
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(ordinaryHost('host-1')),
      securityLog: new RecordingSecurityLog(),
    });
    const { reply, status } = makeReply();

    await step(makeRequest({ id: 'host-1', authenticatedBy: 'session' }), reply);

    expect(status()).toBe(403);
  });

  it('refuses as not signed in when no session reached it', async () => {
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(),
      securityLog: new RecordingSecurityLog(),
    });
    const { reply, status } = makeReply();

    await step(makeRequest(undefined), reply);

    expect(status()).toBe(401);
  });

  it('records a refused administrative attempt, with the actor and source', async () => {
    const securityLog = new RecordingSecurityLog();
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(ordinaryHost('host-2')),
      securityLog,
    });

    await step(makeRequest({ id: 'host-2', authenticatedBy: 'session' }), makeReply().reply);

    expect(securityLog.recorded).toEqual([
      { type: 'admin_access.refused', actorId: 'host-2', sourceIp: '127.0.0.1' },
    ]);
  });

  it('records nothing when the administrator is allowed through', async () => {
    const securityLog = new RecordingSecurityLog();
    const step = requireAdministrator({
      hostAccounts: new FakeHostAccounts(administrator('host-1')),
      securityLog,
    });

    await step(makeRequest({ id: 'host-1', authenticatedBy: 'session' }), makeReply().reply);

    expect(securityLog.recorded).toEqual([]);
  });
});
