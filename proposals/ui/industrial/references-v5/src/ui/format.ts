import type { DataOrigin, ProposalView, CompanyView } from "./types";

export function formatDate(value: string | undefined, time = true): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unrecognized date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}), timeZone: "Europe/Paris",
  }).format(date);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

export function originLabel(origin: DataOrigin): string {
  return { synthetic: "Synthetic data", live: "Live data", replay: "Replay" }[origin];
}

export function publicTopicLabel(value: string): string {
  const labels: Record<string, string> = { "isolants France perturbations production": "Insulation production and disruptions in France", "marchés publics matériaux France": "Public materials contracts in France" };
  return labels[value] ?? value;
}

export function presentMessage(value: string): string {
  const messages: Record<string, string> = {
    "Le fournisseur modèle autorisé reste à configurer. Aucun appel modèle exécuté.": "The authorized model provider is not configured. No model call was executed.",
    "Fixture UI, aucun appel modèle.": "UI fixture. No model call.",
  };
  return messages[value] ?? value;
}

export function isProposalStale(proposal: ProposalView, company: CompanyView): boolean {
  return proposal.status === "stale" || proposal.revision !== company.revision || proposal.policyVersion !== company.policyVersion;
}

export function safeSourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
