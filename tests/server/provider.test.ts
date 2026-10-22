import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createAnthropicProvider, createOpenAIProvider, createConfiguredProvider } from '../../src/server/provider.js';
import { createAgentRunner } from '../../src/agent/index.js';
import { evaluateBusiness } from '../../src/domain/index.js';
import type { AgentRunnerInput, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import type { ModelRequest } from '../../src/agent/index.js';
const request: ModelRequest = { system: 'Test protocol only', context: { question: 'Question test', companyId: 'CO-DEMO', dataOrigin: 'synthetic', policy: { version: 'P1', replacementMarginDays: 2, rules: [] }, manifest: { contractVersion: 'C1', companyId: 'CO-DEMO', revision: 'R0', policyVersion: 'P1', snapshotAsOf: '2026-10-22T08:00:00Z', assembledAt: '2026-10-22T08:00:00Z', memoryIds: [], toolsVersion: 'agent-tools/1' } }, tools: [{ name: 'read_commitments', description: 'Read test commitments', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }], messages: [{ role: 'assistant', callId: 'call-1', name: 'read_commitments', content: {}, isError: false }, { role: 'tool', callId: 'call-1', name: 'read_commitments', content: { companyId: 'CO-DEMO' }, isError: false }] };
describe('Anthropic protocol adapter with injected HTTP, no real inference', () => {
  it('correlates tool calls and results and accepts only the fixed endpoint', async () => {
    let body: Record<string, unknown> | undefined;
    const provider = createAnthropicProvider({ apiKey: randomBytes(32).toString('hex'), model: 'claude-test-protocol' }, async (url, init) => {
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(init?.redirect).toBe('error');
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'call-2', name: 'evaluate_options', input: { targetOrderLineId: 'OL-A' } }] }));
    });
    expect(await provider.complete(request, new AbortController().signal)).toEqual({ type: 'tool_calls', calls: [{ id: 'call-2', name: 'evaluate_options', arguments: { targetOrderLineId: 'OL-A' } }] });
    expect(body?.messages).toMatchObject([{ role: 'user' }, { role: 'assistant', content: [{ type: 'tool_use', id: 'call-1' }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1' }] }]);
  });
  it('never converts a provider failure into an empty successful response', async () => {
    let calls = 0;
    const provider = createAnthropicProvider({ apiKey: randomBytes(32).toString('hex'), model: 'claude-test-protocol' }, async () => { calls++; return new Response('private provider error', { status: 503 }); });
    await expect(provider.complete(request, new AbortController().signal)).rejects.toThrow('MODEL_REQUEST_FAILED'); expect(calls).toBe(1);
  });
  it('never prepares a proposal from a truncated Anthropic tool response', async () => {
    const dataset = JSON.parse(await readFile(new URL('../../fixtures/company/dataset.json', import.meta.url), 'utf8')) as CompanyDataset;
    const policy = JSON.parse(await readFile(new URL('../../fixtures/company/company-policy.json', import.meta.url), 'utf8')) as CompanyPolicy;
    const input: AgentRunnerInput = {
      actor: { actorId: 'EMP-PAUL', companyId: 'CO-DEMO', role: 'direction', approvalCeilingEur: 2000 },
      snapshot: { companyId: 'CO-DEMO', revision: 'R0', policyVersion: 'P1', dataOrigin: 'synthetic', dataset, policy, updatedAt: dataset.as_of },
      run: { id: 'RUN-PROTOCOL', companyId: 'CO-DEMO', actorId: 'EMP-PAUL', operationKey: 'protocol-incomplete', question: 'Comment couvrir A ?', status: 'running', revision: 'R0', policyVersion: 'P1', mode: 'direct', model: null, proposalId: null, message: null, traces: [], createdAt: dataset.as_of, completedAt: null },
      memories: [],
    };
    const evaluation = evaluateBusiness(input.snapshot, 'OL-A');
    const option = evaluation.options.find(candidate => candidate.kind === 'wait')!;
    let calls = 0;
    const provider = createAnthropicProvider({ apiKey: randomBytes(16).toString('hex'), model: 'claude-test-protocol' }, async () => {
      calls++;
      const content = calls === 1
        ? { type: 'tool_use', id: 'evaluate-1', name: 'evaluate_options', input: { targetOrderLineId: 'OL-A' } }
        : { type: 'tool_use', id: 'prepare-1', name: 'prepare_proposal', input: { evaluationId: evaluation.id, optionId: option.id, title: 'Couvrir A', summary: 'Ressources confirmées.' } };
      return new Response(JSON.stringify({ stop_reason: calls === 1 ? 'tool_use' : 'max_tokens', content: [content] }));
    });
    const result = await createAgentRunner({ provider, currentVersion: async () => ({ companyId: 'CO-DEMO', revision: 'R0', policyVersion: 'P1' }) })(input);
    expect(result.status).toBe('uncertain'); expect(result.proposal).toBeNull(); expect(calls).toBe(2);
    expect(result.traces.some(trace => trace.tool === 'prepare_proposal')).toBe(false);
  });
});
describe('OpenAI protocol adapter, injected HTTP only', () => {
  it('sends correlated function messages and returns validated calls', async () => {
    let body: Record<string, unknown> | undefined;
    const provider = createOpenAIProvider({ apiKey: randomBytes(32).toString('hex'), model: 'gpt-test-protocol' }, async (url, init) => {
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'call-2', type: 'function', function: { name: 'evaluate_options', arguments: '{"targetOrderLineId":"OL-A"}' } }] } }] }));
    });
    expect(await provider.complete(request, new AbortController().signal)).toEqual({ type: 'tool_calls', calls: [{ id: 'call-2', name: 'evaluate_options', arguments: { targetOrderLineId: 'OL-A' } }] });
    expect(body?.store).toBe(false); expect(body?.max_completion_tokens).toBe(2048); expect(body?.parallel_tool_calls).toBe(false);
    expect(body?.messages).toMatchObject([{ role: 'system' }, { role: 'user' }, { role: 'assistant', tool_calls: [{ id: 'call-1' }] }, { role: 'tool', tool_call_id: 'call-1' }]);
  });
  it('refuses incomplete or invalid provider results and never retries HTTP', async () => {
    let calls = 0;
    const provider = createOpenAIProvider({ apiKey: randomBytes(32).toString('hex'), model: 'gpt-test-protocol' }, async () => { calls++; return new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'unfinished' } }] })); });
    await expect(provider.complete(request, new AbortController().signal)).rejects.toThrow('MODEL_INCOMPLETE'); expect(calls).toBe(1);
  });
  it('requires an explicit single provider when credentials are configured', () => {
    expect(createConfiguredProvider({})).toBeUndefined();
    const env = { MODEL_API_KEY: randomBytes(32).toString('hex'), MODEL_NAME: 'gpt-test-protocol' };
    expect(() => createConfiguredProvider(env)).toThrow('EXPLICIT_MODEL_PROVIDER_REQUIRED');
    expect(createConfiguredProvider({ ...env, MODEL_PROVIDER: 'openai' })?.version).toBe('openai-chat-completions/v1');
  });
  it('keeps only validated provider token usage alongside the public result', async () => {
    const provider = createOpenAIProvider({ apiKey: randomBytes(16).toString('hex'), model: 'gpt-test-protocol' }, async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Préciser la demande.' } }], usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150, private_extra: 'excluded' } })));
    expect(await provider.complete(request, new AbortController().signal)).toEqual({ type: 'needs_input', message: 'Préciser la demande.', usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 } });
  });
  it('replays an admitted batch as one assistant message before its correlated tool results', async () => {
    let body: Record<string, unknown> | undefined;
    const provider = createOpenAIProvider({ apiKey: randomBytes(16).toString('hex'), model: 'gpt-test-protocol' }, async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Préciser la demande.' } }] }));
    });
    await provider.complete({ ...request, messages: [request.messages[0]!, { role: 'assistant', callId: 'call-2', name: 'read_company_context', content: {}, isError: false }, request.messages[1]!, { role: 'tool', callId: 'call-2', name: 'read_company_context', content: { companyId: 'CO-DEMO' }, isError: false }] }, new AbortController().signal);
    expect(body?.messages).toMatchObject([{ role: 'system' }, { role: 'user' }, { role: 'assistant', tool_calls: [{ id: 'call-1' }, { id: 'call-2' }] }, { role: 'tool', tool_call_id: 'call-1' }, { role: 'tool', tool_call_id: 'call-2' }]);
  });
});
