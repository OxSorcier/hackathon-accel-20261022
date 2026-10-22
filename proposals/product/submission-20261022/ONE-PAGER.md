# Physical Impact

**Physical Impact turns market signals and company data into coordinated action for operations teams.**

## The problem

An operations team sees a supplier update, an industry incident or new regional demand. The hard part is understanding what it changes for its own stock, customer commitments and available capacity, then coordinating a response across purchasing, logistics and sales.

## The product

Physical Impact connects market intelligence to an already contextualised business. Teams review what changed, inspect the company-specific impact, compare a calculated plan and approve the next action. The product direction combines protection of existing commitments with qualified commercial opportunities, retained knowledge and verified action results.

**Journey:** company context + dated signals → impact → coordinated plan → human approval → action result → retained knowledge.

## What we have demonstrated

In a controlled materials-business case, a cheap stock transfer covers an urgent order but leaves another order eight pallets short. A data-aware emergency-purchase plan covers both orders. The real agent used five model calls and typed tools; the decision was approved in the interface and retained on Aiven after restart. No purchase or stock movement was executed.

| Same controlled case | Naive local fix | Data-aware plan |
| --- | --- | --- |
| Commitments covered by the plan | 1 of 2 | 2 of 2 |
| Remaining shortage | 8 pallets | 0 pallets |
| Recorded option cost | EUR 120 | EUR 1,420 |

The baseline is an analytical cheapest-option rule, not a separate LLM run. Company data and internal confirmation are synthetic. This is one case, not a general accuracy or customer-savings benchmark.

## Data and agent foundation

Aiven PostgreSQL holds versioned business records, sources and decisions. Keenable retrieves public evidence; OpenAI selects bounded tools; deterministic TypeScript calculations check quantities, dates, reservations and costs. Separately, a 10,000-order-line portfolio has been imported and independently read back on Aiven. A real 17-page PDF was extracted through Modal, stored on Aiven and reused with one extraction across two acquisitions.

## First users and why now

Start with operations and procurement leaders in French timber, raw-materials and construction supply chains. The proposed acquisition path is targeted industry outreach around one recurring supply decision, then expansion across sites. Adoption and willingness to pay remain to be tested. The opportunity is to turn abundant market information into timely, company-specific action using tool-capable agents and durable operational data.

## Availability and sources

[Website](https://physical-impact.com). The accepted connected risk flow runs locally with Aiven PostgreSQL. The richer industrial workflow and simulated execution remain under assembly. The website is a separate public presentation surface.

22 October 2026, version 1. Sources: [evidence and measurements](EVIDENCE-IT-WORKS.html), [data layer](DATA-LAYER.md), [verification status](../../../docs/STATUS.md). Prepared by Erwan Gallo for Accel AI Innovate Paris.
