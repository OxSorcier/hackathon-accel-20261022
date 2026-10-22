import { createHash, timingSafeEqual } from 'node:crypto';
import type { Actor } from '../contracts/index.js';
export interface LoginConfig { demoToken: string; operatorToken: string; companyId: string }
export function hashToken(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function matches(value: string, expected: string): boolean {
  return expected.length >= 32 && timingSafeEqual(Buffer.from(hashToken(value)), Buffer.from(hashToken(expected)));
}
export function resolveLoginActor(token: string, config: LoginConfig): Actor | null {
  if (matches(token, config.operatorToken)) return { actorId: 'OPERATOR', companyId: config.companyId, role: 'operator', approvalCeilingEur: 0 };
  if (matches(token, config.demoToken)) return { actorId: 'EMP-PAUL', companyId: config.companyId, role: 'direction', approvalCeilingEur: 2000 };
  return null;
}
export function checkOrigin(origin: string | undefined, configuredOrigin: string): boolean { return origin === configuredOrigin; }
