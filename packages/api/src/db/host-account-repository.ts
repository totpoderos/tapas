import type { Database } from './database.js';
import { HostAccount, type HostRole } from '@tapas/domain';

export interface HostAccountRepository {
  insert(account: HostAccount): Promise<void>;
  findByEmail(email: string): Promise<HostAccount | undefined>;
  findById(id: string): Promise<HostAccount | undefined>;
  listAll(): Promise<HostAccount[]>;
  update(account: HostAccount): Promise<void>;
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
  constructor(private readonly db: Database) {}

  async insert(account: HostAccount): Promise<void> {
    await this.db
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

  async update(account: HostAccount): Promise<void> {
    await this.db
      .prepare(`UPDATE host_accounts SET failed_attempts = ?, locked_until = ? WHERE id = ?`)
      .run(account.failedAttempts, account.lockedUntil, account.id);
  }

  async findByEmail(email: string): Promise<HostAccount | undefined> {
    const row = await this.db.prepare(`SELECT * FROM host_accounts WHERE email = ?`).get(email) as unknown as
      | HostAccountRow
      | undefined;
    return row ? toAccount(row) : undefined;
  }

  async findById(id: string): Promise<HostAccount | undefined> {
    const row = await this.db.prepare(`SELECT * FROM host_accounts WHERE id = ?`).get(id) as unknown as
      | HostAccountRow
      | undefined;
    return row ? toAccount(row) : undefined;
  }

  async listAll(): Promise<HostAccount[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM host_accounts ORDER BY created_at`)
      .all() as unknown as HostAccountRow[];
    return rows.map(toAccount);
  }
}
