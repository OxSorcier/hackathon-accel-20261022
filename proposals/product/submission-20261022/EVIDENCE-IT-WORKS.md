# Physical Impact: evidence it works

**Company data changes the decision: protect both commitments, not just the urgent order.**

22 October 2026 · Recorded prototype evidence · One controlled case · Synthetic company data

## 1. Same case, explicit naive baseline

Paul must cover order A: eight pallets needed in Lille on 23 October. Eight compatible pallets at another depot are already reserved for order B. An unconfirmed inbound shipment cannot be relied on to replenish them.

**Naive rule:** choose the cheapest recorded option that covers A, ignoring other commitments. It selects the EUR 120 transfer. **Data-aware result:** account for reservations, confirmed supply, dates and policy; prepare the feasible EUR 1,420 emergency purchase and preserve B.

| Measured output from the recorded options | Naive rule | Data-aware plan |
| --- | --- | --- |
| Order A coverage | 8 of 8 pallets | 8 of 8 pallets |
| Order B coverage | 0 of 8 pallets | 8 of 8 pallets |
| Commitments covered by the proposed plan | 1 of 2 | 2 of 2 |
| Total remaining shortage | 8 pallets | 0 pallets |
| Option cost | EUR 120 | EUR 1,420 |

**Interpretation:** the data-aware plan costs EUR 1,300 more and avoids reallocating stock promised elsewhere. This demonstrates a feasible decision in this case, not cost savings. Coverage is projected under the plan; no delivery or purchase was performed.

**Method:** recomputed from recorded options on the same company snapshot. The baseline is an analytical rule, not an experimentally run no-data LLM. Sample size: one case. Comparison recorded at 09:55 UTC; the later corrected UI run is identified separately below.

## 2. A real agent and a durable decision

The corrected risk flow used real OpenAI calls and Keenable content. It made **5 model calls**, retained **16 trace events**, prepared the EUR 1,420 proposal and accepted human approval through Aside. Approval of the conditional transfer was disabled. Aiven readback confirmed the approved record.

After process restart, hashes of the company, case, case history, run, proposal, traces and inventory were unchanged. All **16 events** and the approved state survived. This is evidence of tool use and durable state, beyond a single generated answer.

Corrected UI run: 6d4575fa-27ee-49f7-99f0-8a3a2130ca55. Final stable-preview QA passed on port 3001. The comparison run and corrected UI run are separate trials with the same costed response pattern.

## 3. Additional data-layer results, tested separately

| Capability | Observed result | Scope |
| --- | --- | --- |
| Industrial portfolio import | 10,000 order lines, 2,502 orders, 6 depots, 200 products, 40 suppliers and 400 customers | Imported on Aiven; independent fresh-connection readback matched. This is data-scale evidence, not a 10,000-line agent benchmark. |
| Research memory after restart | 2 distinct real model runs retrieved the same 3 canonical source observations | Separate R1 reception. The restarted process made 2 model calls and 0 new research HTTP attempts. First-process transport counters were not retained. |
| Real PDF extraction and storage | 17 pages, 40,113 characters; first acquisition 6,809 ms | Public ROCKWOOL report through Modal into an isolated Aiven schema. One observed acquisition, not a latency distribution. |
| PDF result reuse | 2 acquisitions, 1 Modal adapter call; second acquisition was a cache hit | A new database connection read identical pages. Two public downloads occurred; this is extraction reuse, not zero network activity. |

## What this establishes

The prototype has produced a calculated, approved and durable decision on an explicit synthetic case. Business data materially changes which response preserves commitments. Document extraction, cache reuse and larger-portfolio storage have their own real receipts. Their full assembly into the richer industrial app journey remains separate acceptance work.

Public source content does not prove the fictional supplier relationship or delay. No aggregate accuracy, customer time savings, monetary model cost, production rollout or real-world business action is claimed.

## Sources and reproduction

Measurements and source SHA-256 values: [EVIDENCE-DATA.json](EVIDENCE-DATA.json). Comparison: [REAL-CASE-FLOW](../../integration/REAL-CASE-FLOW.json). Corrected agent/UI: [FINAL-UI-FLOW](../../integration/FINAL-UI-FLOW.json). Durable state: [FINAL-PREVIEW-RESTART](../../integration/FINAL-PREVIEW-RESTART.json) and [FINAL-3001-QA](../../integration/FINAL-3001-QA.json). Portfolio: [INDUSTRIAL-CORE-AIVEN](../../integration/INDUSTRIAL-CORE-AIVEN.json). Memory: [R1-RECEPTION](../../agent/R1-RECEPTION.json). PDF: [AIVEN-DOCUMENTS-LIVE](../../modal/AIVEN-DOCUMENTS-LIVE.json). All are local project receipts dated 22 October 2026; relative references require the accompanying repository.

Prepared by Erwan Gallo for Accel AI Innovate Paris. Version 1. The public website is [physical-impact.com](https://physical-impact.com).
