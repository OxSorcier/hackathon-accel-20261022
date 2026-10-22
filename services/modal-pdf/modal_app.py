"""Private, stateless Modal service. Only the two reader modules enter the image."""
from pathlib import Path

import modal
from fastapi import Request
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent
app = modal.App("accel-pdf-reader")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements(str(ROOT / "requirements.lock"))
    .add_local_file(str(ROOT / "accel_pdf_reader.py"), "/root/accel_pdf_reader.py", copy=True)
    .add_local_file(str(ROOT / "accel_pdf_http.py"), "/root/accel_pdf_http.py", copy=True)
)


@app.function(image=image, cpu=1.0, memory=1024, timeout=60, max_containers=2, scaledown_window=30)
@modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
async def extract_document(request: Request) -> JSONResponse:
    from accel_pdf_http import read_pdf_request

    return await read_pdf_request(request)
