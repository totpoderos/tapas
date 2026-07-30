import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ContestsProvider } from '../../../src/contests/contests-provider';
import * as api from '../../../src/api/client';

/**
 * The shared contest list, as the authenticated tree provides it.
 *
 * A surface that changes a contest has to tell the list so — otherwise the panel
 * goes on saying a closed contest is live. That makes `useContests()` a real
 * dependency of those surfaces, and a test rendering one on its own has to stand
 * the provider up or the hook throws.
 *
 * The list itself is empty here: these tests are about the surface calling
 * `refresh()`, not about what comes back.
 */
export function WithContests({ children }: { children: ReactNode }) {
  if (vi.isMockFunction(api.listContests)) {
    vi.mocked(api.listContests).mockResolvedValue([]);
  }
  return <ContestsProvider>{children}</ContestsProvider>;
}
