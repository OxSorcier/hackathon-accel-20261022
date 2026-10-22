import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type { ResearchContext, ResearchObservation, ResearchScope } from "../contracts/research.js";
import type { RunView, UiApi, WatchCapabilitiesView, WorkspaceView } from "./types";
import { UiError } from "./types";
import { formatDate, safeSourceUrl } from "./format";
import { researchConditionLabel, researchStateLabel, runStatusLabel } from "./research";
import { ExecutionTrace } from "./ExecutionTrace";
import type { ResearchCommands } from "./research-commands";

type Profile = NonNullable<WatchCapabilitiesView["profiles"]>[number];

function errorMessage(error: unknown): string {
  return error instanceof UiError ? `${error.message}${error.uncertain ? " The outcome is uncertain. Reload the saved state before retrying." : ""}` : "Saved research could not be read. No successful result is confirmed.";
}

function Observation({ value }: { value: ResearchObservation }): ReactElement {
  const source = value.evidence; const url = safeSourceUrl(source.url);
  return <article className="research-observation"><div className="line-wrap"><strong>{source.title}</strong><span className="badge">Source observation only</span>{value.testOnly && <span className="badge badge-warning">Controlled test</span>}</div>
    <p className="small muted">Published: {formatDate(source.publishedAt ?? undefined)} · Collected: {formatDate(source.collectedAt)}</p>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">Read source ↗</a>}
    <details className="research-source-details"><summary>Source excerpt and references</summary><p className="case-content">{source.content}</p><dl className="research-refs"><div><dt>Evidence</dt><dd>{value.ref.evidenceId}</dd></div><div><dt>Occurrence</dt><dd>{value.ref.occurrenceId}</dd></div><div><dt>Content version</dt><dd>{value.ref.contentHash}</dd></div></dl>
      {source.provenance && <p className="muted small">{source.provenance.provider === "boamp" ? "BOAMP" : "Keenable"} · {({ search_snippet: "Search excerpt", fetch: "Fetched page", api_record: "API record" })[source.provenance.method]}{source.provenance.truncated ? " · Truncated" : ""}</p>}
      {source.regulation && <dl className="research-refs"><div><dt>Jurisdiction</dt><dd>{source.regulation.jurisdiction}</dd></div><div><dt>Entry into force</dt><dd>{formatDate(source.regulation.entryIntoForceAt ?? undefined, false)}</dd></div><div><dt>Applies from</dt><dd>{formatDate(source.regulation.appliesFrom ?? undefined, false)}</dd></div><div><dt>Deadline</dt><dd>{formatDate(source.regulation.deadlineAt ?? undefined, false)}</dd></div><div><dt>Applicability</dt><dd>Needs verification</dd></div></dl>}
    </details>
    {value.conditions.length > 0 && <ul className="small">{value.conditions.map((condition, index) => <li key={index}>{researchConditionLabel(condition)}</li>)}</ul>}
  </article>;
}

export function ResearchRunSources({ run }: { run: RunView }): ReactElement {
  return <>
    {run.researchDependencies?.map((dependency, index) => <p key={index} className="small muted">Profile {dependency.scope.profileVersion} · Generation {dependency.generation} · Valid until {formatDate(dependency.validUntil ?? undefined)}</p>)}
    {run.researchResult && <details className="research-source-details"><summary>Sources used by this analysis ({run.researchResult.observations.length})</summary>{run.researchResult.observations.map(value => <Observation key={JSON.stringify(value.ref)} value={value} />)}{run.researchResult.conditions.length > 0 && <ul className="small">{run.researchResult.conditions.map((value, index) => <li key={index}>{researchConditionLabel(value)}</li>)}</ul>}<p className="muted small">Analysis reference: {run.id}</p></details>}
  </>;
}

