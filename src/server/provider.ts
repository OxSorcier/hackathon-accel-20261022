import { z } from 'zod';
import type { ModelProvider, ModelRequest } from '../agent/index.js';
import type { JsonValue } from '../contracts/index.js';
import { jsonValue } from './validation.js';

const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tool_use'), id: z.string().min(1), name: z.string().min(1), input: z.record(z.string(), jsonValue) }),
  z.object({ type: z.literal('text'), text: z.string() }),
]);
const tokenCount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const responseSchema = z.object({ content: z.array(blockSchema).max(20), stop_reason: z.string().nullable(), usage: z.object({ input_tokens: tokenCount, output_tokens: tokenCount }).optional() });
interface Message { role: 'assistant' | 'user'; content: JsonValue[] }
function messages(request: ModelRequest): Message[] {
  const result: Message[] = [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(request.context) }] }];
  for (const item of request.messages) {
    const role = item.role === 'assistant' ? 'assistant' : 'user';
    const content: JsonValue = item.role === 'assistant'
      ? { type: 'tool_use', id: item.callId, name: item.name, input: item.content }
      : { type: 'tool_result', tool_use_id: item.callId, content: JSON.stringify(item.content), is_error: item.isError };
    const last = result[result.length - 1];
    if (last?.role === role) last.content.push(content); else result.push({ role, content: [content] });
  }
  return result;
}
export interface AnthropicConfig { apiKey: string; model: string }
async function readModelResponse(response: Response): Promise<unknown> {
  if (!response.ok) { await response.body?.cancel(); throw new Error('MODEL_REQUEST_FAILED'); }
  if (!response.body) throw new Error('MODEL_EMPTY_RESPONSE');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 150000) { await reader.cancel(); throw new Error('MODEL_RESPONSE_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
}
/** One provider, fixed HTTPS endpoint, no automatic retry or private reasoning. */
export function createAnthropicProvider(config: AnthropicConfig, fetcher: typeof fetch = fetch): ModelProvider {
  z.string().min(1).max(300).parse(config.apiKey);
  z.string().regex(/^claude-[a-zA-Z0-9.-]+$/).max(120).parse(config.model);
  return {
    model: config.model, version: 'anthropic-messages/2023-06-01', mode: 'direct',
    async complete(request: ModelRequest, signal: AbortSignal): Promise<unknown> {
      const response = await fetcher('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal, redirect: 'error',
        headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.model, max_tokens: 2048, system: request.system, tools: request.tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })), tool_choice: { type: 'auto', disable_parallel_tool_use: true }, messages: messages(request) }),
      });
      const parsed = responseSchema.parse(await readModelResponse(response));
      const usage = parsed.usage ? { inputTokens: parsed.usage.input_tokens, outputTokens: parsed.usage.output_tokens, totalTokens: parsed.usage.input_tokens + parsed.usage.output_tokens } : undefined;
      if (parsed.stop_reason === 'max_tokens' || parsed.stop_reason === null) throw new Error('MODEL_INCOMPLETE');
      if (parsed.stop_reason === 'refusal') throw new Error('MODEL_REFUSED');
      const calls = parsed.content.filter(block => block.type === 'tool_use');
      if (calls.length) {
        if (parsed.stop_reason !== 'tool_use') throw new Error('MODEL_INVALID_FINISH');
        return { type: 'tool_calls', calls: calls.map(block => ({ id: block.id, name: block.name, arguments: block.input })), ...(usage ? { usage } : {}) };
      }
      if (parsed.stop_reason !== 'end_turn' && parsed.stop_reason !== 'stop_sequence') throw new Error('MODEL_INVALID_FINISH');
      const message = parsed.content.filter(block => block.type === 'text').map(block => block.text).join('\n').slice(0, 4000);
      return { type: 'needs_input', message: message || 'The provider did not return an actionable proposal.', ...(usage ? { usage } : {}) };
    },
  };
}

