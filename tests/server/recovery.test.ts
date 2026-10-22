import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { recoverIndustrial } from '../../tools/recover-industrial.js';
import { createPool } from '../../src/server/config.js';

vi.mock('node:fs/promises', async () => ({ ...await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'), readFile: vi.fn() }));
vi.mock('../../src/server/config.js', () => ({ createPool: vi.fn(async () => { throw new Error('Unexpected DB access'); }) }));
const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const mockedRead = vi.mocked(readFile);
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
describe('public recovery validates the complete import before database access', () => {
  it('checks all four pinned inputs without a database', async () => {
    mockedRead.mockImplementation(actual.readFile);
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await recoverIndustrial(['--check'], {});
    expect(createPool).not.toHaveBeenCalled();
    expect(mockedRead).toHaveBeenCalledTimes(4);
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({ status: 'validated_without_database', counts: { order_lines: 10000, depots: 6 } });
  });
  for (const suffix of ['portfolio-10000.json', 'industrial-context.v2.json', 'display-aliases.v1.json']) {
    it(`refuses changed ${suffix} before any database connection`, async () => {
      mockedRead.mockImplementation(async (...args: Parameters<typeof readFile>) => String(args[0]).endsWith(suffix) ? Buffer.from('{}') : await actual.readFile(...args));
      await expect(recoverIndustrial(['--init'], { DATABASE_SCHEMA: 'physical_recovery_test' })).rejects.toThrow('Frozen input changed');
      expect(createPool).not.toHaveBeenCalled();
    });
  }
  it('rejects ambiguous arguments before reading inputs', async () => {
    await expect(recoverIndustrial(['--init', '--check'], {})).rejects.toThrow();
    expect(mockedRead).not.toHaveBeenCalled(); expect(createPool).not.toHaveBeenCalled();
  });
});
