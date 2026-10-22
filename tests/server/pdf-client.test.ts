import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createModalPdfClient, ModalPdfError } from '../../src/server/pdf-client.js';

const endpoint = 'https://oxsorcier--accel-pdf-reader-extract-document.us-east.modal.run';
const bytes = new TextEncoder().encode('%PDF-1.7\nProtocol fixture only.');
const digest = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
function env(): NodeJS.ProcessEnv {
  return { MODAL_PDF_URL: endpoint, MODAL_PDF_PROXY_KEY: randomBytes(12).toString('hex'), MODAL_PDF_PROXY_SECRET: randomBytes(24).toString('hex') };
}
function extraction(): Record<string, unknown> {
  return { schemaVersion: 'pdf-extraction/v1', status: 'partial', documentHash: digest(bytes), byteLength: bytes.byteLength,
    pageCount: 2, pages: [{ number: 1, text: '', textHash: digest(''), characterCount: 0 },
      { number: 2, text: 'Prix 🧱', textHash: digest('Prix 🧱'), characterCount: 6 }], emptyPages: [1], characterCount: 6,
    extractorVersion: 'pypdf/6.21.2+accel.1' };
}
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}
describe('Modal PDF client, injected HTTP without external calls', () => {
  it('reads configuration lazily, sends only bytes with proxy auth, and retains physical pages and Unicode counts', async () => {
    const settings: NodeJS.ProcessEnv = {};
    let calls = 0;
    const client = createModalPdfClient(settings, async (url, init) => {
      calls += 1;
      expect(String(url)).toBe(`${endpoint}/`);
      expect(init?.method).toBe('POST'); expect(init?.redirect).toBe('error');
      const headers = new Headers(init?.headers);
      expect(headers.get('Modal-Key')).toBe(settings.MODAL_PDF_PROXY_KEY);
      expect(headers.get('Modal-Secret')).toBe(settings.MODAL_PDF_PROXY_SECRET);
      expect(headers.get('content-type')).toBe('application/pdf');
      expect(init?.body).toEqual(bytes); expect(init?.signal).toBeInstanceOf(AbortSignal);
      return json(extraction());
    });
    Object.assign(settings, env());
    const result = await client.extract(bytes);
    expect(result.pages[1]).toMatchObject({ number: 2, text: 'Prix 🧱', characterCount: 6 });
    expect(result.status).toBe('partial'); expect(calls).toBe(1);
  });
  it('refuses missing credentials, unsafe destinations and invalid byte sizes before any request', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls += 1; return json(extraction()); };
    await expect(createModalPdfClient({}, fetcher).extract(bytes)).rejects.toThrow('PDF_NOT_CONFIGURED');
    for (const url of ['http://127.0.0.1/', 'https://other-workspace.modal.run/', `${endpoint}/other`, `${endpoint}?token=excluded`, `https://user:pass@${new URL(endpoint).host}/`]) {
      await expect(createModalPdfClient({ ...env(), MODAL_PDF_URL: url }, fetcher).extract(bytes)).rejects.toThrow('PDF_INVALID_ENDPOINT');
    }
    await expect(createModalPdfClient(env(), fetcher).extract(new Uint8Array())).rejects.toThrow('PDF_EMPTY_INPUT');
    await expect(createModalPdfClient(env(), fetcher).extract(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toThrow('PDF_TOO_LARGE');
    expect(calls).toBe(0);
  });
  it('rejects tampered provenance, page structure, counts, status and unsupported extractor versions', async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      value => { value.documentHash = '0'.repeat(64); }, value => { value.byteLength = bytes.byteLength + 1; },
      value => { value.pageCount = 1; }, value => { value.characterCount = 7; },
      value => { value.status = 'complete'; }, value => { value.emptyPages = [2]; },
      value => { value.extractorVersion = 'unreceived/2'; }, value => { value.extra = 'unreceived field'; },
      value => { (value.pages as Array<Record<string, unknown>>)[1]!.textHash = '0'.repeat(64); },
      value => { (value.pages as Array<Record<string, unknown>>)[1]!.number = 3; },
      value => { (value.pages as Array<Record<string, unknown>>)[1]!.characterCount = 7; },
      value => { const page = (value.pages as Array<Record<string, unknown>>)[1]!; page.text = 'e\u0301'; page.characterCount = 2; page.textHash = digest('e\u0301'); value.characterCount = 2; },
      value => { const page = (value.pages as Array<Record<string, unknown>>)[1]!; page.text = 'bad\u0000'; page.characterCount = 4; page.textHash = digest('bad\u0000'); value.characterCount = 4; },
    ];
    for (const mutate of mutations) {
      const result = extraction(); mutate(result);
      await expect(createModalPdfClient(env(), async () => json(result)).extract(bytes)).rejects.toThrow('PDF_RESPONSE_INVALID');
    }
  });
  it('keeps empty extraction explicit and accepts complete text without empty pages', async () => {
    const empty = extraction(); empty.status = 'empty'; empty.pageCount = 1; empty.pages = [{ number: 1, text: '', textHash: digest(''), characterCount: 0 }]; empty.characterCount = 0;
    expect((await createModalPdfClient(env(), async () => json(empty)).extract(bytes)).status).toBe('empty');
    const complete = extraction(); complete.status = 'complete'; complete.pageCount = 1; complete.pages = [{ number: 1, text: 'Prix 🧱', textHash: digest('Prix 🧱'), characterCount: 6 }]; complete.emptyPages = [];
    expect((await createModalPdfClient(env(), async () => json(complete)).extract(bytes)).status).toBe('complete');
  });
  it('returns only stable failure codes without retrying or exposing provider bodies', async () => {
    for (const [status, code] of [[401, 'PDF_AUTH_FAILED'], [429, 'PDF_RATE_LIMITED'], [503, 'PDF_SERVICE_UNAVAILABLE']] as const) {
      let calls = 0;
      const client = createModalPdfClient(env(), async () => { calls += 1; return new Response('untrusted private provider detail', { status }); });
      await expect(client.extract(bytes)).rejects.toMatchObject({ name: 'ModalPdfError', message: code, code });
      expect(calls).toBe(1);
    }
    await expect(createModalPdfClient(env(), async () => json({ error: { code: 'PDF_ENCRYPTED', message: 'untrusted provider detail' } }, 422)).extract(bytes)).rejects.toThrow('PDF_ENCRYPTED');
    await expect(createModalPdfClient(env(), async () => { throw new Error('untrusted network detail'); }).extract(bytes)).rejects.toThrow('PDF_REQUEST_FAILED');
    expect(new ModalPdfError('PDF_REQUEST_FAILED').message).toBe('PDF_REQUEST_FAILED');
  });
  it('bounds the actual response stream and rejects invalid JSON, content type and UTF-8', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ pull(controller): void { controller.enqueue(new Uint8Array(1_000_001)); }, cancel(): void { cancelled = true; } });
    await expect(createModalPdfClient(env(), async () => new Response(stream, { headers: { 'content-type': 'application/json' } })).extract(bytes)).rejects.toThrow('PDF_RESPONSE_TOO_LARGE');
    expect(cancelled).toBe(true);
    for (const response of [new Response('{invalid', { headers: { 'content-type': 'application/json' } }), new Response('{}'), new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } })]) {
      await expect(createModalPdfClient(env(), async () => response).extract(bytes)).rejects.toThrow('PDF_RESPONSE_INVALID');
    }
  });
  it('honors caller cancellation without forwarding an arbitrary abort reason', async () => {
    const controller = new AbortController();
    const client = createModalPdfClient(env(), async (_url, init) => {
      controller.abort('untrusted cancellation detail');
      init?.signal?.throwIfAborted();
      return json(extraction());
    });
    await expect(client.extract(bytes, controller.signal)).rejects.toThrow('PDF_REQUEST_ABORTED');
  });
  it('uses Python strip semantics for text boundaries while rejecting malformed Unicode', async () => {
    for (const [text, valid] of [['\uFEFFPrix', true], ['\u0085Prix', false], ['Prix\u001C', false], ['\uD800', false]] as const) {
      const value = extraction(); value.pageCount = 1; value.status = 'complete'; value.emptyPages = [];
      value.pages = [{ number: 1, text, characterCount: Array.from(text).length, textHash: digest(text) }]; value.characterCount = Array.from(text).length;
      const result = createModalPdfClient(env(), async () => json(value)).extract(bytes);
      if (valid) expect((await result).pages[0]?.text).toBe(text);
      else await expect(result).rejects.toThrow('PDF_RESPONSE_INVALID');
    }
  });
  it('distinguishes its own deadline from caller cancellation and never sends an already cancelled request', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    try {
      const client = createModalPdfClient(env(), async (_url, init) => { deadline.abort(); init?.signal?.throwIfAborted(); return json(extraction()); });
      await expect(client.extract(bytes)).rejects.toThrow('PDF_REQUEST_TIMEOUT');
    } finally { timeout.mockRestore(); }
    const caller = new AbortController(); caller.abort('untrusted detail'); let calls = 0;
    await expect(createModalPdfClient(env(), async () => { calls += 1; return json(extraction()); }).extract(bytes, caller.signal)).rejects.toThrow('PDF_REQUEST_ABORTED');
    expect(calls).toBe(0);
  });
  it.each(['caller', 'deadline'] as const)('refuses success when %s cancellation arrives at the end of the response stream', async kind => {
    const controller = new AbortController();
    const timeout = kind === 'deadline' ? vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal) : undefined;
    try {
      const stream = new ReadableStream<Uint8Array>({
        start(reader): void { reader.enqueue(new TextEncoder().encode(JSON.stringify(extraction()))); },
        pull(reader): void { controller.abort(); reader.close(); },
      });
      const client = createModalPdfClient(env(), async () => new Response(stream, { headers: { 'content-type': 'application/json' } }));
      await expect(client.extract(bytes, kind === 'caller' ? controller.signal : undefined)).rejects.toThrow(kind === 'caller' ? 'PDF_REQUEST_ABORTED' : 'PDF_REQUEST_TIMEOUT');
    } finally { timeout?.mockRestore(); }
  });
});
