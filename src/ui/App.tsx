import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { formatDate, formatMoney, isProposalStale, originLabel, publicTopicLabel, safeSourceUrl } from "./format";
import { UiError } from "./types";
import type { DecisionInput, OptionView, ProposalView, RunView, SourceView, Tone, UiApi, WatchCapabilitiesView, WorkspaceView } from "./types";
import "./styles.css";
import "./physical-impact.css";
import { createPhysicalDemoApi, resetPhysicalDemo } from "./physical-demo";
import { createHttpUiApi } from "./api";
import { CasePanel } from "./CasePanel";
import type { DecisionCase } from "../contracts/index.js";
import type { ResearchScope } from "../contracts/research.js";
import { ResearchPanel, ResearchRunSources } from "./ResearchPanel";
import { createResearchCommands } from "./research-commands";
import { IndustrialDesk } from "./IndustrialDesk";
import { createIndustrialCommands } from "./pending-commands";
import { runStatusLabel } from "./research";
import { ExecutionTrace as Trace } from "./ExecutionTrace";

type Tab = "briefing" | "actions" | "watchtower" | "pending" | "running" | "done" | "watches";
type IconName = "bell" | "cycle" | "check" | "watch" | "document" | "building" | "branch" | "arrow" | "clock" | "send" | "close";
const iconPaths: Record<IconName, string> = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  cycle: "M20 11a8 8 0 1 0-2 6M20 3v8h-8",
  check: "M8 12l3 3 5-6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  watch: "M5 3h3v5H5zM16 3h3v5h-3zM4 8l-2 9a3 3 0 0 0 6 1l1-7h6l1 7a3 3 0 0 0 6-1l-2-9M9 15h6",
  document: "M5 2h10l4 4v16H5zM14 2v6h5M8 12h8M8 16h8",
  building: "M5 22V3h12v19M2 22h20M9 7h1M13 7h1M9 11h1M13 11h1M9 15h1M13 15h1M10 22v-3h3v3",
  branch: "M12 22V12M12 12L4 4M12 12l8-8M1 4h6v6M17 4h6v6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 6v6l4 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  send: "M22 2L9 15M22 2l-8 20-5-7-7-5z",
  close: "M6 6l12 12M18 6L6 18",
};

function Icon({ name }: { name: IconName }): ReactElement {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }): ReactElement {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }): ReactElement {
  return <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}

function errorText(error: unknown): string {
  if (error instanceof UiError) return error.uncertain ? `${error.message} The command outcome is uncertain. Refresh before retrying.` : error.message;
  return "The service is unavailable. Check the connection and retry.";
}

function Sources({ sources, onExamine }: { sources: SourceView[]; onExamine?: (source: SourceView) => void }): ReactElement {
  return <section className="sources" aria-label="Sources and dates"><h3><Icon name="document" /> Sources and dates</h3>
    {sources.length === 0 ? <p className="muted">No source received for this view.</p> : sources.map(source => {
      const url = safeSourceUrl(source.url);
      return <article key={source.id} className="source-row"><div className="line-wrap"><strong>{source.title}</strong>
        <Badge>{({ public: "Public source", company: "Company data", synthetic: "Synthetic source" })[source.kind]}</Badge>
        <Badge tone={source.status === "error" ? "danger" : source.status === "partial" ? "warning" : "neutral"}>{({ success: "Received", empty: "No results", partial: "Partial", error: "Failed", not_run: "Not read" })[source.status]}</Badge></div>
        {source.mode && <Badge>{({ direct: "Direct collection", replay: "Replay", test: "Synthetic test" })[source.mode]}</Badge>}
        {source.note && <p>{source.note}</p>}
        <p className="source-dates">Published: {formatDate(source.publishedAt)} · Collection: {formatDate(source.collectedAt)}</p>
        {url && <a href={url} target="_blank" rel="noopener noreferrer">Read source <span aria-hidden="true">↗</span></a>}
        {source.evidenceRef && onExamine && <div><button className="text-button" onClick={() => onExamine(source)}>Examine this signal <Icon name="arrow" /></button></div>}
      </article>;
    })}
    <p className="source-caution">Public evidence does not confirm a delay to a company order.</p>
  </section>;
}

