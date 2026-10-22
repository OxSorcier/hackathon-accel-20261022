## Technology usage

- **Aiven for PostgreSQL:** durable storage for company data, source evidence, versioned proposals, decisions and attributed memory. The product connection, migrations and readback after reconnection have been tested on Aiven with synthetic data.
- **Aiven Runtime:** target hosting for the application server and background monitoring. Deployment is pending.
- **OpenAI API:** bounded tool calling for company-context lookup, deterministic business evaluation and reviewable proposals. Real model calls, proposal approval and persisted readback have been exercised from the local server against Aiven with synthetic company data.
- **Keenable API:** public web search and content retrieval for sector monitoring. A real public source has been retrieved, persisted and used in a decision case. Collection is bounded and partial; public news does not establish a commercial relationship or an actual supplier delay.

Final UI/data reception and Runtime deployment are pending. No inventory movement or purchase is executed by approval. See docs/ACCES-CREDITS.md and docs/STATUS.md for the current evidence.
