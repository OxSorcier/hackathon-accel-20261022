import { isIP } from 'node:net';
import type { PublicSourceProfile, WatchCapabilities } from '../contracts/index.ts';

export const BOAMP_SOURCE_URL = 'https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records';
export const KEENABLE_SOURCE_URL = 'https://api.keenable.ai/v1/search';
const SECTOR_DOMAINS = ['batiactu.com', 'batirama.com', 'lemoniteur.fr', 'usinenouvelle.com', 'saint-gobain.com', 'rockwool.com', 'knauf.com', 'isover.fr', 'ursa.fr', 'franceboisforet.fr', 'fibois-france.fr', 'gouv.fr'];

export interface SourceProfile extends PublicSourceProfile { query: string; allowedDomains: readonly string[]; priorityUrls?: readonly string[]; pathPrefix?: string; site?: string; searchMode?: 'realtime' | 'pro'; publishedAfter?: string; jurisdiction?: 'FR' | 'EU' }
const POLICIES: readonly SourceProfile[] = [
  { id: 'insulation', label: 'Insulation production and disruptions', publicTopic: 'isolants France perturbations production', family: 'incident', sourceUrls: [BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL], query: 'France isolants usine production perturbation incendie', site: 'rockwool.com', allowedDomains: SECTOR_DOMAINS },
  { id: 'public-contracts', label: 'Public procurement for materials', publicTopic: 'marchés publics matériaux France', family: 'public_contract', sourceUrls: [BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL], query: 'marchés publics matériaux construction France', site: 'boamp.fr', allowedDomains: ['boamp.fr'] },
  { id: 'sector-news', label: 'Materials and timber news', publicTopic: 'actualités sectorielles matériaux et bois France', family: 'sector', sourceUrls: [KEENABLE_SOURCE_URL], query: 'France matériaux construction bois isolation actualité industrie', site: 'batiactu.com', allowedDomains: SECTOR_DOMAINS },
  { id: 'regional-news', label: 'Construction in Hauts-de-France', publicTopic: 'actualités régionales BTP Hauts-de-France', family: 'regional', sourceUrls: [KEENABLE_SOURCE_URL], query: 'Hauts-de-France Lille construction bâtiment matériaux projets', allowedDomains: [...SECTOR_DOMAINS, 'hautsdefrance.fr', 'actu.fr', 'francetvinfo.fr'] },
  { id: 'supplier-statements', label: 'Manufacturer statements', publicTopic: 'communiqués fabricants isolants France', family: 'supplier', sourceUrls: [KEENABLE_SOURCE_URL], query: 'France fabricant isolants communiqué production usine', site: 'rockwool.com', allowedDomains: ['saint-gobain.com', 'rockwool.com', 'knauf.com', 'isover.fr', 'ursa.fr'] },
  { id: 'soissons-project', label: 'ROCKWOOL Soissons project', publicTopic: 'projet usine isolants ROCKWOOL Soissons France', family: 'supplier', sourceUrls: [KEENABLE_SOURCE_URL], query: 'Courmelles usine ROCKWOOL calendrier 2028', site: 'rockwool.com', searchMode: 'pro', publishedAfter: '2026-01-01', allowedDomains: ['rockwool.com'], pathPrefix: '/fr/soissons/', priorityUrls: ['https://www.rockwool.com/fr/soissons/actualites/actualite-du-10-juillet-2026/'] },
  { id: 'industrial-incidents', label: 'Industrial incidents', publicTopic: 'incidents industriels isolants France', family: 'incident', sourceUrls: [KEENABLE_SOURCE_URL], query: 'France usine isolants incendie incident production', allowedDomains: [...SECTOR_DOMAINS, 'actu.fr', 'francetvinfo.fr'] },
  { id: 'construction-projects', label: 'Construction projects', publicTopic: 'projets construction France', family: 'project', sourceUrls: [KEENABLE_SOURCE_URL], query: 'France projets construction chantier matériaux bois', allowedDomains: [...SECTOR_DOMAINS, 'banquedesterritoires.fr'] },
  { id: 'regulation-fr', label: 'French regulation', publicTopic: 'réglementation française matériaux construction', family: 'regulation_fr', sourceUrls: [KEENABLE_SOURCE_URL], query: 'matériaux construction obligations entrée en vigueur', site: 'legifrance.gouv.fr', allowedDomains: ['legifrance.gouv.fr', 'ecologie.gouv.fr'], priorityUrls: ['https://www.ecologie.gouv.fr/politiques-publiques/reglementation-environnementale-re2020'], jurisdiction: 'FR' },
  { id: 'regulation-eu', label: 'European regulation', publicTopic: 'réglementation européenne produits construction', family: 'regulation_eu', sourceUrls: [KEENABLE_SOURCE_URL], query: 'règlement produits construction application obligations', site: 'eur-lex.europa.eu', allowedDomains: ['eur-lex.europa.eu', 'rpc-construction.ecologie.gouv.fr', 'environment.ec.europa.eu'], priorityUrls: ['https://rpc-construction.ecologie.gouv.fr/rpc-20243110'], jurisdiction: 'EU' },
];

