import type { CollectionStatus, SourceResult } from '../contracts/index.ts';

export function aggregateCollectionStatus(sources: readonly SourceResult[]): CollectionStatus {
  if (sources.length === 0 || sources.every((source) => source.status === 'not_run')) return 'not_run';
  if (sources.every((source) => source.status === 'error' || source.status === 'not_run')) return 'error';
  if (sources.every((source) => source.status === 'empty')) return 'empty';
  if (sources.every((source) => source.status === 'success' || source.status === 'empty')) return 'success';
  return 'partial';
}
