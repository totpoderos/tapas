import { describe, expect, it } from 'vitest';
import { HostAccount } from '../../../src/index.js';

const NOW = '2026-07-19T10:00:00.000Z';
const AFTER_LOCK_WINDOW = '2026-07-19T10:20:00.000Z'; // 20 min later (> 15)

function failNTimes(account: HostAccount, times: number): HostAccount {
  let current = account;
  for (let attempt = 0; attempt < times; attempt++) current = current.withFailedLogin(NOW);
  return current;
}

describe('HostAccount', () => {
  it('starts unlocked with no failed attempts', () => {
    const account = HostAccount.register('host-1', 'ana@example.com', 'hash');
    expect(account.failedAttempts).toBe(0);
    expect(account.isLocked(NOW)).toBe(false);
  });

  it('stays unlocked before the 5th failure', () => {
    const account = failNTimes(HostAccount.register('host-1', 'ana@example.com', 'hash'), 4);
    expect(account.isLocked(NOW)).toBe(false);
  });

  it('locks after 5 failed logins', () => {
    const account = failNTimes(HostAccount.register('host-1', 'ana@example.com', 'hash'), 5);
    expect(account.failedAttempts).toBe(5);
    expect(account.isLocked(NOW)).toBe(true);
  });

  it('unlocks once the lock window passes', () => {
    const account = failNTimes(HostAccount.register('host-1', 'ana@example.com', 'hash'), 5);
    expect(account.isLocked(AFTER_LOCK_WINDOW)).toBe(false);
  });

  it('resets attempts and lock on a successful login', () => {
    const account = failNTimes(HostAccount.register('host-1', 'ana@example.com', 'hash'), 5).withSuccessfulLogin();
    expect(account.failedAttempts).toBe(0);
    expect(account.lockedUntil).toBeNull();
  });

  it('does not mutate the original on a failed login', () => {
    const account = HostAccount.register('host-1', 'ana@example.com', 'hash');
    account.withFailedLogin(NOW);
    expect(account.failedAttempts).toBe(0);
  });
});