function ResearchRun({ run }: { run: RunView }): ReactElement {
  return <article className="research-history"><div className="line-wrap"><strong>{runStatusLabel(run)}</strong>{run.researchScope?.namespace === "controlled" && <span className="badge badge-warning">Controlled test</span>}</div><p className="small muted">{formatDate(run.createdAt)} · {run.question}</p>{run.message && <p className="small">{run.message}</p>}<ResearchRunSources run={run} /><ExecutionTrace tools={run.tools} /></article>;
}

export function ResearchPanel({ profile, initialNamespace = "live", workspace, api, commands, fresh, onClose, onAnalysis }: {
  profile: Profile; initialNamespace?: ResearchScope["namespace"]; workspace: WorkspaceView; api: UiApi; commands: ResearchCommands; fresh: boolean;
  onClose: () => void; onAnalysis: () => Promise<void>;
}): ReactElement {
  const [namespace, setNamespace] = useState<ResearchScope["namespace"]>(initialNamespace);
  const [context, setContext] = useState<ResearchContext | null>(null);
  const [reading, setReading] = useState(true);
  const [readError, setReadError] = useState("");
  const [sending, setSending] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [question, setQuestion] = useState("Retrieve saved research for this profile, with its exact sources, versions and conditions. Check existing knowledge before requesting any external refresh.");
  const [localRun, setLocalRun] = useState<RunView | null>(null);
  const requestNumber = useRef(0); const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const lifecycle = useRef(0);
  const prefix = useId();
  const actorName = workspace.company.actor?.name; const actorRole = workspace.company.actor?.role;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start" }); }, []);
  const read = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const number = ++requestNumber.current; setReading(true);
    try {
      if (!api.readResearch) throw new UiError("RESEARCH_UNAVAILABLE", "Saved research is not connected.");
      const value = await api.readResearch(profile.id, namespace, signal);
      if (mounted.current && !signal?.aborted && number === requestNumber.current) { setContext(value); setReadError(""); }
    } catch (error) { if (mounted.current && !signal?.aborted && number === requestNumber.current) setReadError(errorMessage(error)); }
    finally { if (mounted.current && !signal?.aborted && number === requestNumber.current) setReading(false); }
  }, [api, namespace, profile.id]);

  useEffect(() => {
    mounted.current = true; lifecycle.current++; setContext(null); setReadError(""); setFeedback(""); setCommandError(""); setLocalRun(null); setSending(false);
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function tick(): Promise<void> { await read(controller.signal); if (!controller.signal.aborted) timer = setTimeout(() => { void tick(); }, 5000); }
    void tick();
    return () => { mounted.current = false; lifecycle.current++; controller.abort(); clearTimeout(timer); requestNumber.current++; };
  }, [read, workspace.company.id, actorName, actorRole]);

  async function analyze(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!api.analyzeResearch || !context || !fresh || !workspace.company.canDecide || readError || sending || !question.trim() || context.state === "uncertain") return;
    const descriptor = JSON.stringify([workspace.company.id, workspace.company.actor?.id ?? actorName, actorRole, profile.id, namespace, question.trim()]);
    const generation = lifecycle.current;
    setSending(true); setCommandError(""); setFeedback("");
    try {
      const send = api.analyzeResearch;
      const run = await commands.execute(descriptor, async key => await send(profile.id, { namespace, question: question.trim(), idempotencyKey: key }));
      if (!mounted.current || generation !== lifecycle.current) return;
      setLocalRun(run); setFeedback("Research analysis request recorded. Its actual result appears below.");
      await Promise.all([read(), onAnalysis()]);
    } catch (error) { if (mounted.current && generation === lifecycle.current) setCommandError(errorMessage(error)); }
    finally { if (mounted.current && generation === lifecycle.current) setSending(false); }
  }
  const scopeRuns = workspace.runs.filter(run => run.researchScope?.profileId === profile.id && run.researchScope.namespace === namespace);
  const runs = localRun && !scopeRuns.some(run => run.id === localRun.id) ? [localRun, ...scopeRuns] : scopeRuns;
  const canAnalyze = fresh && workspace.company.canDecide && context !== null && !readError && !sending && context.state !== "uncertain";
  const controlled = namespace === "controlled";
  return <section className="decision-panel research-panel" aria-label="Saved research">
    <div className="panel-top"><h2 ref={heading} tabIndex={-1}>Saved research</h2><button className="text-button" onClick={onClose}>Back</button></div>
    <div className="proposal-detail"><div className="line-wrap"><span className="badge">{controlled ? "Controlled test" : "Live source records"}</span>{context && <span className={`badge ${context.state === "reusable" ? "badge-good" : "badge-warning"}`}>{researchStateLabel(context.state)}</span>}{context?.reused && <span className="badge badge-info">Reused</span>}</div><h2>{profile.label}</h2>
      <div className="research-controls"><label htmlFor={`${prefix}-namespace`}>Research records</label><select id={`${prefix}-namespace`} value={namespace} disabled={sending} onChange={event => { setContext(null); setLocalRun(null); setNamespace(event.target.value === "controlled" ? "controlled" : "live"); }}><option value="live">Live source records</option><option value="controlled">Controlled test records</option></select><button className="button secondary" disabled={reading || sending} onClick={() => { void read(); }}>{reading ? "Reading…" : "Reload saved research"}</button></div>
      {controlled && <div className="notice notice-warning" role="status">Controlled test records. These observations were supplied for an explicit test. They do not establish live business facts. Ingestion remains an operator action.</div>}
      {readError && <div className="notice notice-danger" role="alert">{readError} {context ? "Showing the last read. Analysis is suspended." : "No saved research was received."}</div>}
      {!context && reading && <p className="muted">Reading the saved research for this company and profile…</p>}
      {context && <><section className="section-box"><h3>What is already known</h3><p>{context.reason}</p><p className="small muted">Checked: {formatDate(context.checkedAt)} · Valid until: {formatDate(context.validUntil ?? undefined)}</p><p className="small muted">External source calls reported for this read: {context.externalCalls}. This count does not establish a saving.</p>
        <details className="research-source-details"><summary>Saved version and conditions</summary><p className="small">Profile version {context.scope.profileVersion} · Generation {context.generation} · {context.scope.namespace}</p>{context.conditions.length > 0 && <ul className="small">{context.conditions.map((value, index) => <li key={index}>{researchConditionLabel(value)}</li>)}</ul>}</details></section>
        <section className="sources"><h3>Sources retained</h3>{context.observations.length ? context.observations.map(value => <Observation key={JSON.stringify(value.ref)} value={value} />) : <p className="muted small">{context.state === "empty" ? "A saved search returned no source observations. This is not proof that no relevant source exists." : "No source observation is available in this saved state."}</p>}<p className="source-caution">A retained observation does not establish a company relationship, a supplier delay or regulatory applicability.</p></section>
        <section className="decision-box"><h3>Request an analysis</h3><p>The agent reads saved research first. It may request a source refresh when needed. A research result does not require a business proposal.</p><form onSubmit={event => { void analyze(event); }}><label className="sr-only" htmlFor={`${prefix}-question`}>Research question</label><textarea id={`${prefix}-question`} value={question} onChange={event => setQuestion(event.target.value)} disabled={!fresh || sending} maxLength={3000} rows={3} required /><button className="button primary" disabled={!canAnalyze || !question.trim()}>{sending ? "Sending…" : "Analyze this research"}</button></form>{context.state === "uncertain" && <p className="small">The refresh outcome is uncertain. Reconcile its saved state before a new attempt.</p>}</section>
      </>}
      {feedback && <div className="notice" role="status">{feedback}</div>}{commandError && <div className="notice notice-danger" role="alert">{commandError}</div>}
      {runs.length > 0 && <details className="trace" open><summary>Research analyses and source versions <span>{runs.length} loaded</span></summary><p className="muted small">These are the analyses loaded in this workspace, not a complete source archive. Each retains the sources and generations it used.</p>{runs.map(run => <ResearchRun key={run.id} run={run} />)}</details>}
    </div>
  </section>;
}
