# Physical Impact: press release draft

22 October 2026. Version 3. Internal positioning draft, not distributed. Based on the [received product vision, version 3](../../../../docs/PRODUCT-VISION.md). Succeeds the [AdaptOps draft, version 2](../v2/PRESS-RELEASE.md), preserved with its original receipts. Product direction and observed prototype capabilities are separated below.

## 1. Headline

Physical Impact turns market changes into a coordinated business response

## 2. Standfirst

Adapt as fast as your market changes. Physical Impact brings industry signals together with company knowledge to help teams protect commitments, assess opportunities and act on a common plan.

## 3. Release

Physical Impact is developing an agent for businesses whose operations depend on changing markets. It connects relevant industry information with the company's sites, suppliers, products, stock, customer commitments and commercial pipeline, so teams can see what a change means for them and decide what to do next.

The agent's starting point is a company it already knows. A briefing shows what changed, the evidence behind it, the commitments exposed and the opportunities worth examining. Users can inspect sources, ask a follow-up question and correct an assumption without describing the whole company again.

A supplier incident is one example. Regional projects, tenders, capacity changes and shifts in demand can also affect the business. An attractive opportunity may consume resources already promised elsewhere. Physical Impact is designed to assess risk and opportunity together, with quantities, dates, compatible capacity, costs and the commitments that must remain protected.

The first focus is timber and building-materials businesses with multiple sites in France and European supply relationships. Operations and purchasing coordinate with logistics, sales and finance through one proposed response. The target product executes approved actions through authorised tools, records the result and revises affected work when conditions change.

The hackathon demonstration uses Rivebois Matériaux, a fictional multi-site materials company. Its controlled scenario connects an industrial incident, an existing customer commitment and a qualified commercial request. The proposed response protects current work and examines whether the additional demand can be served. The demand exists before the incident; the incident does not create a customer order.

## 4. Company description

We help businesses adapt as fast as their markets change, turning live signals into coordinated plans and executing approved actions.

## 5. Prototype and demo evidence

The [interactive public demo](https://physical-impact.com/demo) presents the agreed journey: known company, briefing, Watchtower, impact dossier, plan, approval and simulated action. Its visible Demo mode uses scenario data, a scripted conversation and browser-local state. The frontend owner reports successful approval, simulated execution, reload and reset checks; this chat independently observed the public Overview and impact dossier in Aside.

Separately, the backend has read back the received Rivebois portfolio from Aiven: six sites, 24 programmes and 10,000 order lines, with 64 display aliases and unchanged business facts. At that checkpoint, public collection, automatic analysis, industrial conversation, decisions and simulation were not connected. The live-feed-to-action journey remains under integration and requires its own QA receipt. The public Demo's shorter scenario has different operational records and figures; matching company names and counters do not establish the same dataset.

No customer deployment, measured saving, general availability or real ERP/CRM execution is established by these demonstrations. Publication of this draft is separate from the already authorised website and demo publication.

## 6. Sources and continuation

Sources actually read: [product vision](../../../../docs/PRODUCT-VISION.md), [three-minute demo brief](../DEMO-SCRIPT.md), [Rivebois Aiven import](../../../integration/INDUSTRIAL-DISPLAY-AIVEN.json), [exact backend checkpoint](../../../integration/INDUSTRIAL-READ-CANDIDATE.json), [public site/demo entry receipt](../../physical-impact-site/READY.json) and [frontend source manifest](../../../ui/physical-impact-build-v1/FINAL-SOURCE-MANIFEST.json). The public demo was inspected in Aside on 22 October 2026. No new model, collection, approval or action was triggered by this draft.

Existing owners retain frontend composition, landing publication, backend integration and independent QA. Refresh the evidence paragraph from the exact received version before distributing the release. This draft changes no product code, frozen dataset or public page.
