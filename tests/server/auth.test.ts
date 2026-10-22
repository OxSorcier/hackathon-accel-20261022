import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { resolveLoginActor, checkOrigin } from '../../src/server/auth.js';
describe('server authority', () => {
  it('resolves role from trusted configuration and rejects guessed credentials', () => {
    const config = { demoToken: randomBytes(32).toString('hex'), operatorToken: randomBytes(32).toString('hex'), companyId: 'CO-DEMO' };
    expect(resolveLoginActor('EMP-PAUL', config)).toBeNull();
    expect(resolveLoginActor(config.demoToken, config)?.role).toBe('direction');
    expect(resolveLoginActor(config.operatorToken, config)?.role).toBe('operator');
  });
  it('refuses a cross-origin mutation and a missing origin', () => {
    expect(checkOrigin('https://evil.example', 'http://127.0.0.1:3000')).toBe(false);
    expect(checkOrigin(undefined, 'http://127.0.0.1:3000')).toBe(false);
    expect(checkOrigin('http://127.0.0.1:3000', 'http://127.0.0.1:3000')).toBe(true);
  });
});
