import { createRoot } from "react-dom/client";
import { App } from "../../src/ui/App";
import { physicalCompanyName } from "../../src/ui/physical-model";
import { UiError, type UiApi, type WorkspaceView } from "../../src/ui/types";
import { receivedWorkspace } from "./physical-connected-snapshot";

const recorded: WorkspaceView = {
  company: { id: receivedWorkspace.company.id, name: physicalCompanyName(receivedWorkspace), revision: receivedWorkspace.company.businessRevision, policyVersion: receivedWorkspace.company.policyVersion, asOf: receivedWorkspace.context.receivedAt, dataOrigin: receivedWorkspace.company.dataOrigin, actor: { id: receivedWorkspace.actor.actorId, name: receivedWorkspace.actor.actorId, role: receivedWorkspace.actor.role }, canDecide: false },
  proposals: [], runs: [], watches: [], memory: [], cases: [],
  catalog: { products: [], suppliers: (receivedWorkspace.display?.labels ?? []).filter(value => value.entityType === "supplier").map(value => ({ id: value.nativeId, label: value.displayName })), commitments: [], inbound: [] },
};
async function unavailable(): Promise<never> { throw new UiError("READ_ONLY_PREVIEW", "This recorded workspace cannot send commands."); }
const api: UiApi = { readWorkspace: async (): Promise<WorkspaceView> => structuredClone(recorded), readIndustrial: async () => structuredClone(receivedWorkspace), askQuestion: unavailable, createWatch: unavailable, decide: unavailable };
const root = document.getElementById("root");
if (!root) throw new Error("Preview root missing");
createRoot(root).render(<><div role="status" style={{ background: "#edf3f1", color: "#31584d", padding: "10px 24px", font: "12px system-ui" }}>Recorded authenticated HTTP workspace. Read-only interface check; no live source, model or business command is called here.</div><App api={api} /></>);
