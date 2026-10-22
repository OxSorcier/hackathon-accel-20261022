import { createHash } from 'node:crypto';

/** A typed tuple keeps opaque identities bounded and independent of separators in native IDs. */
export function referenceId(kind: string, components: readonly string[]): string {
  return `${kind}:${createHash('sha256').update(JSON.stringify(components)).digest('hex')}`;
}

export class DomainError extends Error {
  readonly code: string;
  readonly field: string;
  constructor(code: string, field = '') {
    super(`${code}${field ? `: ${field}` : ''}`);
    this.name = 'DomainError';
    this.code = code;
    this.field = field;
  }
}

export interface Product { id: string; unit: string }
export interface Order { id: string; depot_id: string; need_date: string | null; status: 'confirmed' | 'cancelled' }
export interface OrderLine { id: string; order_id: string; product_id: string; quantity: number; unit: string }
export interface Inventory { id: string; depot_id: string; product_id: string; physical_quantity: number; unit: string }
export interface Reservation { id: string; stock_id: string; order_line_id: string; quantity: number; unit: string; status: 'active' | 'released' }
export interface PurchaseOrder { id: string; status: 'confirmed' | 'planned_unconfirmed' | 'cancelled' }
export interface PurchaseLine { id: string; purchase_order_id: string; product_id: string; depot_id: string; quantity: number; unit: string; expected_date: string | null }
export interface InboundAllocation { id: string; purchase_order_line_id: string; order_line_id: string; quantity: number; unit: string }
export interface TransportQuote { id: string; from_depot_id: string; to_depot_id: string; product_id: string; capacity: number; unit: string; lead_days: number; costCents: number; valid_on: string; confirmed: boolean }
export interface EmergencyQuote { id: string; product_id: string; destination_depot_id: string; available_quantity: number; unit: string; lead_days: number; unitPriceCents: number; freightCents: number; valid_on: string; confirmed: boolean }
export interface BusinessSnapshot {
  companyId: string; revision: string; asOf: string; dataOrigin: 'synthetic' | 'real';
  products: Product[]; depots: string[]; orders: Order[]; lines: OrderLine[];
  inventory: Inventory[]; reservations: Reservation[]; purchases: PurchaseOrder[];
  inbound: PurchaseLine[]; inboundAllocations: InboundAllocation[];
  transports: TransportQuote[]; emergency: EmergencyQuote[];
}
export interface BusinessPolicy { companyId: string; version: string; replacementMarginDays: number; replacementOrderLineIds: string[] }
export interface CurrentVersion { companyId: string; revision: string; policyVersion: string }

export function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DomainError('INVALID_OBJECT', field);
  return value as Record<string, unknown>;
}
export function textField(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 500) throw new DomainError('INVALID_STRING', field);
  return value;
}
export function quantity(value: unknown, field: string, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new DomainError('INVALID_QUANTITY', field);
  return value;
}
export function calendarDate(value: unknown, field: string): string {
  const date = textField(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new DomainError('INVALID_DATE', field);
  return date;
}
export function addDays(date: string, days: number): string {
  const time = Date.parse(`${calendarDate(date, 'date')}T00:00:00Z`) + days * 86400000;
  if (!Number.isSafeInteger(days) || !Number.isFinite(time) || Math.abs(time) > 8640000000000000) throw new DomainError('INVALID_DATE', 'days');
  const result = new Date(time).toISOString().slice(0, 10);
  return calendarDate(result, 'result');
}
function optionalDate(value: unknown, field: string): string | null { return value == null ? null : calendarDate(value, field); }
function cents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) throw new DomainError('INVALID_MONEY', field);
  return Math.round(value * 100);
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(value as T)) throw new DomainError('INVALID_STATUS', field);
  return value as T;
}
function rows(tables: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = tables[key];
  if (!Array.isArray(value) || value.length > 10000) throw new DomainError('INVALID_TABLE', key);
  const parsed = value.map((r: unknown) => record(r, key));
  const ids = parsed.map(r => textField(r.id, `${key}.id`));
  if (new Set(ids).size !== ids.length) throw new DomainError('DUPLICATE_ID', key);
  return parsed;
}
function id(r: Record<string, unknown>, key: string): string { return textField(r[key], key); }

