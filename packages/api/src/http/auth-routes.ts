import type { FastifyInstance } from 'fastify';
import type { RegisterErrorCode } from '../auth/use-cases/shared.js';
import type { ServerDeps } from './server-deps.js';
import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './session-cookies.js';

interface Credentials {
  readonly email: string;
  readonly password: string;
}

const REGISTER_ERROR_STATUS: Record<RegisterErrorCode, number> = {
  INVALID_EMAIL: 400,
  WEAK_PASSWORD: 400,
  EMAIL_TAKEN: 409,
};

export function registerAuthRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.post<{ Body: Credentials }>('/auth/register', async (request, reply) => {
    const { email, password } = request.body;
    const registration = await deps.registerHost.execute(email, password);
    if (!registration.ok) {
      return reply.code(REGISTER_ERROR_STATUS[registration.error.code]).send({ error: registration.error });
    }
    return reply.code(201).send({ hostId: registration.hostId });
  });

  app.post<{ Body: Credentials }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    const loginOutcome = await deps.authenticateHost.execute(email, password);
    if (!loginOutcome.ok) {
      const status = loginOutcome.error.code === 'ACCOUNT_LOCKED' ? 423 : 401;
      return reply.code(status).send({ error: loginOutcome.error });
    }
    setSessionCookies(reply, loginOutcome.session, deps.cookies);
    return reply.code(200).send({ hostId: loginOutcome.hostId, role: loginOutcome.role });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE];
    const refreshOutcome = refreshToken ? deps.refreshSession.execute(refreshToken) : undefined;
    if (!refreshOutcome || !refreshOutcome.ok) {
      clearSessionCookies(reply);
      return reply.code(401).send({ error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } });
    }
    setSessionCookies(reply, refreshOutcome.session, deps.cookies);
    return reply.code(200).send({ hostId: refreshOutcome.hostId, role: refreshOutcome.role });
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE] ?? request.cookies[ACCESS_COOKIE];
    deps.signOutHost.execute(token);
    clearSessionCookies(reply);
    return reply.code(200).send({});
  });
}
