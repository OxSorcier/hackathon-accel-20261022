# The data layer in action

Physical Impact combines company operational data with dated public evidence so an agent can assess what a market change means for a specific business.

**What data:** products, stock, reservations, purchase orders, customer commitments, delivery dates, transport quotes, commercial opportunities and company policy. The prototype uses explicitly synthetic business records. Public material is retrieved through Keenable and bounded direct-source adapters; the PDF module reads a real public supplier report through Modal.

**Where it lives:** Aiven PostgreSQL stores business snapshots and revisions, collected sources, content hashes, agent runs, proposals and decisions. The PDF module also persists extracted pages and provenance. Credentials stay on the server. Builder instructions and future test events stay outside the agent's product context.

**How it flows:** a public observation is collected and dated; the application relates it to authorised company context; the agent uses typed tools to inspect relevant facts and request deterministic calculations. The business engine checks product compatibility, quantities, reservations, confirmed supply, dates and cost. A proposal is tied to its data revision. Human approval is checked by the server and recorded durably; approval and actual execution are distinct states.

**What the data changes:** in the accepted risk case, a EUR 120 transfer would cover an urgent order but leave another order eight pallets short. The EUR 1,420 emergency-purchase plan preserves both commitments. The approved record and all 16 trace events survived restart on Aiven.

**Additional verified building blocks:** a 10,000-order-line portfolio was imported and independently read back on Aiven. Separately, a real 17-page PDF was extracted, stored and requested twice with one Modal extraction. These module results are distinct from acceptance of the richer industrial workflow. Public content does not itself confirm a fictional supplier delay; that case uses a separate synthetic internal confirmation.

**Reusable research:** in a separate reception, two real model runs retrieved the same three canonical observations from stored research. The second run followed process restart and made no new research HTTP attempt. This demonstrates reuse of attributed evidence, not autonomous learning or a measured reduction in model cost.
