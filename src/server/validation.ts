import { z } from 'zod';
import type { CompanyDataset, CompanyPolicy, CompanySnapshot, JsonValue } from '../contracts/index.js';
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([z.null(), z.boolean(), z.number().finite(), z.string(), z.array(jsonValue), z.record(z.string(), jsonValue)]));
export const datasetSchema: z.ZodType<CompanyDataset> = z.object({ schema: z.literal('accel-demo-fixtures/1'), company_id: z.string().min(1), data_origin: z.literal('synthetic'), snapshot_revision: z.string().min(1), as_of: z.string().datetime({ offset: true }), tables: z.record(z.string(), z.array(z.record(z.string(), jsonValue))) });
export const policySchema: z.ZodType<CompanyPolicy> = z.object({ schema: z.string().optional(), company_id: z.string().min(1), data_origin: z.literal('synthetic'), rules: z.array(z.object({ id: z.string(), rule: z.string() })), role_approval_note: z.string(), agent_context_excludes: z.array(z.string()), public_search_inputs: z.string() });
export const snapshotSchema: z.ZodType<CompanySnapshot> = z.object({ companyId: z.string(), revision: z.string(), policyVersion: z.string(), dataOrigin: z.literal('synthetic'), dataset: datasetSchema, policy: policySchema, updatedAt: z.string().datetime({ offset: true }) }).refine(snapshot =>
  snapshot.companyId === snapshot.dataset.company_id && snapshot.companyId === snapshot.policy.company_id
  && snapshot.revision === snapshot.dataset.snapshot_revision
  && snapshot.dataset.tables.company?.length === 1 && snapshot.dataset.tables.company[0]?.id === snapshot.companyId,
{ message: 'Company profile, dataset, policy and revision must match the server snapshot' });
export const questionSchema = z.object({ question: z.string().trim().min(1).max(3000), operationKey: z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/) }).strict();
export const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']), revision: z.string().min(1).max(128), policyVersion: z.string().min(1).max(128), operationKey: z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/) }).strict();
export const watchSchema = z.object({ publicTopic: z.string().trim().min(3).max(200), sourceUrls: z.array(z.url()).min(1).max(3), cadenceMinutes: z.number().int().min(5).max(10080) }).strict();
