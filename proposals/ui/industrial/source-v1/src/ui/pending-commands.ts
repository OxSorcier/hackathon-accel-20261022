import type { IndustrialApproval, IndustrialDemoExecution } from "../contracts/industrial.js";

export interface PendingCommands<T> { execute(descriptor: string, send: (key: string) => Promise<T>): Promise<T> }
export interface IndustrialCommands { decisions: PendingCommands<IndustrialApproval>; simulations: PendingCommands<IndustrialDemoExecution> }

function createPendingCommands<T>(): PendingCommands<T> {
  const operations = new Map<string, { key: string; pending: Promise<T> | null }>();
  return { async execute(descriptor, send): Promise<T> {
    let operation = operations.get(descriptor);
    if (operation?.pending) return await operation.pending;
    if (!operation) { operation = { key: crypto.randomUUID(), pending: null }; operations.set(descriptor, operation); }
    const current = operation; current.pending = (async (): Promise<T> => await send(current.key))();
    try { const value = await current.pending; operations.delete(descriptor); return value; }
    finally { current.pending = null; }
  } };
}

export function createIndustrialCommands(): IndustrialCommands {
  return { decisions: createPendingCommands<IndustrialApproval>(), simulations: createPendingCommands<IndustrialDemoExecution>() };
}