const openAIResponseSchema = z.object({ choices: z.array(z.object({
  finish_reason: z.enum(['stop', 'tool_calls', 'length', 'content_filter']),
  message: z.object({ content: z.string().nullable().optional(), tool_calls: z.array(z.object({ id: z.string().min(1).max(200), type: z.literal('function'), function: z.object({ name: z.string().min(1).max(200), arguments: z.string().max(50000) }) })).max(12).optional() }),
})).length(1), usage: z.object({ prompt_tokens: tokenCount, completion_tokens: tokenCount, total_tokens: tokenCount }).optional() });
interface OpenAIToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type OpenAIMessage = { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: null; tool_calls: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
/** OpenAI Chat Completions v1, a stateless bounded client-tool adapter. */
export function createOpenAIProvider(config: AnthropicConfig, fetcher: typeof fetch = fetch): ModelProvider {
  z.string().min(1).max(300).parse(config.apiKey);
  z.string().regex(/^(gpt-|o[1-9])[a-zA-Z0-9._-]+$/).max(120).parse(config.model);
  return {
    model: config.model, version: 'openai-chat-completions/v1', mode: 'direct',
    async complete(request: ModelRequest, signal: AbortSignal): Promise<unknown> {
      const history: OpenAIMessage[] = [{ role: 'system', content: request.system }, { role: 'user', content: JSON.stringify(request.context) }];
      for (const item of request.messages) {
        if (item.role === 'assistant') {
          const call: OpenAIToolCall = { id: item.callId, type: 'function', function: { name: item.name, arguments: JSON.stringify(item.content) } };
          const last = history[history.length - 1];
          if (last?.role === 'assistant') last.tool_calls.push(call);
          else history.push({ role: 'assistant', content: null, tool_calls: [call] });
        } else history.push({ role: 'tool', tool_call_id: item.callId, content: JSON.stringify(item.content) });
      }
      const response = await fetcher('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal, redirect: 'error',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, max_completion_tokens: 2048, store: false, parallel_tool_calls: false, messages: history, tools: request.tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } })), tool_choice: 'auto' }),
      });
      const parsed = openAIResponseSchema.parse(await readModelResponse(response));
      const result = parsed.choices[0]!;
      const usage = parsed.usage ? { inputTokens: parsed.usage.prompt_tokens, outputTokens: parsed.usage.completion_tokens, totalTokens: parsed.usage.total_tokens } : undefined;
      if (result.finish_reason === 'length') throw new Error('MODEL_INCOMPLETE');
      if (result.finish_reason === 'content_filter') throw new Error('MODEL_REFUSED');
      const calls = result.message.tool_calls;
      if (calls?.length) {
        if (result.finish_reason !== 'tool_calls') throw new Error('MODEL_INVALID_FINISH');
        return { type: 'tool_calls', calls: calls.map(call => ({ id: call.id, name: call.function.name, arguments: z.record(z.string(), jsonValue).parse(JSON.parse(call.function.arguments)) })), ...(usage ? { usage } : {}) };
      }
      if (result.finish_reason === 'tool_calls') throw new Error('MODEL_MISSING_CALLS');
      return { type: 'needs_input', message: result.message.content?.slice(0, 4000) || 'The provider did not return an actionable proposal.', ...(usage ? { usage } : {}) };
    },
  };
}

export function createConfiguredProvider(env: NodeJS.ProcessEnv = process.env): ModelProvider | undefined {
  if (!env.MODEL_API_KEY || !env.MODEL_NAME) return undefined;
  const config = { apiKey: env.MODEL_API_KEY, model: env.MODEL_NAME };
  if (env.MODEL_PROVIDER === 'openai') return createOpenAIProvider(config);
  if (env.MODEL_PROVIDER === 'anthropic') return createAnthropicProvider(config);
  throw new Error('EXPLICIT_MODEL_PROVIDER_REQUIRED');
}
