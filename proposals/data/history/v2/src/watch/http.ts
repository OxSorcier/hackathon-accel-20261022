export async function withAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject): void => {
      abort = (): void => { reject(new DOMException('Request aborted', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    })]);
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}

export async function cancelBody(body: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null, signal?: AbortSignal): Promise<void> {
  if (!body) return;
  const timeout = AbortSignal.timeout(100);
  try { await withAbort(body.cancel(), signal ? AbortSignal.any([signal, timeout]) : timeout); } catch { /* Cleanup cannot replace the original request error. */ }
}

export async function readBoundedJson(response: Response, maxBytes: number, signal?: AbortSignal): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) { await cancelBody(response.body, signal); throw new Error('BODY_TOO_LARGE'); }
  if (!response.body) throw new Error('EMPTY_HTTP_BODY');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const part = signal ? await withAbort(reader.read(), signal) : await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) throw new Error('BODY_TOO_LARGE');
      chunks.push(part.value);
    }
  } catch (error: unknown) { await cancelBody(reader, signal); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); return parsed;
}

export function requestErrorCode(error: unknown): string {
  if (error instanceof Error && ['BODY_TOO_LARGE', 'EMPTY_HTTP_BODY', 'INVALID_SOURCE_ENVELOPE', 'QUERY_MISMATCH'].includes(error.message)) return error.message;
  if (error instanceof Error && /^HTTP_\d{3}$/.test(error.message)) return error.message;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return 'COLLECTION_ABORTED';
  return 'SOURCE_REQUEST_OR_PAYLOAD_ERROR';
}
