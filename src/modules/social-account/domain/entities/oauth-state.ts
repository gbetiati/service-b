import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 600_000;

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

// O state viaja pelo provedor OAuth e o nonce fica em um cookie do navegador. Somente o hash dos dois é persistido.
export class OAuthState {
  private constructor(
    readonly state: string,
    readonly nonce: string,
  ) {}

  static generate () {
    return new OAuthState(randomToken(), randomToken());
  }

  static hash (state: string, nonce: string) {
    return createHash('sha256').update(state + '.' + nonce).digest('hex');
  }

  static isValidToken (value: string | undefined): value is string {
    return !!value && tokenPattern.test(value);
  }

  static expiresAt (now = Date.now()) {
    return new Date(now + OAUTH_STATE_TTL_MS);
  }

  get hash () {
    return OAuthState.hash(this.state, this.nonce);
  }
}

function randomToken () {
  return randomBytes(32).toString('base64url');
}