/** Parses only released business tables. Construction, personnel and oracle fields are dropped. */
export function parseSnapshot(input: unknown): BusinessSnapshot {
  const raw = record(input, 'snapshot'); const t = record(raw.tables, 'tables');
  const companyId = id(raw, 'company_id');
  const asOf = textField(raw.as_of, 'as_of');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw new DomainError('INVALID_DATE', 'as_of');
  calendarDate(asOf.slice(0, 10), 'as_of');
  const snapshot: BusinessSnapshot = {
    companyId, revision: id(raw, 'snapshot_revision'), asOf,
    dataOrigin: oneOf(raw.data_origin, ['synthetic', 'real'], 'data_origin'),
    products: rows(t,'products').map(r => ({id:id(r,'id'),unit:id(r,'unit')})),
    depots: rows(t,'depots').map(r => id(r,'id')),
    orders: rows(t,'orders').map(r => ({id:id(r,'id'),depot_id:id(r,'depot_id'),need_date:optionalDate(r.need_date,'need_date'),status:oneOf(r.status,['confirmed','cancelled'],'order.status')})),
    lines: rows(t,'order_lines').map(r => ({id:id(r,'id'),order_id:id(r,'order_id'),product_id:id(r,'product_id'),quantity:quantity(r.quantity,'line.quantity'),unit:id(r,'unit')})),
    inventory: rows(t,'inventory').map(r => ({id:id(r,'id'),depot_id:id(r,'depot_id'),product_id:id(r,'product_id'),physical_quantity:quantity(r.physical_quantity,'physical_quantity',true),unit:id(r,'unit')})),
    reservations: rows(t,'reservations').map(r => ({id:id(r,'id'),stock_id:id(r,'stock_id'),order_line_id:id(r,'order_line_id'),quantity:quantity(r.quantity,'reservation.quantity'),unit:id(r,'unit'),status:oneOf(r.status,['active','released'],'reservation.status')})),
    purchases: rows(t,'purchase_orders').map(r => ({id:id(r,'id'),status:oneOf(r.status,['confirmed','planned_unconfirmed','cancelled'],'purchase.status')})),
    inbound: rows(t,'purchase_order_lines').map(r => ({id:id(r,'id'),purchase_order_id:id(r,'purchase_order_id'),product_id:id(r,'product_id'),depot_id:id(r,'depot_id'),quantity:quantity(r.quantity,'inbound.quantity'),unit:id(r,'unit'),expected_date:optionalDate(r.expected_date,'expected_date')})),
    inboundAllocations: rows(t,'inbound_allocations').map(r => ({id:id(r,'id'),purchase_order_line_id:id(r,'purchase_order_line_id'),order_line_id:id(r,'order_line_id'),quantity:quantity(r.quantity,'allocation.quantity'),unit:id(r,'unit')})),
    transports: rows(t,'transport_quotes').map(r => ({id:id(r,'id'),from_depot_id:id(r,'from_depot_id'),to_depot_id:id(r,'to_depot_id'),product_id:id(r,'product_id'),capacity:quantity(r.capacity,'capacity'),unit:id(r,'unit'),lead_days:quantity(r.lead_days,'lead_days',true),costCents:cents(r.cost_eur,'cost_eur'),valid_on:calendarDate(r.valid_on,'valid_on'),confirmed:oneOf(r.quote_status,['confirmed','synthetic_confirmed','unconfirmed'],'quote_status') !== 'unconfirmed'})),
    emergency: rows(t,'emergency_quotes').map(r => ({id:id(r,'id'),product_id:id(r,'product_id'),destination_depot_id:id(r,'destination_depot_id'),available_quantity:quantity(r.available_quantity,'available_quantity'),unit:id(r,'unit'),lead_days:quantity(r.lead_days,'lead_days',true),unitPriceCents:cents(r.unit_price_eur,'unit_price_eur'),freightCents:cents(r.freight_eur,'freight_eur'),valid_on:calendarDate(r.valid_on,'valid_on'),confirmed:oneOf(r.quote_status,['confirmed','synthetic_confirmed','unconfirmed'],'quote_status') !== 'unconfirmed'})),
  };
  validateRelations(snapshot);
  return snapshot;
}

