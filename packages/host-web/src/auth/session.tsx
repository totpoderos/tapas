import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  hasSession,
  register as apiRegister,
  signIn as apiSignIn,
  signOut as apiSignOut,
} from '../api/client';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface Session {
  readonly status: SessionStatus;
  /** Signs in; throws ApiError on bad credentials, leaving the session anonymous. */
  signIn(email: string, password: string): Promise<void>;
  /** Creates an account and signs in; throws ApiError (e.g. email taken, weak password). */
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<Session | undefined>(undefined);

/**
 * Holds who is signed in. On mount it asks the API whether the cookie still
 * names a valid host — that is what keeps the host signed in across a reload
 * without ever putting a token in JavaScript.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let live = true;
    hasSession()
      .then((ok) => live && setStatus(ok ? 'authenticated' : 'anonymous'))
      .catch(() => live && setStatus('anonymous'));
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await apiSignIn(email, password);
    setStatus('authenticated');
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await apiRegister(email, password);
    // Registration does not open a session, so sign in straight after.
    await apiSignIn(email, password);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setStatus('anonymous');
  }, []);

  return (
    <SessionContext.Provider value={{ status, signIn, signUp, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used within a SessionProvider');
  return session;
}
