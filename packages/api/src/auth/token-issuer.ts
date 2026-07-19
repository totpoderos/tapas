import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Clock } from '../audit/audit-projection.js';

export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** The session id shared by both tokens — what a `SessionStore` tracks. */
  readonly sessionId: string;
}

export interface TokenClaims {
  readonly sub: string;
  readonly role: string;
}

export interface VerifiedClaims extends TokenClaims {
  readonly typ: 'access' | 'refresh';
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
}

export interface TokenIssuer {
  issue(claims: TokenClaims): Session;
  verify(token: string): VerifiedClaims | null;
}

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Signs and verifies JSON Web Tokens by hand (HS256) with node:crypto — the
 * "tokens a mano" approach from the security curriculum. No JWT dependency.
 */
export class HmacJwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly secret: string,
    private readonly clock: Clock,
  ) {}

  issue(claims: TokenClaims): Session {
    const nowSeconds = Math.floor(Date.parse(this.clock.now()) / 1000);
    const jti = randomUUID();
    return {
      accessToken: this.sign({
        ...claims,
        typ: 'access',
        iat: nowSeconds,
        exp: nowSeconds + ACCESS_TTL_SECONDS,
        jti,
      }),
      refreshToken: this.sign({
        ...claims,
        typ: 'refresh',
        iat: nowSeconds,
        exp: nowSeconds + REFRESH_TTL_SECONDS,
        jti,
      }),
      sessionId: jti,
    };
  }

  verify(token: string): VerifiedClaims | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    if (!header || !payload || !signature) return null;

    const expected = this.signature(`${header}.${payload}`);
    const given = Buffer.from(signature);
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as VerifiedClaims;
    const nowSeconds = Math.floor(Date.parse(this.clock.now()) / 1000);
    if (claims.exp < nowSeconds) return null;
    return claims;
  }

  private sign(payload: object): string {
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode(payload);
    return `${header}.${body}.${this.signature(`${header}.${body}`)}`;
  }

  private signature(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }
}
