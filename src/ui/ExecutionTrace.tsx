import type { ReactElement } from "react";
import type { RunView } from "./types";

export function ExecutionTrace({ tools }: { tools: RunView["tools"] }): ReactElement {
  return <details className="trace"><summary>Execution trace <span>{tools.length} event{tools.length !== 1 ? "s" : ""}</span></summary>
    {tools.length === 0 ? <p className="muted">No tool calls received.</p> : <ol>{tools.map(tool => <li key={tool.id}>
      <div><strong>{tool.name}</strong><span className={`badge badge-${tool.status === "error" ? "danger" : "neutral"}`}>{({ success: "Completed", recorded: "Recorded", error: "Error", running: "In progress", not_run: "Not run", intent: "Intent recorded", unknown: "Unconfirmed status" })[tool.status]}</span></div>
      <p>{tool.summary}</p>
    </li>)}</ol>}
  </details>;
}
