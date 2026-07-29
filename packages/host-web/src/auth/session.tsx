import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  acceptInvitation as apiAcceptInvitation,
  isDeploymentUnclaimed,
  whoAmI,
  register as apiRegister,
  signIn as apiSignIn,
  signOut as apiSignOut,
} from '../api/client';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface Session {
  readonly status: SessionStatus;
  /**
   * Whether the signed-in person is an administrator. For deciding what to
   * draw, and nothing else — the server reads the account store when it
   * matters, because a refresh carries the previous token's claim forward and a
   * claim-derived role would outlive a demotion. A screen may therefore be
   * briefly wrong after one; the authority never is.
   */
  readonly isAdministrator: boolean;
  /**
   * Whether this deployment still has no administrator. Asked only when nobody
   * is signed in — it changes where an anonymous visitor goes and nothing else,
   * so a signed-in host never pays for the answer.
   */
  readonly deploymentUnclaimed: boolean;
  /** Signs in; throws ApiError on bad credentials, leaving the session anonymous. */
  signIn(email: string, password: string): Promise<void>;
  /** Creates an account and signs in; throws ApiError (e.g. email taken, weak password). */
  signUp(email: string, password: string): Promise<void>;
  /**
   * Turns an invitation into an account and signs in. Throws ApiError if
   * accepting is refused; returns `'account-ready'` when the account was made
   * but the sign-in that follows was not allowed — a distinction only this
   * function can see, and one the screen has to make, since by then the link is
   * spent and "try again" would send somebody back to a dead one.
   */
  acceptInvitation(
    token: string,
    password: string,
    email: string,
  ): Promise<'signed-in' | 'account-ready'>;
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
  const [deploymentUnclaimed, setDeploymentUnclaimed] = useState(false);
  const [isAdministrator, setIsAdministrator] = useState(false);

  useEffect(() => {
    let live = true;
    whoAmI()
      .then(async (me) => {
        if (!live) return;
        if (me) {
          setIsAdministrator(me.role === 'admin');
          setStatus('authenticated');
          return;
        }
        // Only an anonymous visitor is sent anywhere by the answer, so only an
        // anonymous visitor asks — and it rides the moment the app already
        // waits on rather than adding one of its own.
        const unclaimed = await isDeploymentUnclaimed().catch(() => false);
        if (!live) return;
        setDeploymentUnclaimed(unclaimed);
        setStatus('anonymous');
      })
      .catch(() => live && setStatus('anonymous'));
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await apiSignIn(email, password);
    setIsAdministrator((await whoAmI())?.role === 'admin');
    setStatus('authenticated');
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await apiRegister(email, password);
    // Registration does not open a session, so sign in straight after.
    await apiSignIn(email, password);
    setStatus('authenticated');
  }, []);

  const acceptInvitation = useCallback(
    // The address comes from the caller because the screen already read it to
    // render itself — asking again would be a second chance to fail for no gain.
    async (
      token: string,
      password: string,
      email: string,
    ): Promise<'signed-in' | 'account-ready'> => {
      await apiAcceptInvitation(token, password);
      try {
        await apiSignIn(email, password);
      } catch {
        // The account exists; only the second leg failed. Saying so is the
        // screen's job, and this is the only place both outcomes are visible.
        return 'account-ready';
      }
      setStatus('authenticated');
      return 'signed-in';
    },
    [],
  );

  const signOut = useCallback(async () => {
    await apiSignOut();
    setIsAdministrator(false);
    setStatus('anonymous');
  }, []);

  return (
    <SessionContext.Provider value={{ status, deploymentUnclaimed, isAdministrator, signIn, signUp, acceptInvitation, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used within a SessionProvider');
  return session;
}