function validateRelations(s: BusinessSnapshot): void {
  const resourceIds=[...s.inventory,...s.inbound,...s.transports,...s.emergency].map(r=>r.id);
  if(new Set(resourceIds).size!==resourceIds.length) throw new DomainError('AMBIGUOUS_RESOURCE_ID');
  const products = new Map(s.products.map(p => [p.id,p])); const lines = new Map(s.lines.map(l => [l.id,l])); const orders = new Map(s.orders.map(o => [o.id,o]));
  const stocks = new Map(s.inventory.map(i => [i.id,i])); const inbound = new Map(s.inbound.map(i => [i.id,i]));
  const productUnit = (productId: string, unit: string): void => { if (products.get(productId)?.unit !== unit) throw new DomainError('SKU_UNIT_MISMATCH'); };
  for (const o of s.orders) if (!s.depots.includes(o.depot_id)) throw new DomainError('UNKNOWN_DEPOT');
  for (const l of s.lines) { productUnit(l.product_id,l.unit); if (!orders.has(l.order_id)) throw new DomainError('UNKNOWN_ORDER'); }
  for (const row of [...s.inventory,...s.inbound]) { productUnit(row.product_id,row.unit); if (!s.depots.includes(row.depot_id)) throw new DomainError('UNKNOWN_DEPOT'); }
  for (const row of s.inbound) if (!s.purchases.some(p => p.id===row.purchase_order_id)) throw new DomainError('UNKNOWN_PURCHASE');
  const reserved = new Map<string,number>(); const allocated = new Map<string,number>();
  for (const r of s.reservations) {
    const stock=stocks.get(r.stock_id); const line=lines.get(r.order_line_id); const order=line ? orders.get(line.order_id) : undefined;
    if (!stock || !line || !order || stock.product_id!==line.product_id || stock.unit!==r.unit || line.unit!==r.unit || stock.depot_id!==order.depot_id) throw new DomainError('INVALID_RESERVATION');
    if(r.status==='active') reserved.set(stock.id,(reserved.get(stock.id) ?? 0)+r.quantity);
  }
  for(const [stockId,q] of reserved) if(q>stocks.get(stockId)!.physical_quantity) throw new DomainError('OVER_RESERVED');
  for(const a of s.inboundAllocations) {
    const source=inbound.get(a.purchase_order_line_id); const line=lines.get(a.order_line_id); const order=line ? orders.get(line.order_id) : undefined;
    if(!source || !line || !order || source.product_id!==line.product_id || source.unit!==a.unit || line.unit!==a.unit || source.depot_id!==order.depot_id) throw new DomainError('INVALID_ALLOCATION');
    allocated.set(source.id,(allocated.get(source.id) ?? 0)+a.quantity);
  }
  for(const [sourceId,q] of allocated) if(q>inbound.get(sourceId)!.quantity) throw new DomainError('OVER_ALLOCATED');
  for(const line of s.lines) {
    const total=s.reservations.filter(r=>r.status==='active' && r.order_line_id===line.id).reduce((q,r)=>q+r.quantity,0)+s.inboundAllocations.filter(a=>a.order_line_id===line.id).reduce((q,a)=>q+a.quantity,0);
    if(total>line.quantity) throw new DomainError('OVER_ALLOCATED_LINE');
  }
  for(const q of s.transports) {productUnit(q.product_id,q.unit); if(q.from_depot_id===q.to_depot_id || !s.depots.includes(q.from_depot_id) || !s.depots.includes(q.to_depot_id)) throw new DomainError('INVALID_ROUTE');}
  for(const q of s.emergency) {productUnit(q.product_id,q.unit); if(!s.depots.includes(q.destination_depot_id)) throw new DomainError('UNKNOWN_DEPOT');}
}

export function parsePolicy(input: unknown): BusinessPolicy {
  const p=record(input,'policy');
  if(!Array.isArray(p.replacementOrderLineIds) || p.replacementOrderLineIds.length>10000) throw new DomainError('INVALID_POLICY_SCOPE');
  const replacementOrderLineIds=p.replacementOrderLineIds.map((value: unknown)=>textField(value,'replacementOrderLineIds'));
  if(new Set(replacementOrderLineIds).size!==replacementOrderLineIds.length) throw new DomainError('INVALID_POLICY_SCOPE');
  return {companyId:id(p,'companyId'),version:id(p,'version'),replacementMarginDays:quantity(p.replacementMarginDays,'replacementMarginDays',true),replacementOrderLineIds};
}
