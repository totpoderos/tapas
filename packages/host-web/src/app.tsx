import { useEffect, useState } from 'react';
import { Button } from '@tapas/ui';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * Host/admin app skeleton. Proves the frontend can reach the API (Phase 0
 * done-when). Real host flows — contest forms, chat panel, tally, reveal —
 * land in Phase 5B.
 */
export function App() {
  const [status, setStatus] = useState('checking…');

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => res.json())
      .then((body: { status: string }) => setStatus(body.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <main>
      <h1>Tapas — Host</h1>
      <p>
        API status: <strong>{status}</strong>
      </p>
      <Button onClick={() => window.location.reload()}>Refresh</Button>
    </main>
  );
}