export const PUBLIC_TOPICS: readonly string[] = POLICIES.map((profile) => profile.publicTopic);
export const PUBLIC_SOURCE_URLS: readonly string[] = [BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL];
export const PUBLIC_PROFILES: readonly PublicSourceProfile[] = POLICIES.map((profile) => ({ id: profile.id, label: profile.label, publicTopic: profile.publicTopic, family: profile.family, sourceUrls: [...profile.sourceUrls] }));

export function getSourceProfile(topic: unknown): SourceProfile | null {
  const profile = POLICIES.find((item) => item.publicTopic === topic);
  return profile ? { ...profile, sourceUrls: [...profile.sourceUrls], allowedDomains: [...profile.allowedDomains], ...(profile.priorityUrls ? { priorityUrls: [...profile.priorityUrls] } : {}) } : null;
}
export function getSourceProfileById(id: string): SourceProfile | null {
  const profile = POLICIES.find((item) => item.id === id);
  return profile ? { ...profile, sourceUrls: [...profile.sourceUrls], allowedDomains: [...profile.allowedDomains], ...(profile.priorityUrls ? { priorityUrls: [...profile.priorityUrls] } : {}) } : null;
}
export function isPublicTopic(value: unknown): value is string { return getSourceProfile(value) !== null; }
export function isPublicSource(value: unknown): value is string { return value === BOAMP_SOURCE_URL || value === KEENABLE_SOURCE_URL; }
export function isAllowedSourceUrl(value: unknown): value is string { return isPublicSource(value); }
export function sourceMatchesTopic(source: string, topic: string): boolean { return getSourceProfile(topic)?.sourceUrls.includes(source) ?? false; }
export function getWatchCapabilities(): WatchCapabilities {
  return { publicTopics: POLICIES.map((item) => item.publicTopic), sourceUrls: [BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL], minimumCadenceMinutes: 5, maximumCadenceMinutes: 10_080,
    profiles: POLICIES.map((profile) => ({ id: profile.id, label: profile.label, publicTopic: profile.publicTopic, family: profile.family, sourceUrls: [...profile.sourceUrls] })) };
}
export function canonicalPublisherUrl(raw: unknown, profile?: SourceProfile): string | null {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  try {
    const url = new URL(raw); const host = url.hostname.toLowerCase();
    decodeURIComponent(url.pathname);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host) !== 0 || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|example|test)$/.test(host)) return null;
    const domains = profile?.allowedDomains ?? [...new Set(POLICIES.flatMap((item) => item.allowedDomains))];
    if (!domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    if (profile?.pathPrefix && !url.pathname.startsWith(profile.pathPrefix)) return null;
    if (host === 'rockwool.com' || host === 'www.rockwool.com') {
      url.hostname = 'www.rockwool.com';
      if (/^\/fr\/soissons\/actualites\/actualite-du-[^/]+\/?$/.test(url.pathname) && !url.pathname.endsWith('/')) url.pathname += '/';
    }
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|authorization|api.?key/i.test(key)) return null;
      if (/^utm_|^(?:fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = ''; return url.toString();
  } catch { return null; }
}
export function officialRegulationIdentifier(url: string, jurisdiction: 'FR' | 'EU'): string | null {
  if (jurisdiction === 'FR') return url.match(/(?:JORFTEXT|LEGITEXT|LEGIARTI|JORFARTI)\d+/)?.[0] ?? null;
  const parsed = new URL(url); const celex = parsed.searchParams.get('uri');
  if (celex?.startsWith('CELEX:')) return celex;
  return parsed.pathname.includes('/eli/') ? parsed.pathname : null;
}
