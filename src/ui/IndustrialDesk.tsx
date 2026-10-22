import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { CoordinatedIndustrialPlan, IndustrialDemoExecution, IndustrialPlanStep } from "../contracts/industrial.js";
import type { IndustrialPlanState, IndustrialReportView, IndustrialWorkspace } from "../contracts/industrial-api.js";
import type { IndustrialCommands } from "./pending-commands";
import type { UiApi, WorkspaceView } from "./types";
import { UiError } from "./types";
import { formatDate, formatMoney } from "./format";
import { industrialBasisCurrent, sameIndustrialValue } from "./industrial";
import { PhysicalPages } from "./physical-pages";
import type { PhysicalPage } from "./physical-pages";
import { physicalEntityLabel } from "./physical-model";

type Command = { kind: "approve" | "reject" | "simulate"; plan: CoordinatedIndustrialPlan; state: IndustrialPlanState };
const impactLabels = { risk: "Risk assessed", opportunity: "Opportunity assessed", mixed: "Risk and opportunity", no_known_exposure: "No known exposure", needs_input: "Needs more information" };

function money(value: number | null): string { return value === null ? "Not calculated" : formatMoney(value / 100); }
function errorText(error: unknown): string { return error instanceof UiError ? `${error.message}${error.uncertain ? " The outcome is uncertain. Read the saved state before retrying." : ""}` : "The briefing service did not return a confirmed result."; }
function List({ values }: { values: string[] }): ReactElement { return values.length ? <ul className="small">{values.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p className="small muted">None reported.</p>; }

function Step({ value, company, workspace }: { value: IndustrialPlanStep; company: WorkspaceView; workspace: IndustrialWorkspace }): ReactElement {
  const product = company.catalog.products.find(item => item.id === value.productId)?.label ?? value.productId;
  return <article className="industrial-step"><div className="line-wrap"><span className="badge">{value.kind === "purchase" ? "Purchasing" : value.kind === "transfer" ? "Operations" : "Sales"}</span><strong>{value.kind === "purchase" ? "Prepare a purchase order" : value.kind === "transfer" ? "Prepare a transfer order" : "Prepare a draft offer"}</strong></div><p>{value.quantity} {value.unit} · {product}</p><p className="small">{value.kind === "purchase" ? `Supplier: ${physicalEntityLabel(workspace, "supplier", value.supplierId)}` : value.kind === "transfer" ? `From: ${physicalEntityLabel(workspace, "depot", value.fromDepotId)}` : "Qualified CRM demand"}</p><p className="small">{value.kind === "prepare_offer" ? `Needed: ${formatDate(value.needDate, false)} · Unit price: ${money(value.saleUnitPriceCents)}` : `Arrival: ${formatDate(value.arrivalDate, false)} · Freight: ${money(value.freightCents)}`}</p>
    <details className="research-source-details"><summary>Action references and dependencies</summary><dl className="research-refs"><div><dt>Action</dt><dd>{value.id}</dd></div><div><dt>Destination</dt><dd>{physicalEntityLabel(workspace, "depot", value.destinationDepotId)}<small> · {value.destinationDepotId}</small></dd></div>{value.kind !== "prepare_offer" && <div><dt>Resource</dt><dd>{value.canonicalResourceId}</dd></div>}</dl><List values={value.dependsOn} /></details>
  </article>;
}

function Execution({ value, browserDemo }: { value: IndustrialDemoExecution; browserDemo: boolean }): ReactElement {
  return <section className={`notice ${value.status === "applied" ? "notice-info" : "notice-warning"}`}><h3>{value.status === "applied" ? "Executed in the demo system" : value.status === "failed" ? "Demo execution failed" : "Execution outcome uncertain"}</h3><p>{value.status === "applied" ? browserDemo ? "Demo changes saved in this browser. No external action was sent." : "The server committed a simulated change. Future orders, reservations, planned allocations or a draft offer are recorded below. Physical delivery, an accepted sale and realised revenue are not established by this receipt." : "No successful business effect is confirmed. Read the saved state before any further command."}</p>
    <details className="research-source-details"><summary>Saved execution receipt</summary><dl className="research-refs"><div><dt>Reference</dt><dd>{value.id}</dd></div><div><dt>Before</dt><dd>{value.beforeRevision}</dd></div><div><dt>After</dt><dd>{value.afterRevision ?? "Not confirmed"}</dd></div><div><dt>Completed</dt><dd>{formatDate(value.completedAt ?? undefined)}</dd></div>{value.code && <div><dt>Result code</dt><dd>{value.code}</dd></div>}</dl><ul className="small">{value.records.map((record, index) => <li key={index}>{({ purchase_order: "Purchase order", transfer_order: "Transfer order", origin_stock_reservation: "Origin stock reservation", planned_allocation: "Planned allocation", crm_offer: "Draft CRM offer" })[record.kind]} · {record.id} · {record.status}</li>)}</ul></details>
  </section>;
}

function Plan({ value, state, workspace, company, fresh, busy, browserDemo, onCommand }: { browserDemo: boolean; value: CoordinatedIndustrialPlan; state: IndustrialPlanState; workspace: IndustrialWorkspace; company: WorkspaceView; fresh: boolean; busy: boolean; onCommand: (command: Command) => void }): ReactElement {
  const current = industrialBasisCurrent(value.basis, workspace); const enabled = fresh && !busy && current;
  return <section className="industrial-plan section-box" aria-label="Coordinated plan"><div className="line-wrap"><h3>One coordinated plan</h3><span className="badge">{({ feasible: "Feasible at evaluation", conditional: "Conditional", rejected: "Not feasible" })[value.status]}</span><span className="badge">{({ pending: "Needs a decision", approved: "Approved", rejected: "Rejected", stale: "Stale plan" })[state.status]}</span></div>
    {!current && <p className="notice notice-warning">This plan uses an earlier data version. Its historical receipts remain available; new actions require a current plan.</p>}
    <dl className="industrial-economics"><div><dt>Total new spending</dt><dd>{money(value.economics.grossNewSpendCents)}</dd></div><div><dt>Risk mitigation spending</dt><dd>{money(value.economics.riskMitigationSpendCents)}</dd></div><div><dt>Potential opportunity revenue</dt><dd>{money(value.economics.opportunityRevenueCents)}</dd></div><div><dt>Contribution after costs</dt><dd>{money(value.economics.opportunityContributionCents)}</dd></div></dl><p className="small muted">Potential revenue and calculated contribution are not realised revenue or savings. This is an admissible candidate plan, not a proven global optimum.</p>
    <div className="industrial-steps">{value.steps.map(step => <Step key={step.id} value={step} company={company} workspace={workspace} />)}</div>
    <details className="research-source-details"><summary>Conditions, missing information and resource allocation</summary><h4>Conditions</h4><List values={value.constraints} /><h4>Missing information</h4><List values={[...value.unknowns, ...value.economics.missing]} /><h4>Allocated resources</h4><ul className="small">{value.allocations.map((item, index) => <li key={index}>{item.quantity} {item.unit} · {item.targetKind === "crm_demand" ? "Qualified CRM demand" : "Existing commitment"} · {item.targetId} · Available {formatDate(item.availableDate, false)}</li>)}</ul><p className="small">Plan {value.id} · Version {value.version}</p><p className="small">Basis: {value.basis.businessRevision} · {value.basis.contextRevision} · {value.basis.qualificationRevision}</p></details>
    {state.permissions.blockedReason && <p className="notice notice-warning">{state.permissions.blockedReason}</p>}
    {state.approval && <div className="notice"><strong>{state.approval.decision === "approved" ? "Approval recorded" : "Rejection recorded"}</strong><p className="small">{formatDate(state.approval.decidedAt)}. This decision does not establish execution.</p><details className="research-source-details"><summary>Decision receipt</summary><p className="small">{state.approval.id} · Actor {state.approval.actorId} · Plan version {state.approval.planVersion}</p></details></div>}
    {state.execution ? <Execution value={state.execution} browserDemo={browserDemo} /> : <p className="small muted">No execution result received for this plan.</p>}
    {!workspace.capabilities.decisionsConnected && <p className="notice">Plan decisions are not connected yet.</p>}{!workspace.capabilities.simulationConnected && <p className="small muted">Demo execution is not connected yet.</p>}
    <div className="decision-actions">{state.status === "pending" && <><button className="button primary" disabled={!enabled || !workspace.capabilities.decisionsConnected || !state.permissions.canApprove || value.status !== "feasible"} onClick={() => onCommand({ kind: "approve", plan: value, state })}>Review approval</button><button className="button quiet" disabled={!enabled || !workspace.capabilities.decisionsConnected || !state.permissions.canReject} onClick={() => onCommand({ kind: "reject", plan: value, state })}>Reject plan</button></>}{state.status === "approved" && !state.execution && <button className="button primary" disabled={!enabled || !workspace.capabilities.simulationConnected || !state.permissions.canSimulate} onClick={() => onCommand({ kind: "simulate", plan: value, state })}>Review demo execution</button>}</div>
  </section>;
}

function Confirmation({ command, busy, enabled, error, browserDemo, onCancel, onConfirm }: { browserDemo: boolean; command: Command; busy: boolean; enabled: boolean; error: string; onCancel: () => void; onConfirm: () => Promise<void> }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="confirmation" aria-labelledby="industrial-confirm-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}><span className="badge badge-warning">Synthetic company · Demo system</span><h2 id="industrial-confirm-title">{command.kind === "simulate" ? "Run this demo simulation?" : command.kind === "approve" ? "Approve this coordinated plan?" : "Reject this coordinated plan?"}</h2><p>{browserDemo ? "This demo saves changes in this browser. No external action will be sent." : command.kind === "simulate" ? "This command may create future purchase or transfer orders, source reservations, planned allocations and a draft CRM offer in the demo database. It does not contact a supplier or customer." : "The server will verify the current plan, data, permissions and spending authority."}</p><p>Total new spending: <strong>{money(command.plan.economics.grossNewSpendCents)}</strong></p><p className="small muted">Plan version {command.plan.version} · Business revision {command.plan.basis.businessRevision}</p>{!enabled && <p className="notice notice-warning">The plan or received permissions changed. Reload the briefing before confirming.</p>}{error && <p className="notice notice-danger" role="alert">{error}</p>}<div className="decision-actions"><button className="button primary" disabled={!enabled || busy} onClick={() => { void onConfirm(); }}>{busy ? "Waiting for receipt…" : command.kind === "simulate" ? "Confirm demo execution" : command.kind === "approve" ? "Confirm approval" : "Confirm rejection"}</button><button className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button></div></dialog>;
}

export function IndustrialDesk({ api, company, commands, fresh, onConnected, onAfterMutation, onLegacy, page = "overview", browserDemo = false }: { browserDemo?: boolean; page?: PhysicalPage; api: UiApi; company: WorkspaceView; commands: IndustrialCommands; fresh: boolean; onConnected: (companyId: string) => void; onAfterMutation: () => Promise<void>; onLegacy: () => void }): ReactElement {
  const [workspace, setWorkspace] = useState<IndustrialWorkspace | null>(null);
  const [reading, setReading] = useState(true); const [readError, setReadError] = useState("");
  const [selectedReport, setSelectedReport] = useState(""); const [selectedPlan, setSelectedPlan] = useState("");
  const [command, setCommand] = useState<Command | null>(null); const [sending, setSending] = useState(false); const [commandError, setCommandError] = useState(""); const [feedback, setFeedback] = useState("");
  const mounted = useRef(true); const lifecycle = useRef(0); const requestNumber = useRef(0); const planHeading = useRef<HTMLDivElement>(null);
  const actorId = company.company.actor?.id;
  const read = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const number = ++requestNumber.current; setReading(true);
    try {
      if (!api.readIndustrial) throw new UiError("NOT_READY", "The company briefing is not connected yet.");
      const value = await api.readIndustrial(signal);
      if (mounted.current && !signal?.aborted && number === requestNumber.current) { setWorkspace(value); setReadError(""); onConnected(value.company.id); }
    } catch (error) { if (mounted.current && !signal?.aborted && number === requestNumber.current) setReadError(errorText(error)); }
    finally { if (mounted.current && !signal?.aborted && number === requestNumber.current) setReading(false); }
  }, [api, onConnected]);
  useEffect(() => {
    mounted.current = true; lifecycle.current++; const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    setWorkspace(null); setReadError(""); setCommand(null); setCommandError(""); setFeedback(""); setSending(false);
    async function tick(): Promise<void> { await read(controller.signal); if (!controller.signal.aborted) timer = setTimeout(() => { void tick(); }, 5000); }
    if (company.company.actor) void tick(); else setReading(false);
    return () => { mounted.current = false; lifecycle.current++; controller.abort(); clearTimeout(timer); requestNumber.current++; };
  }, [read, actorId, company.company.id, company.company.actor?.role]);
  useEffect(() => { if (selectedPlan) { planHeading.current?.focus({ preventScroll: true }); planHeading.current?.scrollIntoView({ block: "start" }); } }, [selectedPlan]);
  const views = [...(workspace?.reports ?? [])].sort((left, right) => Date.parse(right.report.createdAt) - Date.parse(left.report.createdAt));
  const view = views.find(item => item.report.id === selectedReport) ?? views[0];
  const recommended = view?.report.assessment.plans.find(item => item.id === view.report.recommendedPlanId);
  const plan = view?.report.assessment.plans.find(item => item.id === selectedPlan);
  const state = view?.planStates.find(item => item.planId === plan?.id);
  const currentCommandView = workspace?.reports.find(item => item.report.assessment.plans.some(value => command && value.id === command.plan.id && value.version === command.plan.version && sameIndustrialValue(value, command.plan)) && item.planStates.some(value => command && value.planId === command.plan.id && value.planHash === command.state.planHash));
  const currentCommandState = currentCommandView?.planStates.find(item => item.planId === command?.plan.id);
  const canCommand = Boolean(fresh && workspace && !reading && !readError && command && currentCommandView?.freshness === "current" && currentCommandView.report.status === "prepared" && currentCommandState && sameIndustrialValue(command.state, currentCommandState) && industrialBasisCurrent(command.plan.basis, workspace) && (command.kind === "simulate" ? workspace.capabilities.simulationConnected && currentCommandState.permissions.canSimulate : workspace.capabilities.decisionsConnected && (command.kind === "approve" ? currentCommandState.permissions.canApprove : currentCommandState.permissions.canReject)));
  async function confirm(): Promise<void> {
    if (!workspace || !command || sending || !canCommand) return;
    const current = command; const generation = lifecycle.current;
    const descriptor = JSON.stringify([workspace.company.id, workspace.actor.actorId, workspace.actor.role, current.kind, current.plan.id, current.plan.version, current.state.planHash, current.plan.basis, current.state.approval?.id]);
    setSending(true); setCommandError(""); setFeedback("");
    try {
      let receiptMessage = "Decision receipt received. Reading the saved decision below.";
      if (current.kind === "simulate") {
        const send = api.simulateIndustrialApproval;
        if (!send || !current.state.approval) throw new UiError("NOT_READY", "Demo execution is unavailable.");
        const approvalId = current.state.approval.id;
        const receipt = await commands.simulations.execute(descriptor, async operationKey => await send(approvalId, { expectedBusinessRevision: current.plan.basis.businessRevision, expectedPlanVersion: current.plan.version, expectedPlanHash: current.state.planHash, operationKey }));
        receiptMessage = receipt.status === "uncertain" ? "The simulation outcome is uncertain. Reading durable state; the original operation key is retained." : receipt.status === "failed" ? "The simulation returned a failure receipt. Reading the saved result." : "A simulation receipt was received. Reading its saved records below.";
      } else {
        const send = api.decideIndustrialPlan;
        if (!send) throw new UiError("NOT_READY", "Plan decisions are unavailable.");
        await commands.decisions.execute(descriptor, async operationKey => await send(current.plan.id, { decision: current.kind as "approve" | "reject", expectedBasis: current.plan.basis, expectedPlanVersion: current.plan.version, expectedPlanHash: current.state.planHash, operationKey }));
      }
      if (!mounted.current || generation !== lifecycle.current) return;
      setCommand(null); setFeedback(receiptMessage);
      await onAfterMutation(); await read();
    } catch (error) { if (mounted.current && generation === lifecycle.current) { setCommandError(errorText(error)); await read(); } }
    finally { if (mounted.current && generation === lifecycle.current) setSending(false); }
  }
  const planContent = plan && state && workspace && view ? <div ref={planHeading} tabIndex={-1}><Plan browserDemo={browserDemo} value={plan} state={state} workspace={workspace} company={company} fresh={fresh && !readError && !reading && view.freshness === "current" && view.report.status === "prepared"} busy={sending} onCommand={value => { setCommandError(""); setCommand(value); }} /></div> : undefined;
  return <section className="industrial-desk" aria-label="Company briefing">
    {!company.company.actor && <p className="notice">Sign in to read your company workspace.</p>}
    {readError && <div className="notice notice-warning" role="alert"><strong>Workspace could not be refreshed</strong><p>{readError}</p>{workspace && <p>Showing the last received report. New actions are suspended.</p>}<button className="text-button" onClick={onLegacy}>Open saved decisions</button></div>}
    {reading && !workspace && company.company.actor && <p className="notice" role="status">Reading your business context…</p>}
    {workspace && <PhysicalPages page={page} workspace={workspace} company={company} api={api} report={view} recommended={recommended} reading={reading} fresh={fresh && !readError} onSelectReport={id => { setSelectedReport(id); setSelectedPlan(""); }} onSelectPlan={setSelectedPlan} onRefresh={() => { void read(); }} planContent={planContent} />}
    {feedback && <p className="notice" role="status">{feedback}</p>}{commandError && !command && <p className="notice notice-danger" role="alert">{commandError}</p>}
    {command && <Confirmation browserDemo={browserDemo} command={command} busy={sending} enabled={canCommand} error={commandError} onCancel={() => setCommand(null)} onConfirm={confirm} />}
  </section>;
}
