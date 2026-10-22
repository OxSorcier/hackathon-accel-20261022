# Modal PDF reader

Stateless extraction of native text from public PDF bytes. The application backend owns source download policy, identity, provenance metadata, Aiven persistence and the model context. This service receives only PDF bytes and returns numbered physical pages with document and text hashes.

The request/response contract is in `../../proposals/modal/CONTRACT.json`. The exact response type is `PdfExtraction` in `accel_pdf_reader.py`.

## Local verification

Use Python 3.12 in an isolated `.venv` and install `requirements.lock`. Run from this folder:

```sh
PYTHONPATH=. .venv/bin/python -m unittest discover -s tests -v
```

The tests construct independent PDF bytes and cover page numbering, byte and text hashes, empty pages, encrypted or invalid input, streaming length and size limits. Real primary-source and Modal runtime checks are recorded separately under `proposals/modal/`.

## Deployment and credentials

The Modal application is `accel-pdf-reader`; `modal_app.py` exposes POST `extract_document` with `requires_proxy_auth=True`. Only the two reader modules are explicitly copied into its image. It has no Aiven connection, business secrets, persistent volume or arbitrary URL fetch.

Deployment uses a separate short-lived local Modal CLI profile. The application server uses only the HTTP Proxy Token pair, never deployment credentials. Credentials and the private endpoint URL live in the existing ignored `.env.access`, permissions 0600. No credentials belong in this folder, screenshots or receipts.

On Modal Starter the Proxy Token invokes all proxy-protected Web Functions of its Workspace. Naming it after this service does not narrow that scope. Inventory the Workspace before provisioning it; unrelated private interfaces require reconciliation. Authentication is checked at Modal's proxy, before PDF processing. Application fetch must reject redirects when it includes credentials.

The first slice supports native-text PDFs up to 10 MiB, 40 pages, 30,000 characters per page and 200,000 characters in total. It never silently truncates. Pages without native text remain visible through `emptyPages`; an entirely scanned or blank document returns `status: empty`. OCR is not part of this slice. Documents requiring an opening password, malformed and over-limit documents return stable errors. Public PDFs that open without a password remain supported even when they declare owner protection; no password input or guessing is implemented.

## Demonstration

The received public sample is the ROCKWOOL H1 2026 report. Expected: 17 pages, exact byte hash from the contract, and the page 3 phrases listed there. It is a Group-level source, not proof of an incident in Soissons or of a commercial relationship with the synthetic company.

Acceptance in the application requires a real authenticated Modal call, provenance persisted/read back from Aiven, numbered excerpts visible to the user and agent, and reuse without a second extraction for unchanged document bytes and extractor version. Local extraction alone does not prove that flow.
