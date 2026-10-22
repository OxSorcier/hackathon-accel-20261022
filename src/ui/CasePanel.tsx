import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type { CaseInput, DecisionCase } from "../contracts/index.js";
import { formatDate, safeSourceUrl } from "./format";
import { UiError } from "./types";
import type { SourceView, UiApi, WorkspaceView } from "./types";
import type { ResearchScope } from "../contracts/research.js";
import { runStatusLabel } from "./research";

interface CasePanelProps {
  current?: DecisionCase;
  source?: SourceView;
  workspace: WorkspaceView;
  api: UiApi;
  fresh: boolean;
  onSaved: (value: DecisionCase) => Promise<void>;
  onAnalyzed: () => Promise<void>;
  onProposal: (id: string) => void;
  onClose: () => void;
  onResearch?: (profileId: string, namespace: ResearchScope["namespace"]) => void;
}

function proofKey(value: SourceView): string {
  return JSON.stringify(value.evidenceRef);
}

function caseSource(value: DecisionCase): SourceView {
  return { id: value.observation.id, title: value.observation.title, kind: "public", status: "success", url: value.observation.url, observation: value.observation, evidenceRef: value.evidenceRef };
}

function commandError(error: unknown): string {
  return error instanceof UiError ? `${error.message}${error.uncertain ? " The outcome is uncertain. Refresh before retrying." : ""}` : "The service did not confirm the result. Refresh before retrying.";
}

