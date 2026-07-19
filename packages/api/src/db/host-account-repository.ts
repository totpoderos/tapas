import type { DatabaseSync } from 'node:sqlite';
import { HostAccount, type HostRole } from '@tapas/domain';

export interface HostAccountRepository {
  insert(account: HostAccount): void;
  findByEmail(email: string): HostAccount | undefined;
  update(account: HostAccount): void;
}

interface HostAccountRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  failed_attempts: number;
  locked_until: string | null;
}

function toAccount(row: HostAccountRow): HostAccount {
  return HostAccount.rehydrate(
    row.id,
    row.email,
    row.password_hash,
    row.role as HostRole,
    row.failed_attempts,
    row.locked_until,
  );
}

export class SqliteHostAccountRepository implements HostAccountRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(account: HostAccount): void {
    this.db
      .prepare(
        `INSERT INTO host_accounts (id, email, password_hash, role, failed_attempts, locked_until, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        account.id,
        account.email,
        account.passwordHash,
        account.role,
        account.failedAttempts,
        account.lockedUntil,
        new Date().toISOString(),
      );
  }

  update(account: HostAccount): void {
    this.db
      .prepare(`UPDATE host_accounts SET failed_attempts = ?, locked_until = ? WHERE id = ?`)
      .run(account.failedAttempts, account.lockedUntil, account.id);
  }

  findByEmail(email: string): HostAccount | undefined {
    const row = this.db.prepare(`SELECT * FROM host_accounts WHERE email = ?`).get(email) as unknown as
      | HostAccountRow
      | undefined;
    return row ? toAccount(row) : undefined;
  }
}
