import type { RunView } from "./types";

export interface ResearchCommands {
  execute(descriptor: string, send: (key: string) => Promise<RunView>): Promise<RunView>;
}

/** App-scoped recovery state. It survives panel navigation without persisting business content. */
export function createResearchCommands(): ResearchCommands {
  const operations = new Map<string, { key: string; pending: Promise<RunView> | null }>();
  return {
    async execute(descriptor, send): Promise<RunView> {
      let operation = operations.get(descriptor);
      if (operation?.pending) return await operation.pending;
      if (!operation) { operation = { key: crypto.randomUUID(), pending: null }; operations.set(descriptor, operation); }
      const current = operation;
      current.pending = (async (): Promise<RunView> => await send(current.key))();
      try {
        const run = await current.pending;
        operations.delete(descriptor);
        return run;
      } finally { current.pending = null; }
    },
  };
}
