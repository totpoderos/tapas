import type { FastifyInstance } from 'fastify';
import type { RevokePatErrorCode } from '../auth/use-cases/pat-shared.js';
import { SENSITIVE_RATE_LIMIT } from './rate-limit.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  REFRESH_COOKIE,
  setSessionCookies,
} from './session-cookies.js';

interface Credentials {
  readonly email: string;
  readonly password: string;
}

const REVOKE_PAT_ERROR_STATUS: Record<RevokePatErrorCode, number> = {
  PAT_NOT_FOUND: 404,
  NOT_ALLOWED: 403,
};

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };

export function registerAuthRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.post<{ Body: Credentials }>(
    '/auth/login',
    { config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => {
      const { email, password } = request.body;
      const loginOutcome = await deps.authenticateHost.execute(email, password);
      if (!loginOutcome.ok) {
        deps.securityLog.record({
          type: 'sign_in.refused',
          actorId: loginOutcome.hostId,
          sourceIp: request.ip,
          reason: loginOutcome.logReason,
        });
        const status = loginOutcome.error.code === 'ACCOUNT_LOCKED' ? 423 : 401;
        return reply.code(status).send({ error: loginOutcome.error });
      }
      deps.securityLog.record({
        type: 'sign_in.succeeded',
        actorId: loginOutcome.hostId,
        sourceIp: request.ip,
      });
      setSessionCookies(reply, loginOutcome.session, deps.cookieTransport);
      return reply.code(200).send({ hostId: loginOutcome.hostId, role: loginOutcome.role });
    },
  );

  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE];
    const refreshOutcome = refreshToken ? deps.refreshSession.execute(refreshToken) : undefined;
    if (!refreshOutcome || !refreshOutcome.ok) {
      clearSessionCookies(reply);
      return reply
        .code(401)
        .send({ error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } });
    }
    setSessionCookies(reply, refreshOutcome.session, deps.cookieTransport);
    return reply.code(200).send({ hostId: refreshOutcome.hostId, role: refreshOutcome.role });
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE] ?? request.cookies[ACCESS_COOKIE];
    deps.signOutHost.execute(token);
    clearSessionCookies(reply);
    return reply.code(200).send({});
  });

  const requireSession = requireHostSession(deps);

  /**
   * Who the caller is, and what. The app needs the role to decide what to draw —
   * whether to offer an administrator the way to the people — and there is no
   * other way to learn it after a reload, when there was no sign-in to carry it.
   *
   * Deliberately its own read rather than letting the app discover its role by
   * requesting something administrative and reading the refusal: that would
   * record `admin_access.refused` for every ordinary host on every page load,
   * and bury the one entry that means somebody reached for something.
   *
   * The role reported here is for rendering only. Nothing on the server trusts
   * it — `requireAdministrator` reads the account store, because a refresh
   * carries the previous token's claim forward and a claim-derived role would
   * outlive a demotion.
   */
  app.get('/auth/me', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);

    const account = deps.hostAccounts.findById(request.hostSession.id);
    if (!account) return reply.code(401).send(notSignedIn);
    return reply.code(200).send({ hostId: account.id, role: account.role });
  });

  app.post('/auth/pats', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);

    const issued = deps.issuePat.execute(request.hostSession.id);
    // Record only that a token was issued — never the token itself.
    deps.securityLog.record({
      type: 'pat.issued',
      actorId: request.hostSession.id,
      sourceIp: request.ip,
    });
    return reply.code(201).send({ id: issued.patId, token: issued.token });
  });

  app.delete<{ Params: { id: string } }>(
    '/auth/pats/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      const revoked = deps.revokePat.execute(request.params.id, request.hostSession.id);
      if (!revoked.ok)
        return reply
          .code(REVOKE_PAT_ERROR_STATUS[revoked.error.code])
          .send({ error: revoked.error });
      return reply.code(200).send({});
    },
  );
}