function CaseForm({ current, source, workspace, api, disabled, onSaved, onCancel }: {
  current?: DecisionCase; source: SourceView; workspace: WorkspaceView; api: UiApi; disabled: boolean;
  onSaved: (value: DecisionCase) => Promise<void>; onCancel?: () => void;
}): ReactElement {
  const prefix = useId();
  const [relation, setRelation] = useState<"unverified" | "none">(current?.relation.status ?? "unverified");
  const [product, setProduct] = useState(current?.relation.productId ?? "");
  const [supplier, setSupplier] = useState(current?.relation.supplierId ?? "");
  const [basis, setBasis] = useState(current?.relation.basis ?? "");
  const [risk, setRisk] = useState(Boolean(current?.riskAssumption));
  const [inbound, setInbound] = useState(current?.riskAssumption?.purchaseOrderLineId ?? "");
  const [assumedDate, setAssumedDate] = useState(current?.riskAssumption?.assumedExpectedDate ?? "");
  const [riskBasis, setRiskBasis] = useState(current?.riskAssumption?.basis ?? "");
  const [selectedProof, setSelectedProof] = useState(proofKey(source));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<{ descriptor: string; key: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const proofs = [source, ...workspace.watches.flatMap(watch => watch.sources)].filter((value, index, all) => value.evidenceRef && value.observation && all.findIndex(item => proofKey(item) === proofKey(value)) === index);
  const chosen = proofs.find(value => proofKey(value) === selectedProof);
  const eligibleInbound = workspace.catalog.inbound.filter(value => value.productId === product && (!supplier || value.supplierId === supplier));
  const selectedInbound = eligibleInbound.find(value => value.id === inbound);
  const riskValid = !risk || (relation === "unverified" && selectedInbound && riskBasis.trim() && (!assumedDate || (selectedInbound.expectedDate && assumedDate > selectedInbound.expectedDate)));

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || disabled || !chosen?.evidenceRef || !riskValid || !basis.trim()) return;
    const body: Omit<CaseInput, "operationKey"> = { evidenceRef: chosen.evidenceRef, relation: { status: relation, productId: relation === "none" ? null : product || null, supplierId: relation === "none" ? null : supplier || null, basis: basis.trim() },
      ...(risk && relation === "unverified" ? { riskAssumption: { kind: "inbound_delay", purchaseOrderLineId: inbound, assumedExpectedDate: assumedDate || null, basis: riskBasis.trim() } } : {}),
    };
    const descriptor = JSON.stringify({ caseId: current?.id, revision: current?.caseRevision, body });
    if (operation.current?.descriptor !== descriptor) operation.current = { descriptor, key: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const input: CaseInput = { ...body, operationKey: operation.current.key };
      const result = current ? await api.reviseCase!(current.id, { ...input, expectedCaseRevision: current.caseRevision }) : await api.createCase!(input);
      if (!mounted.current) return;
      operation.current = null;
      await onSaved(result);
    } catch (failure) { if (mounted.current) setError(commandError(failure)); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <form className="case-form" onSubmit={event => { void submit(event); }}>
    <fieldset disabled={disabled || busy}>
      <legend>{current ? "Revise the source or assumption" : "How could this concern us?"}</legend>
      {current && <><label htmlFor={`${prefix}-proof`}>Received evidence</label><select id={`${prefix}-proof`} value={selectedProof} onChange={event => setSelectedProof(event.target.value)}>{proofs.map(value => <option key={proofKey(value)} value={proofKey(value)}>{value.title}</option>)}</select></>}
      <label htmlFor={`${prefix}-relation`}>Link to our business</label><select id={`${prefix}-relation`} value={relation} onChange={event => { setRelation(event.target.value === "none" ? "none" : "unverified"); setRisk(false); }}><option value="unverified">Possible link, needs verification</option><option value="none">No known link</option></select>
      {relation === "unverified" && <div className="case-fields"><div><label htmlFor={`${prefix}-product`}>Product to examine</label><select id={`${prefix}-product`} value={product} onChange={event => { setProduct(event.target.value); setInbound(""); setAssumedDate(""); }}><option value="">Not identified</option>{workspace.catalog.products.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></div>
        <div><label htmlFor={`${prefix}-supplier`}>Possible supplier</label><select id={`${prefix}-supplier`} value={supplier} onChange={event => { setSupplier(event.target.value); setInbound(""); setAssumedDate(""); }}><option value="">Not identified</option>{workspace.catalog.suppliers.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></div></div>}
      <label htmlFor={`${prefix}-basis`}>Why examine this link?</label><textarea id={`${prefix}-basis`} value={basis} onChange={event => setBasis(event.target.value)} rows={2} maxLength={2000} required placeholder="Explain what is known and what still needs checking." />
      {relation === "unverified" && <details className="case-assumption" open={risk || undefined}><summary>Optional: test a delivery delay</summary><p className="muted small">This is your assumption on synthetic company data. The public source does not confirm a delay.</p><label className="checkbox-label"><input type="checkbox" checked={risk} onChange={event => setRisk(event.target.checked)} disabled={!product} /> Compare coverage if an inbound delivery is delayed</label>
        {risk && <><label htmlFor={`${prefix}-inbound`}>Inbound purchase line</label><select id={`${prefix}-inbound`} value={inbound} onChange={event => { setInbound(event.target.value); setAssumedDate(""); }} required><option value="">Choose a current purchase line</option>{eligibleInbound.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select>
          <label htmlFor={`${prefix}-date`}>Assumed arrival date</label><input id={`${prefix}-date`} type="date" value={assumedDate} onChange={event => setAssumedDate(event.target.value)} /><p className="muted small">Leave empty if the assumed arrival date is unknown. A known date must be later than the current one.</p>
          <label htmlFor={`${prefix}-risk-basis`}>Reason for this assumption</label><textarea id={`${prefix}-risk-basis`} value={riskBasis} onChange={event => setRiskBasis(event.target.value)} rows={2} maxLength={2000} required />
        </>}
      </details>}
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="decision-actions"><button className="button primary" disabled={!chosen || !basis.trim() || !riskValid}>{busy ? "Saving…" : current ? "Save a new version" : "Prepare case"}</button>{onCancel && <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>}</div>
    </fieldset>
  </form>;
}

export function CasePanel({ current, source, workspace, api, fresh, onSaved, onAnalyzed, onProposal, onClose, onResearch }: CasePanelProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState("Which commitments could be affected, and which options preserve all existing commitments?");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<DecisionCase[] | null>(null);
  const operation = useRef<{ descriptor: string; key: string } | null>(null);
  const mounted = useRef(true);
  const questionId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setHistory(null); setEditing(false); }, [current?.caseRevision]);
  const proof = current ? caseSource(current) : source;
  const observation = proof?.observation;
  const url = safeSourceUrl(observation?.url);
  const canCommand = fresh && workspace.company.canDecide && !busy;
  const linked = workspace.proposals.filter(value => value.caseRef?.caseId === current?.id);
  const currentRuns = workspace.runs.filter(value => value.caseRef?.caseId === current?.id && value.caseRef?.caseRevision === current?.caseRevision);
  const analyzing = currentRuns.some(value => value.status === "queued" || value.status === "running");
  const confirmation = current?.confirmation;
  const confirmationCurrent = confirmation && confirmation.companyId === workspace.company.id && confirmation.caseId === current.id && confirmation.caseRevision === current.caseRevision && confirmation.businessRevision === workspace.company.revision && confirmation.policyVersion === workspace.company.policyVersion;
  async function analyze(): Promise<void> {
    if (!current || !api.analyzeCase || !canCommand || !question.trim() || analyzing) return;
    const descriptor = JSON.stringify([current.id, current.caseRevision, question.trim()]);
    if (operation.current?.descriptor !== descriptor) operation.current = { descriptor, key: crypto.randomUUID() };
    setBusy(true); setError(""); setFeedback("");
    try {
      await api.analyzeCase(current.id, { expectedCaseRevision: current.caseRevision, question: question.trim(), operationKey: operation.current.key });
      if (!mounted.current) return;
      operation.current = null; setFeedback("Analysis request recorded. Follow its progress below or in In progress."); await onAnalyzed();
    } catch (failure) { if (mounted.current) setError(commandError(failure)); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function loadHistory(): Promise<void> {
    if (!current || !api.readCase || busy) return;
    setBusy(true); setError("");
    try { const result = await api.readCase(current.id); if (mounted.current) setHistory(result.versions); }
    catch (failure) { if (mounted.current) setError(commandError(failure)); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="decision-panel case-panel" aria-label="Evidence and business case">
    <div className="panel-top"><h2>{current ? "Business case" : "Examine this signal"}</h2><button className="text-button" onClick={onClose}>Back to workspace</button></div>
    <div className="proposal-detail">
      <div className="line-wrap"><span className="badge badge-warning">{current?.impactKind === "risk" ? confirmationCurrent ? "Risk · Internal fact confirmed" : "Risk · Conditional" : "Impact undetermined"}</span><span className="badge">{current?.qualification === "no_known_exposure" ? "No known exposure" : "Needs verification"}</span></div>
      <h2>{observation?.title ?? "Received public evidence"}</h2>
      {current?.testOnly && <div className="notice notice-warning" role="status">Controlled test case. Source revisions are received by the operator. These observations do not establish live business facts.</div>}
      {current?.researchDependency && <details className="trace"><summary>Saved research basis</summary><p className="small">Profile {current.researchDependency.scope.profileVersion} · Generation {current.researchDependency.generation} · {current.researchDependency.scope.namespace}</p><p className="muted small">Valid until: {formatDate(current.researchDependency.validUntil ?? undefined)}</p>{onResearch && <button className="text-button" onClick={() => onResearch(current.researchDependency!.scope.profileId, current.researchDependency!.scope.namespace)}>Saved research</button>}</details>}
      <section className="sources"><h3>1. Public evidence</h3><p className="case-content">{observation?.content || "No source excerpt received."}</p><p className="muted small">Published: {formatDate(observation?.publishedAt ?? undefined)} · Collected: {formatDate(observation?.collectedAt)}</p>{url && <a href={url} target="_blank" rel="noopener noreferrer">Read source ↗</a>}
        {observation?.provenance && <p className="muted small">{observation.provenance.provider === "boamp" ? "BOAMP" : "Keenable"} · {({ search_snippet: "Search excerpt", fetch: "Fetched page", api_record: "API record" })[observation.provenance.method]}{observation.provenance.truncated ? " · Truncated" : ""}</p>}
        {observation?.regulation && <p className="source-caution">Regulatory applicability needs verification. Effective date: {formatDate(observation.regulation.appliesFrom ?? undefined, false)} · Deadline: {formatDate(observation.regulation.deadlineAt ?? undefined, false)}.</p>}
      </section>
      <section className="section-box"><h3>2. Link to our business</h3>{current && !editing ? <><p>{current.relation.basis}</p><p className="muted small">Product: {workspace.catalog.products.find(value => value.id === current.relation.productId)?.label ?? "Not identified"} · Supplier: {workspace.catalog.suppliers.find(value => value.id === current.relation.supplierId)?.label ?? "Not identified"}</p>
        {current.riskAssumption && <div className="proposal-reservations"><strong>Explicit delay assumption</strong><p>{workspace.catalog.inbound.find(value => value.id === current.riskAssumption?.purchaseOrderLineId)?.label ?? current.riskAssumption.purchaseOrderLineId}</p><p>Assumed arrival: {formatDate(current.riskAssumption.assumedExpectedDate ?? undefined, false)}</p><p>{current.riskAssumption.basis}</p></div>}
        {confirmation && <div className={`notice ${confirmationCurrent ? "" : "notice-warning"}`}><strong>{confirmationCurrent ? "Inbound date confirmed in the simulation by the operator. Link to the public news remains unverified." : "Previous internal confirmation. The current context must be checked again."}</strong><p>Confirmed arrival: {formatDate(confirmation.confirmedExpectedDate, false)} · {formatDate(confirmation.confirmedAt)}</p><p>{confirmation.basis}</p></div>}
        <p className="source-caution">The public evidence does not establish this relationship or a supplier delay.</p><button className="text-button" disabled={!canCommand || current.testOnly} onClick={() => setEditing(true)}>Revise source or assumption</button></> : proof && <CaseForm key={current?.caseRevision ?? proofKey(proof)} current={current} source={proof} workspace={workspace} api={api} disabled={!canCommand} onSaved={async value => { await onSaved(value); if (mounted.current) setEditing(false); }} onCancel={current ? () => setEditing(false) : undefined} />}</section>
      <section className="section-box"><h3>3. Commitments to examine</h3>{current ? current.candidateOrderLineIds.length ? <ul className="exposure-list">{current.candidateOrderLineIds.map(identifier => <li key={identifier}>{workspace.catalog.commitments.find(value => value.id === identifier)?.label ?? identifier}</li>)}</ul> : <p>No known exposure. No matching commitment was identified for this relation.</p> : <p>The server will identify candidate commitments after the case is saved.</p>}<p className="muted small">A candidate is not a confirmed impact. Existing reservations remain protected.</p></section>
      <section className="decision-box"><h3>4. Options and decision</h3>{current ? <><label className="sr-only" htmlFor={questionId}>Question about this case</label><textarea id={questionId} value={question} onChange={event => setQuestion(event.target.value)} maxLength={3000} rows={2} disabled={!canCommand} /><button className="button primary" disabled={!canCommand || !question.trim() || analyzing} onClick={() => { void analyze(); }}>{busy || analyzing ? "Analysis in progress…" : "Analyze this case"}</button>
        {currentRuns.map(value => <p key={value.id} className="muted small">{runStatusLabel(value)}{value.message ? ` · ${value.message}` : ""}</p>)}
        {linked.length ? linked.map(value => <div key={value.id}><button className="text-button" onClick={() => onProposal(value.id)}>{value.caseCurrent === false || value.status === "stale" ? "View previous proposal (stale)" : "Review proposal"}: {value.title}</button></div>) : <p>No calculated proposal received for this case yet.</p>}
      </> : <p>Save the case to request an analysis. No model call or business result is implied by this form.</p>}<p className="source-caution">Commercial opportunity calculations are not available in this version.</p></section>
      {feedback && <div className="notice" role="status">{feedback}</div>}{error && <div className="notice notice-danger" role="alert">{error}</div>}
      {current && <details className="trace"><summary>Versions and history</summary><p className="muted small">Business {current.businessRevision} · Policy {current.policyVersion} · Case {current.caseRevision}</p><button className="text-button" disabled={busy} onClick={() => { void loadHistory(); }}>Load saved versions</button>{history && <ol>{history.map(value => <li key={value.caseRevision}><strong>{value.caseRevision === current.caseRevision ? "Current version" : "Previous version"}</strong><p>{formatDate(value.createdAt)} · {value.observation.title}</p><p>{value.relation.basis}</p></li>)}</ol>}</details>}
    </div>
  </section>;
}
