import type { CompanySnapshot, JsonObject } from '../contracts/index.ts';
import type { IndustrialContext, IndustrialProvenance } from '../contracts/industrial.ts';
import { DataWatchError, identifier, isoDate } from './validation.ts';

type Parser<T> = (value: unknown) => T;
type Parsed<S extends Record<string, Parser<unknown>>> = { [K in keyof S]: S[K] extends Parser<infer T> ? T : never };
function invalid(): never { throw new DataWatchError('INVALID_INDUSTRIAL_CONTEXT'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  return value as Record<string, unknown>;
}
function shape<S extends Record<string, Parser<unknown>>>(value: unknown, fields: S): Parsed<S> {
  const row = object(value); if (Object.keys(row).some((key) => !Object.hasOwn(fields, key))) invalid();
  return Object.fromEntries(Object.entries(fields).map(([key, parse]) => [key, parse(row[key])]).filter(([, item]) => item !== undefined)) as Parsed<S>;
}
function text(value: unknown): string { if (typeof value !== 'string' || value.trim().length === 0 || value.length > 2000) invalid(); return value; }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(); return value; }
function positive(value: unknown): number { const n = integer(value); if (n === 0) invalid(); return n; }
function literal<const T extends readonly (string | boolean)[]>(...values: T): Parser<T[number]> {
  return (value): T[number] => { if (!values.some((item) => item === value)) invalid(); return value as T[number]; };
}
function list<T>(parse: Parser<T>): Parser<T[]> { return (value): T[] => { if (!Array.isArray(value) || value.length > 10_000) invalid(); return value.map((item) => parse(item)); }; }
function optional<T>(parse: Parser<T>): Parser<T | undefined> { return (value): T | undefined => value === undefined ? undefined : parse(value); }
function nullable<T>(parse: Parser<T>): Parser<T | null> { return (value): T | null => value === null ? null : parse(value); }
function date(value: unknown): string { const s = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isoDate(`${s}T00:00:00Z`).slice(0, 10) !== s) invalid(); return s; }
function ids(value: unknown): string[] { const result = list(identifier)(value); if (new Set(result).size !== result.length) invalid(); return result; }
function unique<T>(items: T[], key: (item: T) => string): void { if (new Set(items.map(key)).size !== items.length) invalid(); }
function cents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid();
  const result = Math.round(value * 100); if (!Number.isSafeInteger(result) || Math.abs(value * 100 - result) > 0.000001) invalid(); return result;
}
function earliestArrival(quote: JsonObject): string {
  const day = new Date(`${date(quote.valid_on)}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + integer(quote.lead_days));
  if (!Number.isFinite(day.getTime())) invalid(); return day.toISOString().slice(0, 10);
}
const provenance: Parser<IndustrialProvenance> = (value) => shape(value, { system: literal('ERP_DEMO', 'CRM_DEMO', 'SCENARIO'), nativeId: identifier, version: identifier, receivedAt: isoDate, actorId: identifier });
const site = (value: unknown): IndustrialContext['supplierSites'][number] => shape(value, { supplierSiteId: identifier, supplierId: identifier, name: text, country: text, region: text, productIds: ids, provenance });
const dependency = (value: unknown): IndustrialContext['supplierDependencies'][number] => shape(value, { id: identifier, supplierId: identifier, supplierSiteId: identifier, productId: identifier, purchaseOrderLineIds: ids, orderLineIds: ids, status: literal('confirmed_in_synthetic_master'), provenance });
const competitor = (value: unknown): IndustrialContext['competitors'][number] => shape(value, { id: identifier, name: text, productIds: ids, regions: list(text), supplierSiteIds: ids, provenance });
const demand = (value: unknown): IndustrialContext['commercialDemand'][number] => shape(value, { opportunityId: identifier, customerId: identifier, projectId: identifier, productId: identifier, unit: text, quantity: positive, needDate: date, destinationDepotId: identifier, saleUnitPriceCents: integer, customerMaximumUnitPriceCents: nullable(integer), confirmedAt: isoDate, ownerActorId: identifier, confirmationStatus: literal('synthetic_confirmed'), currency: literal('EUR'), provenance });
const valuation = (value: unknown): IndustrialContext['stockValuations'][number] => shape(value, { stockId: identifier, productId: identifier, unit: text, unitCostCents: integer, currency: literal('EUR'), provenance,
  stockSource: (source) => shape(source, { inventoryLotId: identifier, physicalStockBasis: text, affectedSiteRelation: literal('independent_on_hand_for_this_scenario', 'unknown', 'affected'), upstreamManufacturingOrigin: literal('unknown'), provenance }) });
const delivery = (value: unknown): IndustrialContext['deliveryQuotes'][number] => shape(value, { quoteId: identifier, transportQuoteId: identifier, opportunityId: optional(identifier), sourceStockId: identifier, fromDepotId: identifier, destinationDepotId: identifier, productId: identifier, unit: text, availableQuantity: positive, freightCents: integer, handlingCents: integer, dispatchDate: date, arrivalDate: date, validUntil: isoDate, confirmationStatus: literal('synthetic_confirmed'), provenance });
const alternative = (value: unknown): IndustrialContext['independentAlternatives'][number] => shape(value, { canonicalResourceId: identifier, quoteId: identifier, supplierId: identifier, supplierSiteId: identifier, destinationDepotId: identifier, stockLotId: identifier, independenceScope: text, affectedSiteRelation: literal('independent', 'unknown', 'affected'), productId: identifier, unit: text, availableQuantity: positive, unitCostCents: integer, freightCents: integer, arrivalDate: date, validUntil: isoDate, confirmationStatus: literal('synthetic_confirmed'), provenance });

/** Pure validation. Provenance identifies a synthetic record, never an authority. */
export function parseIndustrialContext(value: unknown, snapshot: CompanySnapshot): IndustrialContext {
  const context: IndustrialContext = shape(value, {
    schema: literal('adaptops-industrial/1'), companyId: identifier, revision: identifier, qualificationRevision: identifier, dataOrigin: literal('synthetic'), receivedAt: isoDate,
    companyProfile: (profile) => shape(profile, { activity: text, countries: list(text), regions: list(text), provenance }),
    projectOwners: list((owner) => shape(owner, { projectId: identifier, customerId: identifier, siteId: identifier, ownerActorId: identifier, provenance })),
    supplierSites: list(site), supplierDependencies: list(dependency), competitors: list(competitor), commercialDemand: list(demand), stockValuations: list(valuation), deliveryQuotes: list(delivery), independentAlternatives: list(alternative),
  });
  if (context.companyId !== snapshot.companyId || snapshot.dataset.company_id !== snapshot.companyId || snapshot.policy.company_id !== snapshot.companyId || snapshot.dataOrigin !== 'synthetic') invalid();
  function table(name: string): Map<string, JsonObject> {
    const rows = snapshot.dataset.tables[name]; if (!Array.isArray(rows)) invalid();
    unique(rows, (row) => identifier(row.id)); return new Map(rows.map((row) => [identifier(row.id), row]));
  }
  const products = table('products'), suppliers = table('suppliers'), depots = table('depots'), customers = table('customers'), employees = table('employees');
  const projects = table('construction_projects'), orders = table('orders'), lines = table('order_lines'), purchaseOrders = table('purchase_orders'), purchaseLines = table('purchase_order_lines');
  const stocks = table('inventory'), opportunities = table('crm_opportunities'), transports = table('transport_quotes'), emergency = table('emergency_quotes');
  function ref(rows: Map<string, JsonObject>, id: string, alias?: IndustrialProvenance): JsonObject {
    const row = rows.get(id); if (!row) invalid();
    if (alias && row.provenance !== undefined) {
      const native = provenance(row.provenance); if (!employees.has(native.actorId) || native.receivedAt > alias.receivedAt || (native.system === 'SCENARIO' && alias.system !== 'SCENARIO')) invalid();
    }
    return row;
  }
  function product(id: string, unit?: string, alias?: IndustrialProvenance): void { const row = ref(products, id, alias); if (unit !== undefined && row.unit !== unit) invalid(); }
  function attributed(p: IndustrialProvenance): void { ref(employees, p.actorId); if (p.receivedAt > context.receivedAt) invalid(); }
  const sites = new Map(context.supplierSites.map((item) => [item.supplierSiteId, item]));
  function supplySite(id: string, supplierId: string, productId: string): void { const item = sites.get(id); if (!item || item.supplierId !== supplierId || !item.productIds.includes(productId)) invalid(); }
  const businessDay = date(snapshot.dataset.as_of.slice(0, 10));
  const companyTimeZone = snapshot.dataset.tables.company?.[0]?.timezone ?? 'UTC';
  if (typeof companyTimeZone !== 'string' || companyTimeZone.length > 100) invalid();
  let calendar: Intl.DateTimeFormat;
  try { calendar = new Intl.DateTimeFormat('en-CA', { timeZone:companyTimeZone,year:'numeric',month:'2-digit',day:'2-digit' }); } catch { invalid(); }
  function nativeValidity(quote: JsonObject, validUntil: string): void {
    const parts = calendar.formatToParts(new Date(validUntil)), part = (type: string): string => parts.find((item) => item.type === type)?.value ?? '';
    if (date(quote.valid_on) !== businessDay || `${part('year')}-${part('month')}-${part('day')}` !== quote.valid_on) invalid();
  }
  for (const [items, key] of [[context.projectOwners, 'projectId'], [context.supplierSites, 'supplierSiteId'], [context.supplierDependencies, 'id'], [context.competitors, 'id'], [context.commercialDemand, 'opportunityId'], [context.stockValuations, 'stockId'], [context.deliveryQuotes, 'quoteId'], [context.independentAlternatives, 'canonicalResourceId']] as const) unique<unknown>(items, (item) => identifier(object(item)[key]));
  unique(context.deliveryQuotes, (item) => item.transportQuoteId);
  attributed(context.companyProfile.provenance);
  ref(table('company'),context.companyId,context.companyProfile.provenance);
  for (const item of context.projectOwners) {
    attributed(item.provenance); ref(customers, item.customerId, item.provenance); ref(depots, item.siteId, item.provenance); ref(employees, item.ownerActorId, item.provenance);
    const project = ref(projects, item.projectId, item.provenance); if (project.customer_id !== item.customerId || project.owner_id !== item.ownerActorId) invalid();
  }
  for (const item of context.supplierSites) { attributed(item.provenance); ref(suppliers, item.supplierId, item.provenance); for (const id of item.productIds) product(id, undefined, item.provenance); }
  for (const item of context.supplierDependencies) {
    attributed(item.provenance); product(item.productId, undefined, item.provenance); supplySite(item.supplierSiteId, item.supplierId, item.productId);
    for (const id of item.purchaseOrderLineIds) { const row = ref(purchaseLines, id, item.provenance); if (row.product_id !== item.productId || ref(purchaseOrders, identifier(row.purchase_order_id), item.provenance).supplier_id !== item.supplierId) invalid(); }
    for (const id of item.orderLineIds) { const row = ref(lines, id, item.provenance); if (row.product_id !== item.productId) invalid(); ref(orders, identifier(row.order_id), item.provenance); }
  }
  for (const item of context.competitors) { attributed(item.provenance); for (const id of item.productIds) product(id, undefined, item.provenance); for (const id of item.supplierSiteIds) if (!sites.has(id)) invalid(); }
  for (const item of context.commercialDemand) {
    attributed(item.provenance); product(item.productId, item.unit, item.provenance); ref(employees, item.ownerActorId, item.provenance); ref(depots, item.destinationDepotId, item.provenance); ref(customers, item.customerId, item.provenance);
    if (ref(projects, item.projectId, item.provenance).customer_id !== item.customerId) invalid();
    const row = ref(opportunities, item.opportunityId, item.provenance);
    if (row.status !== 'qualified_synthetic_confirmed' || row.customer_id !== item.customerId || row.project_id !== item.projectId || row.product_id !== item.productId || row.unit !== item.unit || row.quantity !== item.quantity || row.need_date !== item.needDate || row.destination_depot_id !== item.destinationDepotId || row.owner_id !== item.ownerActorId || row.confirmation_status !== item.confirmationStatus || isoDate(row.confirmed_at) !== item.confirmedAt || cents(row.sale_unit_price_eur) !== item.saleUnitPriceCents || (row.customer_maximum_unit_price_eur === null ? null : cents(row.customer_maximum_unit_price_eur)) !== item.customerMaximumUnitPriceCents || row.currency !== 'EUR' || item.confirmedAt > item.provenance.receivedAt || (item.customerMaximumUnitPriceCents !== null && item.saleUnitPriceCents > item.customerMaximumUnitPriceCents)) invalid();
  }
  for (const item of context.stockValuations) { attributed(item.provenance); attributed(item.stockSource.provenance); product(item.productId, item.unit, item.provenance); const row = ref(stocks, item.stockId, item.stockSource.provenance); if (row.product_id !== item.productId || row.unit !== item.unit) invalid(); }
  for (const item of context.deliveryQuotes) {
    attributed(item.provenance); product(item.productId, item.unit, item.provenance); ref(depots, item.fromDepotId, item.provenance); ref(depots, item.destinationDepotId, item.provenance);
    const stock = ref(stocks, item.sourceStockId, item.provenance), quote = ref(transports, item.transportQuoteId, item.provenance); nativeValidity(quote,item.validUntil);
    if (stock.depot_id !== item.fromDepotId || stock.product_id !== item.productId || stock.unit !== item.unit || integer(stock.physical_quantity) < item.availableQuantity || quote.from_depot_id !== item.fromDepotId || quote.to_depot_id !== item.destinationDepotId || quote.product_id !== item.productId || quote.unit !== item.unit || integer(quote.capacity) < item.availableQuantity || cents(quote.cost_eur) !== item.freightCents + item.handlingCents || !Number.isSafeInteger(item.freightCents + item.handlingCents) || item.arrivalDate < item.dispatchDate || item.arrivalDate < earliestArrival(quote) || item.validUntil < item.provenance.receivedAt || quote.quote_status !== 'synthetic_confirmed') invalid();
    if (item.opportunityId && !context.commercialDemand.some((d) => d.opportunityId === item.opportunityId && d.productId === item.productId && d.destinationDepotId === item.destinationDepotId)) invalid();
  }
  for (const item of context.independentAlternatives) {
    attributed(item.provenance); product(item.productId, item.unit, item.provenance); supplySite(item.supplierSiteId, item.supplierId, item.productId); ref(depots, item.destinationDepotId, item.provenance);
    const quote = ref(emergency, item.canonicalResourceId, item.provenance); nativeValidity(quote,item.validUntil);
    if (item.quoteId !== item.canonicalResourceId || quote.supplier_id !== item.supplierId || quote.destination_depot_id !== item.destinationDepotId || quote.product_id !== item.productId || quote.unit !== item.unit || integer(quote.available_quantity) < item.availableQuantity || cents(quote.unit_price_eur) !== item.unitCostCents || cents(quote.freight_eur) !== item.freightCents || quote.quote_status !== 'synthetic_confirmed' || item.arrivalDate < earliestArrival(quote) || item.validUntil < item.provenance.receivedAt) invalid();
  }
  return context;
}

/** Positive current-data projection. Future planning dates remain valid business inputs. */
export function currentIndustrialContext(value: unknown, snapshot: CompanySnapshot, asOf: string): IndustrialContext {
  const context = parseIndustrialContext(value, snapshot), at = isoDate(asOf);
  const current = (p: IndustrialProvenance): boolean => p.system !== 'SCENARIO' && p.receivedAt <= at;
  if (context.receivedAt > at || !current(context.companyProfile.provenance)) throw new DataWatchError('INDUSTRIAL_CONTEXT_NOT_CURRENT');
  const supplierSites = context.supplierSites.filter((item) => current(item.provenance)), siteIds = new Set(supplierSites.map((item) => item.supplierSiteId));
  const commercialDemand = context.commercialDemand.filter((item) => current(item.provenance) && item.confirmedAt <= at), demandIds = new Set(commercialDemand.map((item) => item.opportunityId));
  return { ...context,
    projectOwners: context.projectOwners.filter((item) => current(item.provenance)), supplierSites,
    supplierDependencies: context.supplierDependencies.filter((item) => current(item.provenance) && siteIds.has(item.supplierSiteId)),
    competitors: context.competitors.filter((item) => current(item.provenance) && item.supplierSiteIds.every((id) => siteIds.has(id))), commercialDemand,
    stockValuations: context.stockValuations.filter((item) => current(item.provenance) && current(item.stockSource.provenance)),
    deliveryQuotes: context.deliveryQuotes.filter((item) => current(item.provenance) && item.validUntil >= at && (!item.opportunityId || demandIds.has(item.opportunityId))),
    independentAlternatives: context.independentAlternatives.filter((item) => current(item.provenance) && item.validUntil >= at && siteIds.has(item.supplierSiteId)),
  };
}