function ProposalDetail({ proposal, workspace, fresh, busy, onDecision, onResearch }: {
  proposal: ProposalView; workspace: WorkspaceView; fresh: boolean; busy: boolean;
  onDecision: (proposal: ProposalView, option: OptionView | undefined, action: "approve" | "reject") => void;
  onResearch?: (profileId: string, namespace: ResearchScope["namespace"]) => void;
}): ReactElement {
  const [selection, setSelection] = useState<string>(proposal.decisionOptionId ?? "");
  const option = proposal.options.find(value => value.id === selection);
  const stale = isProposalStale(proposal, workspace.company) || proposal.caseCurrent === false;
  const actionable = proposal.status === "pending" && !stale && !proposal.decisionBlockedReason && fresh && workspace.company.canDecide && !busy;
  return <article className="proposal-detail">
    <div className="proposal-meta"><Badge tone={stale ? "warning" : "info"}>{stale ? "Stale proposal" : proposal.status === "pending" ? "Needs decision" : proposal.status === "approved" ? "Approved" : "Rejected"}</Badge><Badge>{originLabel(proposal.dataOrigin)}</Badge>{proposal.executionMode && <Badge>{({ direct: "Live analysis", replay: "Replay", test: "Test analysis" })[proposal.executionMode]}</Badge>}</div>
    <h2>{proposal.title}</h2><p className="proposal-summary">{proposal.summary}</p>
    <p className="muted small">{formatDate(proposal.createdAt)} · Revision {proposal.revision} · Policy {proposal.policyVersion}</p>
    {stale && <Notice tone="warning">The context has changed. Recalculate this proposal before approval.</Notice>}
    {proposal.decisionBlockedReason && <Notice tone="warning">{proposal.decisionBlockedReason}</Notice>}
    <Sources sources={proposal.sources} />
    {proposal.testOnly && <Notice tone="warning">Controlled test research. This proposal is based on explicit test observations.</Notice>}
    {proposal.researchDependencies && <details className="trace"><summary>Saved research basis</summary>{proposal.researchDependencies.map((value, index) => <div key={index}><p className="small">{value.scope.profileId} · Profile {value.scope.profileVersion} · Generation {value.generation} · {value.scope.namespace}</p><p className="muted small">Valid until: {formatDate(value.validUntil ?? undefined)}</p>{onResearch && <button className="text-button" onClick={() => onResearch(value.scope.profileId, value.scope.namespace)}>Saved research</button>}</div>)}</details>}
    {proposal.approvalBlockedReason && <Notice tone="warning">{proposal.approvalBlockedReason}</Notice>}{proposal.caseRef && !proposal.approvalBlockedReason && <Notice>Inbound date confirmed in the simulation by the operator. Link to the public news remains unverified.</Notice>}
    {proposal.actualExposures && <section className="section-box"><h3>Current coverage</h3><p className="muted">Calculated from the saved company data, before the delay assumption.</p><ul className="exposure-list">{proposal.actualExposures.map(value => <li key={value.id}><strong>{value.label}</strong><span>{value.detail}</span><Badge>{value.state === "covered" ? "Covered" : value.state === "unknown" ? "Needs verification" : "Shortfall"}</Badge></li>)}</ul></section>}
    <section className="section-box"><h3><Icon name="building" /> {proposal.actualExposures ? "Coverage under this assumption" : "Our business exposure"}</h3><p className="muted">{proposal.actualExposures ? "Conditional calculation on synthetic data. This assumption does not change the saved stock or delivery date." : "Commitments examined by the business calculation."}</p>
      {proposal.exposures.length === 0 ? <p className="muted">No exposure provided.</p> : <ul className="exposure-list">{proposal.exposures.map(exposure => <li key={exposure.id}><strong>{exposure.label}</strong><span>{exposure.detail}</span><Badge tone={({ exposed: "danger", watch: "warning", covered: "good", unknown: "neutral" } as const)[exposure.state]}>{({ exposed: "Shortfall", watch: "Monitor", covered: "Covered", unknown: "Needs verification" })[exposure.state]}</Badge></li>)}</ul>}
    </section>
    <section className="decision-box"><h3><Icon name="branch" /> Proposed decision</h3><p className="muted">Compare the options, their conditions and calculated cost.</p>
      {proposal.conditions.length > 0 && <div className="proposal-reservations"><strong>Proposal conditions</strong><ul>{proposal.conditions.map((condition, index) => <li key={index}>{condition}</li>)}</ul></div>}
      {proposal.unknowns.length > 0 && <div className="proposal-reservations"><strong>Information still missing</strong><ul>{proposal.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul></div>}
      {proposal.constraints.length > 0 && <details className="evaluation-constraints"><summary>Calculation constraints</summary><ul>{proposal.constraints.map((constraint, index) => <li key={index}>{constraint}</li>)}</ul></details>}
      <fieldset className="options" disabled={!actionable}><legend className="sr-only">Choose an option</legend>{proposal.options.map(item => <label key={item.id} className={`option ${selection === item.id ? "option-selected" : ""}`}>
        <input type="radio" name={`option-${proposal.id}`} value={item.id} checked={selection === item.id} disabled={item.status === "blocked" || !actionable} onChange={() => setSelection(item.id)} />
        <span className="option-body"><span className="line-wrap"><strong>{item.title}</strong><Badge tone={item.status === "feasible" ? "good" : item.status === "conditional" ? "warning" : "danger"}>{({ feasible: "Feasible", conditional: "Conditional", blocked: "Not feasible" })[item.status]}</Badge>{item.id === proposal.decisionOptionId && <Badge tone="info">Proposed option</Badge>}</span>
          <span className="option-summary">{item.summary}</span>
          {item.costEur !== undefined && <span className="option-cost">Total cost: {formatMoney(item.costEur)}</span>}
          {item.facts.length > 0 && <dl>{item.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
          {item.conditions.length > 0 && <span className="conditions"><strong>Conditions to verify</strong><ul>{item.conditions.map((condition, index) => <li key={`${index}-${condition}`}>{condition}</li>)}</ul></span>}
        </span>
      </label>)}</fieldset>
      {proposal.options.length === 0 && <p>No options received. A new analysis is needed.</p>}
      {proposal.status === "pending" && <><div className="decision-actions"><button className="button primary" disabled={!actionable || Boolean(proposal.approvalBlockedReason) || !option || option.status !== "feasible" || option.id !== proposal.decisionOptionId} onClick={() => onDecision(proposal, option, "approve")}><Icon name="check" /> Review approval</button>
        <button className="button quiet" disabled={!actionable} onClick={() => onDecision(proposal, undefined, "reject")}>Reject proposal</button></div>
        <p className="muted small">Approval applies to the simulation. The server checks permissions and current versions.</p>
        {option?.status === "conditional" && <Notice tone="warning">This option remains conditional. A new evaluation must resolve its conditions.</Notice>}
        {option && option.id !== proposal.decisionOptionId && <p className="muted small">To select another option, request a new proposal.</p>}
        {!workspace.company.canDecide && <p className="muted small">Your session cannot make this decision.</p>}</>}
      {proposal.decisionNote && <Notice tone="info">{proposal.decisionNote}</Notice>}
    </section><Trace tools={proposal.tools} />
  </article>;
}

function Confirmation({ input, option, busy, error, onClose, onConfirm }: {
  input: DecisionInput; option: OptionView | undefined; busy: boolean; error: string;
  onClose: () => void; onConfirm: () => Promise<void>;
}): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className="confirmation" aria-labelledby="confirm-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="line-wrap"><Badge tone="info">Human decision</Badge><button className="icon-button" aria-label="Close confirmation" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="confirm-title">{input.action === "approve" ? "Approve this simulation?" : "Reject this proposal?"}</h2>
    {option && <><p><strong>{option.title}</strong></p>{option.costEur !== undefined && <p>Calculated cost: {formatMoney(option.costEur)}</p>}</>}
    <p className="muted">Revision {input.revision} · Policy {input.policyVersion}. The server can refuse if the context has changed.</p>
    {error && <Notice tone="danger">{error}</Notice>}
    <div className="decision-actions"><button className="button primary" disabled={busy} onClick={() => { void onConfirm(); }}>{busy ? "Checking…" : input.action === "approve" ? "Confirm approval" : "Confirm rejection"}</button><button className="button secondary" disabled={busy} onClick={onClose}>Cancel</button></div>
  </dialog>;
}

export function App({ api, previewLabel, initialTab = "briefing" }: { api: UiApi; previewLabel?: string; initialTab?: "briefing" | "pending" }): ReactElement {
  useEffect(() => { document.title = "Physical Impact"; }, []);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [researchCommands] = useState(createResearchCommands);
  const [industrialCommands] = useState(createIndustrialCommands);
  const [industrialCompany, setIndustrialCompany] = useState("");
  const [industrialRun, setIndustrialRun] = useState<RunView | null>(null);
  const [industrialRunError, setIndustrialRunError] = useState("");
  const [fresh, setFresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selected, setSelected] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [draftSource, setDraftSource] = useState<SourceView | undefined>();
  const [selectedResearch, setSelectedResearch] = useState<{ profileId: string; namespace: ResearchScope["namespace"] } | null>(null);
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [cadence, setCadence] = useState(15);
  const [watchCapabilities, setWatchCapabilities] = useState<WatchCapabilitiesView | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState("");
  const [capabilitiesAttempt, setCapabilitiesAttempt] = useState(0);
  const [sending, setSending] = useState<"question" | "watch" | null>(null);
  const [commandError, setCommandError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmation, setConfirmation] = useState<{ input: DecisionInput; option?: OptionView } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const operationKeys = useRef(new Map<string, string>());
  const refreshNumber = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const number = ++refreshNumber.current;
    try {
      const result = await api.readWorkspace(signal);
      if (mounted.current && !signal?.aborted && number === refreshNumber.current) { setWorkspace(result); setFresh(true); setLoadError(""); }
    } catch (error) {
      if (mounted.current && !signal?.aborted && number === refreshNumber.current) { setLoadError(errorText(error)); setFresh(false); }
    } finally { if (mounted.current && !signal?.aborted && number === refreshNumber.current) setLoading(false); }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function tick(): Promise<void> {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(() => { void tick(); }, 5000);
    }
    void tick();
    return () => { mounted.current = false; controller.abort(); clearTimeout(timer); };
  }, [refresh]);

  useEffect(() => { setIndustrialCompany(""); setIndustrialRun(null); setIndustrialRunError(""); }, [workspace?.company.id, workspace?.company.actor?.id, workspace?.company.actor?.role]);
  useEffect(() => {
    if (!industrialRun || !api.readIndustrialRun || !["queued", "running"].includes(industrialRun.status)) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const identifier = industrialRun.id;
    async function tick(): Promise<void> {
      try { const value = await api.readIndustrialRun!(identifier, controller.signal); if (controller.signal.aborted) return; setIndustrialRun(value); setIndustrialRunError(""); if (!["queued", "running"].includes(value.status)) return; }
      catch (error) { if (controller.signal.aborted) return; setIndustrialRunError(errorText(error)); }
      if (!controller.signal.aborted) timer = setTimeout(() => { void tick(); }, 2500);
    }
    timer = setTimeout(() => { void tick(); }, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [api, industrialRun?.id, industrialRun?.status, workspace?.company.id, workspace?.company.actor?.id, workspace?.company.actor?.role]);

  useEffect(() => {
    if (!api.readWatchCapabilities) return;
    const controller = new AbortController();
    setWatchCapabilities(null); setCapabilitiesError("");
    async function loadCapabilities(): Promise<void> {
      try {
        const result = await api.readWatchCapabilities!(controller.signal);
        if (controller.signal.aborted) return;
        setWatchCapabilities(result);
        setTopic(result.publicTopics[0]!);
        setSourceUrl(current => { const urls = result.profiles?.find(profile => profile.publicTopic === result.publicTopics[0])?.sourceUrls ?? result.sourceUrls; return urls.includes(current) ? current : urls[0]!; });
        setCadence(current => Math.max(result.minimumCadenceMinutes, Math.min(current, result.maximumCadenceMinutes)));
      } catch (error) { if (!controller.signal.aborted) setCapabilitiesError(errorText(error)); }
    }
    void loadCapabilities();
    return () => controller.abort();
  }, [api, capabilitiesAttempt]);

  function operationKey(descriptor: string): string {
    const prior = operationKeys.current.get(descriptor);
    if (prior) return prior;
    const key = crypto.randomUUID(); operationKeys.current.set(descriptor, key); return key;
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = question.trim(); if (!value || !fresh || sending) return;
    setSending("question"); setCommandError(""); setFeedback("");
    try {
      const industrial = tab === "briefing" || industrialCompany === workspace?.company.id;
      const descriptor = industrial ? JSON.stringify(["industrial-question", workspace?.company.id, workspace?.company.actor?.id, workspace?.company.actor?.role, value]) : `question:${value}`;
      if (industrial) { if (!api.readIndustrial || !api.askIndustrialQuestion) throw new UiError("NOT_READY", "Company questions are not connected yet."); await api.readIndustrial(); }
      const run = industrial ? await api.askIndustrialQuestion!({ question: value, idempotencyKey: operationKey(descriptor) }) : await api.askQuestion({ question: value, idempotencyKey: operationKey(descriptor) });
      if (!mounted.current) return;
      operationKeys.current.delete(descriptor); setQuestion("");
      if (industrial) { setIndustrialRun(run); setIndustrialRunError(""); setFeedback("Company question recorded. Its received answer and tool results appear below."); }
      else { setFeedback("Request recorded. Follow its status in Analyses."); setTab("running"); }
      await refresh();
    } catch (error) { if (mounted.current) setCommandError(errorText(error)); }
    finally { if (mounted.current) setSending(null); }
  }

  async function submitWatch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = topic.trim(); const source = safeSourceUrl(sourceUrl.trim()); if (!value || !source || !fresh || sending) return;
    setSending("watch"); setCommandError(""); setFeedback("");
    try {
      const watch = await api.createWatch({ topic: value, sourceUrls: [source], cadenceMinutes: cadence, idempotencyKey: operationKey(`watch:${value}:${cadence}:${source}`) });
      if (!mounted.current) return;
      setFeedback(watch.status === "active" ? "Watch activated by the server." : "Watch saved. Check its status."); if (!api.readWatchCapabilities) { setTopic(""); setSourceUrl(""); } setTab("watches"); await refresh();
    } catch (error) { if (mounted.current) setCommandError(errorText(error)); }
    finally { if (mounted.current) setSending(null); }
  }

  async function openSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (!api.openSession || !sessionToken || sessionBusy) return;
    setSessionBusy(true); setCommandError("");
    try { await api.openSession(sessionToken); if (mounted.current) { setFeedback("Signed in."); await refresh(); } }
    catch (error) { if (mounted.current) setCommandError(errorText(error)); }
    finally { if (mounted.current) { setSessionToken(""); setSessionBusy(false); } }
  }

  async function closeSession(): Promise<void> {
    if (!api.closeSession || sessionBusy) return;
    setSessionBusy(true); setCommandError("");
    try { await api.closeSession(); if (mounted.current) { setConfirmation(null); setFeedback("Signed out."); await refresh(); } }
    catch (error) { if (mounted.current) setCommandError(errorText(error)); }
    finally { if (mounted.current) setSessionBusy(false); }
  }

  function prepareDecision(proposal: ProposalView, option: OptionView | undefined, action: "approve" | "reject"): void {
    setDecisionError("");
    setConfirmation({ input: { proposalId: proposal.id, ...(option ? { optionId: option.id } : {}), action, revision: proposal.revision, policyVersion: proposal.policyVersion, idempotencyKey: operationKey(`decision:${proposal.id}:${option?.id ?? ""}:${action}:${proposal.revision}:${proposal.policyVersion}`) }, ...(option ? { option } : {}) });
  }

  async function confirmDecision(): Promise<void> {
    if (!confirmation || deciding) return;
    setDeciding(true); setDecisionError("");
    try {
      const result = await api.decide(confirmation.input);
      if (!mounted.current) return;
      setFeedback(result.message); setConfirmation(null); await refresh();
    } catch (error) {
      if (!mounted.current) return;
      setDecisionError(errorText(error));
      if (error instanceof UiError && ["STALE_CONTEXT", "STALE_REVISION", "CONFLICT"].includes(error.code)) { setConfirmation(null); setCommandError(errorText(error)); await refresh(); }
    } finally { if (mounted.current) setDeciding(false); }
  }

  const pending = workspace?.proposals.filter(proposal => ["pending", "stale"].includes(proposal.status)) ?? [];
  const done = workspace?.proposals.filter(proposal => ["approved", "rejected"].includes(proposal.status)) ?? [];
  const runs = workspace?.runs ?? [];
  const canCommand = fresh && workspace?.company.actor !== null && workspace?.company.actor !== undefined && !sessionBusy;
  const watchReady = !api.readWatchCapabilities || watchCapabilities !== null;
  const availableSourceUrls = watchCapabilities?.profiles?.find(profile => profile.publicTopic === topic)?.sourceUrls ?? watchCapabilities?.sourceUrls ?? [];
  const cadenceOptions = watchCapabilities ? [...new Set([watchCapabilities.minimumCadenceMinutes, 5, 15, 30, 60, 120, 1440, 10080, cadence])].filter(value => value >= watchCapabilities.minimumCadenceMinutes && value <= watchCapabilities.maximumCadenceMinutes).sort((a, b) => a - b) : [15, 30, 60];
  const proposals = tab === "done" ? done : pending;
  const currentCase = workspace?.cases.find(value => value.id === selectedCase);
  const caseOpen = Boolean(currentCase || draftSource);
  const casesAvailable = Boolean(api.createCase && api.reviseCase && api.analyzeCase && api.readCase);
  const researchProfile = watchCapabilities?.profiles?.find(profile => profile.id === selectedResearch?.profileId);
  const researchOpen = Boolean(selectedResearch && researchProfile && api.readResearch);
  const detailOpen = caseOpen || researchOpen;
  function openResearch(profileId: string, namespace: ResearchScope["namespace"] = "live"): void {
    if (!watchCapabilities?.profiles?.some(profile => profile.id === profileId)) { setCommandError("This research profile is no longer advertised. Reload the available profiles."); return; }
    setSelectedResearch({ profileId, namespace });
  }
  const proposal = proposals.find(value => value.id === selected) ?? proposals[0];
  const nav: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: "briefing", label: "Overview", icon: "building" },
    { id: "actions", label: "Actions", icon: "check" },
    { id: "watchtower", label: "Watchtower", icon: "watch" },
    { id: "pending", label: "Needs decision", icon: "bell", count: pending.length }, { id: "running", label: "Analyses", icon: "cycle", count: runs.length },
    { id: "done", label: "Saved decisions", icon: "check", count: done.length }, { id: "watches", label: "Watches", icon: "watch", count: workspace?.watches.length ?? 0 },
  ];

  const productTab = ["briefing", "actions", "watchtower"].includes(tab);
  return <div className={`app-shell ${productTab ? "pi-shell" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {previewLabel && previewLabel !== "Demo" && <div className="preview-banner" role="status">{previewLabel}</div>}
    <header className="topbar"><div className="app-title"><span className="app-mark"><Icon name="branch" /></span><div className="brand-copy"><h1>Physical Impact</h1><p>Adapt as fast as your market changes.</p></div></div><div className="company-name">{workspace?.company.name ?? "Company context"}</div>
      <div className="header-context">{previewLabel === "Demo" && <Badge>Demo</Badge>}{workspace && <>{previewLabel !== "Demo" && <Badge tone="info">{originLabel(workspace.company.dataOrigin)}</Badge>}<span className="small muted">Revision {workspace.company.revision}</span></>}<button className="button refresh-button" aria-label="Refresh" disabled={loading} onClick={() => { setLoading(true); void refresh(); }}><Icon name="cycle" /><span>Refresh</span></button></div>
      {workspace?.company.actor && <span className="actor" title={workspace.company.actor.role}>{workspace.company.actor.name}{api.closeSession && <button className="session-close" disabled={sessionBusy} onClick={() => { void closeSession(); }}>Sign out</button>}</span>}
    </header>
    <div className="workspace-grid"><nav className="sidebar" aria-label="Decision workspace">{nav.filter(item => ["briefing", "actions", "watchtower"].includes(item.id)).map(item => <button key={item.id} className={`nav-item ${tab === item.id ? "nav-active" : ""}`} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setSelected(""); setSelectedCase(""); setDraftSource(undefined); setSelectedResearch(null); }}><Icon name={item.icon} /><span>{item.label}</span>{item.count !== undefined && <span className="count">{item.count}</span>}</button>)}
      <details className="pi-legacy-toggle"><summary>Advanced workspace</summary><div className="pi-legacy-nav">{nav.filter(item => !["briefing", "actions", "watchtower"].includes(item.id)).map(item => <button className="nav-item" key={item.id} onClick={() => { setTab(item.id); setSelectedCase(""); setDraftSource(undefined); setSelectedResearch(null); }}>{item.label}</button>)}</div></details>
      <div className="sidebar-note"><span className="eyebrow">PHYSICAL IMPACT</span><p>{workspace ? formatDate(workspace.company.asOf) : loadError ? "Context unavailable" : "Loading…"}</p><p>Your business. Your next move.</p>{previewLabel === "Demo" && <button className="pi-text-button" onClick={() => { try { resetPhysicalDemo(); } catch { setCommandError("The demo could not be restarted. Refresh the page and try again."); } }}>Restart demo</button>}</div></nav>
    <main id="main-content" tabIndex={-1} className="main-content">
      {loadError && <Notice tone="danger">{loadError} {workspace ? "Showing the last received data. Commands are suspended." : "No company data received."}</Notice>}
      {commandError && <Notice tone="danger">{commandError}</Notice>}{feedback && <Notice tone="info">{feedback}</Notice>}
      {workspace && researchOpen && researchProfile && selectedResearch && <ResearchPanel key={`${workspace.company.id}:${researchProfile.id}:${selectedResearch.namespace}`} profile={researchProfile} initialNamespace={selectedResearch.namespace} workspace={workspace} api={api} commands={researchCommands} fresh={fresh && !sessionBusy} onClose={() => setSelectedResearch(null)} onAnalysis={async (): Promise<void> => { await refresh(); }} />}
      {workspace && caseOpen && !researchOpen && <CasePanel key={currentCase?.id ?? JSON.stringify(draftSource?.evidenceRef)} current={currentCase} source={draftSource} workspace={workspace} api={api} fresh={fresh && !sessionBusy} onClose={() => { setSelectedCase(""); setDraftSource(undefined); }} onSaved={async (value: DecisionCase): Promise<void> => { setSelectedCase(value.id); setDraftSource(undefined); setFeedback("Case version saved. Previous proposals must be re-evaluated after a revision."); await refresh(); }} onAnalyzed={async (): Promise<void> => { await refresh(); }} onResearch={api.readResearch ? openResearch : undefined} onProposal={identifier => { setSelectedCase(""); setDraftSource(undefined); setSelected(identifier); setTab(workspace.proposals.find(value => value.id === identifier)?.status === "approved" || workspace.proposals.find(value => value.id === identifier)?.status === "rejected" ? "done" : "pending"); }} />}
      {workspace && !workspace.company.actor && api.openSession && <section className="session-panel"><h2>Open a business session</h2><p className="muted small">Enter the access code supplied by the operator to ask a question or make a decision.</p><form onSubmit={event => { void openSession(event); }}><label htmlFor="session-token" className="sr-only">Access code</label><input id="session-token" type="password" autoComplete="off" value={sessionToken} onChange={event => setSessionToken(event.target.value)} maxLength={512} required disabled={sessionBusy} /><button className="button primary" disabled={sessionBusy || !sessionToken}>Sign in</button></form></section>}
      {loading && !workspace ? <section className="empty-state" aria-live="polite"><span className="loading-dot" /><h2>Reading company context</h2><p>Loading commitments and saved decisions.</p></section> : workspace && <>
        {!detailOpen && productTab && <IndustrialDesk key={`${workspace.company.id}:${workspace.company.actor?.id ?? "none"}:${workspace.company.actor?.role ?? "none"}`} api={api} company={workspace} browserDemo={previewLabel === "Demo"} page={tab === "actions" ? "actions" : tab === "watchtower" ? "watchtower" : "overview"} commands={industrialCommands} fresh={fresh && !sessionBusy} onConnected={setIndustrialCompany} onAfterMutation={async (): Promise<void> => { await refresh(); }} onLegacy={() => setTab("pending")} />}
        {!detailOpen && tab === "pending" && workspace.cases.length > 0 && <section className="decision-panel"><div className="panel-top"><h2>Signals to examine</h2></div><div className="record-list">{workspace.cases.map(value => <article key={value.id} className="record"><div className="line-wrap"><Badge tone={value.impactKind === "risk" ? "warning" : "neutral"}>{value.impactKind === "risk" ? value.confirmation ? "Risk · Internal confirmation" : "Risk · Conditional" : "Impact undetermined"}</Badge><Badge>{value.qualification === "no_known_exposure" ? "No known exposure" : "Needs verification"}</Badge></div>{value.testOnly && <Badge tone="warning">Controlled test</Badge>}<h3>{value.observation.title}</h3><button className="text-button" onClick={() => { setSelectedCase(value.id); setDraftSource(undefined); }}>Open case <Icon name="arrow" /></button></article>)}</div></section>}
        {!detailOpen && (tab === "pending" || tab === "done") && <section className="decision-panel"><div className="panel-top"><span>{tab === "pending" ? "Decision workspace" : "Saved decisions"}</span><span className="muted small">{proposals.length} proposal{proposals.length > 1 ? "s" : ""}</span></div>
          {proposals.length > 1 && <div className="proposal-switcher" aria-label="Proposals">{proposals.map(item => <button key={item.id} className={`proposal-tab ${proposal?.id === item.id ? "selected" : ""}`} aria-pressed={proposal?.id === item.id} onClick={() => setSelected(item.id)}>{item.title}</button>)}</div>}
          {proposal ? <ProposalDetail key={`${proposal.id}:${proposal.revision}:${proposal.policyVersion}`} proposal={proposal} workspace={workspace} fresh={fresh} busy={deciding} onDecision={prepareDecision} onResearch={api.readResearch ? openResearch : undefined} /> : <div className="empty-state"><Icon name="check" /><h2>{tab === "pending" ? "No decisions waiting" : "No saved decisions"}</h2><p>{tab === "pending" ? "Ask a question or examine a watch to prepare a proposal with evidence." : "Approvals and rejections appear here after server confirmation."}</p></div>}
        </section>}
        {!detailOpen && tab === "running" && <section className="decision-panel"><div className="panel-top"><h2>Analyses</h2><Badge>{runs.length}</Badge></div>{runs.length === 0 ? <div className="empty-state"><h3>No analyses received</h3><p>Ask a question to start an analysis.</p></div> : <div className="record-list">{runs.map(run => <article key={run.id} className="record"><div className="line-wrap"><Badge tone={["error", "budget_exhausted", "uncertain"].includes(run.status) ? "warning" : "info"}>{runStatusLabel(run)}</Badge>{run.executionMode && <Badge>{({ direct: "Live analysis", replay: "Replay", test: "Test analysis" })[run.executionMode]}</Badge>}<span className="muted small">{formatDate(run.createdAt)}</span></div>{run.researchScope?.namespace === "controlled" && <Badge tone="warning">Controlled test</Badge>}<h3>{run.question}</h3>{run.researchScope && <><p className="small">Research profile: {watchCapabilities?.profiles?.find(value => value.id === run.researchScope?.profileId)?.label ?? run.researchScope.profileId}</p>{run.researchResult && <p>{run.researchResult.observations.length} retained source observation(s). A research result does not imply a business proposal.</p>}{api.readResearch && <button className="text-button" onClick={() => openResearch(run.researchScope!.profileId, run.researchScope!.namespace)}>Saved research</button>}</>}{run.researchScope && <ResearchRunSources run={run} />}{run.model && <p>Model: {run.model}</p>}{run.message && <p>{run.message}</p>}{run.proposalId && <button className="text-button" onClick={() => { setSelected(run.proposalId ?? ""); setTab(workspace.proposals.find(value => value.id === run.proposalId)?.status === "approved" || workspace.proposals.find(value => value.id === run.proposalId)?.status === "rejected" ? "done" : "pending"); }}>View proposal <Icon name="arrow" /></button>}<Trace tools={run.tools} /></article>)}</div>}</section>}
        {!detailOpen && tab === "watches" && <section className="decision-panel"><div className="panel-top"><h2>Saved watches</h2><Badge>{workspace.watches.length}</Badge></div>{workspace.watches.length === 0 ? <div className="empty-state"><Icon name="watch" /><h3>No saved watches</h3><p>Choose a public topic in New watch.</p></div> : <div className="record-list">{workspace.watches.map(watch => <article key={watch.id} className="record"><div className="line-wrap"><Badge tone={watch.status === "active" ? "good" : "warning"}>{({ active: "Active", draft: "Draft", paused: "Paused", error: "Error" })[watch.status]}</Badge><span className="muted small">Every {watch.cadenceMinutes} min</span></div><h3>{publicTopicLabel(watch.topic)}</h3><p>Last check: {formatDate(watch.lastCheckedAt)}</p><p>Next check: {formatDate(watch.nextCheckAt)}</p>{watch.message && <p>{watch.message}</p>}{api.readResearch && watchCapabilities?.profiles?.find(value => value.publicTopic === watch.topic) && <button className="text-button" onClick={() => openResearch(watchCapabilities!.profiles!.find(value => value.publicTopic === watch.topic)!.id)}>Saved research</button>}<Sources sources={watch.sources} onExamine={casesAvailable ? value => { setSelectedCase(""); setDraftSource(value); } : undefined} /></article>)}</div>}</section>}
      </>}
      {!researchOpen && !productTab && <section className="question-panel"><div className="section-heading"><h2>What would you like to check?</h2><span className="eyebrow">Ask the agent</span></div>
        <form onSubmit={event => { void submitQuestion(event); }}><label className="sr-only" htmlFor="question">Your business question</label><textarea id="question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={3000} rows={2} placeholder="Which orders could be delayed? Which options preserve our commitments?" required disabled={!canCommand || sending === "question"} />
          <div className="question-footer"><span className="muted small">Sources and calculations stay available.</span><button className="button primary" type="submit" disabled={!canCommand || !question.trim() || sending !== null || Boolean(industrialRun && ["queued", "running"].includes(industrialRun.status))}><Icon name="send" />{sending === "question" ? "Sending…" : "Analyze"}</button></div></form>
        {industrialRun && <article className="record industrial-answer" aria-label="Company question result"><div className="line-wrap"><Badge tone={["error", "budget_exhausted", "uncertain", "stale_context"].includes(industrialRun.status) ? "warning" : "info"}>{runStatusLabel(industrialRun)}</Badge>{industrialRun.executionMode && <Badge>{({ direct: "Model response", replay: "Replay", test: "Test analysis" })[industrialRun.executionMode]}</Badge>}<span className="small muted">{formatDate(industrialRun.createdAt)}</span></div><h3>{industrialRun.question}</h3>{industrialRun.message && <p>{industrialRun.message}</p>}{industrialRunError && <p className="notice notice-warning" role="alert">Current analysis state unavailable. Showing the last received answer. {industrialRunError}</p>}<Trace tools={industrialRun.tools} />{industrialRun.industrialReportId && <button className="text-button" onClick={() => setTab("briefing")}>Read the saved company briefing</button>}</article>}
      </section>}
    </main>
    <aside className="rightbar">{tab === "briefing" ? <section className="watch-panel"><h2>Your environment</h2><p className="muted">Saved watches keep their received state. The briefing shows the reports actually prepared.</p>{workspace?.watches.map(watch => <article className="record" key={watch.id}><strong>{publicTopicLabel(watch.topic)}</strong><p className="small">{watch.status} · Last check {formatDate(watch.lastCheckedAt)}</p></article>)}<button className="button secondary full-width" onClick={() => setTab("watches")}>Manage watches</button></section> : <section className="watch-panel"><h2><Icon name="watch" /> New watch</h2><p className="muted">{api.readWatchCapabilities ? "Choose a public topic available on the server." : "Describe a public topic to monitor."}</p>
      {capabilitiesError && <><Notice tone="warning">Watch topics are unavailable. {capabilitiesError}</Notice><button className="text-button" onClick={() => setCapabilitiesAttempt(value => value + 1)}>Retry topics</button></>}
      <form onSubmit={event => { void submitWatch(event); }}><label htmlFor="watch-topic">Public topic</label>{api.readWatchCapabilities ? <select id="watch-topic" value={topic} onChange={event => { const value = event.target.value; setTopic(value); const urls = watchCapabilities?.profiles?.find(profile => profile.publicTopic === value)?.sourceUrls ?? watchCapabilities?.sourceUrls ?? []; setSourceUrl(current => urls.includes(current) ? current : urls[0] ?? ""); }} required disabled={!canCommand || !watchReady || sending === "watch"}>{!watchCapabilities && <option value="">Loading topics…</option>}{watchCapabilities?.publicTopics.map(value => <option key={value} value={value}>{watchCapabilities?.profiles?.find(profile => profile.publicTopic === value)?.label ?? publicTopicLabel(value)}</option>)}</select> : <textarea id="watch-topic" value={topic} onChange={event => setTopic(event.target.value)} minLength={3} maxLength={200} rows={4} placeholder="Production d’isolants en France et perturbations publiques" required disabled={!canCommand || sending === "watch"} />}
        <label htmlFor="watch-source">Public source to read</label>{api.readWatchCapabilities ? <select id="watch-source" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} required disabled={!canCommand || !watchReady || sending === "watch"}>{!watchCapabilities && <option value="">Loading sources…</option>}{availableSourceUrls.map(value => <option key={value} value={value}>{new URL(value).hostname === "www.boamp.fr" ? "BOAMP, public notices" : new URL(value).hostname}</option>)}</select> : <input id="watch-source" type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://…" required maxLength={2000} disabled={!canCommand || sending === "watch"} />}
        <label htmlFor="watch-cadence">Requested frequency</label><select id="watch-cadence" value={cadence} onChange={event => setCadence(Number(event.target.value))} disabled={!canCommand || !watchReady || sending === "watch"}>{cadenceOptions.map(value => <option key={value} value={value}>{value === 60 ? "Every hour" : value === 1440 ? "Every day" : value === 10080 ? "Every week" : `Every ${value} minutes`}</option>)}</select>
        <div className="watch-draft"><Icon name="document" /><div><strong>Needs confirmation</strong><p>The topic is sent to a public source. Use public terms only, without customer or order data.</p></div></div>
        <button className="button primary full-width" type="submit" disabled={!canCommand || !watchReady || topic.trim().length < 3 || !safeSourceUrl(sourceUrl.trim()) || sending !== null}>{sending === "watch" ? "Saving…" : "Confirm watch"}</button></form>
      {api.readResearch && watchCapabilities?.profiles?.find(value => value.publicTopic === topic) && <button className="text-button" disabled={!canCommand} onClick={() => openResearch(watchCapabilities!.profiles!.find(value => value.publicTopic === topic)!.id)}>Saved research for this profile <Icon name="arrow" /></button>}
      <div className="watch-footnote"><Icon name="clock" /><p>Status and the next check appear after server confirmation.</p></div>
    </section>}
    {workspace && workspace.memory.length > 0 && <section className="memory-panel"><h3>Company memory</h3>{workspace.memory.map(memory => <article key={memory.id}><p>{memory.text}</p><p className="muted small">{memory.author} · {formatDate(memory.createdAt)}</p><p className="small">Conditions: {memory.conditions}</p></article>)}</section>}
    <p className="rightbar-note">Context, sources and decisions stay linked to their version.</p></aside></div>
    {confirmation && <Confirmation input={confirmation.input} option={confirmation.option} busy={deciding} error={decisionError} onClose={() => setConfirmation(null)} onConfirm={confirmDecision} />}
  </div>;
}

export default function ConnectedApp(): ReactElement {
  const [demo] = useState(() => location.pathname === "/demo" || new URLSearchParams(location.search).get("demo") === "1");
  const [api] = useState<UiApi>(() => demo ? createPhysicalDemoApi() : createHttpUiApi());
  return <App api={api} previewLabel={demo ? "Demo" : undefined} />;
}
