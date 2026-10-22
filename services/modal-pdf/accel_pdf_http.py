"""HTTP boundary shared by the deployed Modal function and local protocol tests."""
from fastapi import Request
from fastapi.responses import JSONResponse

from accel_pdf_reader import MAX_PDF_BYTES, PdfExtractionError, extract_pdf


def _error(code: str, status: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": "The PDF could not be processed."}}, status_code=status)


async def read_pdf_request(request: Request) -> JSONResponse:
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/pdf":
        return _error("PDF_CONTENT_TYPE", 415)
    declared = request.headers.get("content-length")
    if declared is not None and (not declared.isascii() or not declared.isdigit() or len(declared) > 12):
        return _error("PDF_CONTENT_LENGTH", 400)
    if declared is not None and int(declared) > MAX_PDF_BYTES:
        return _error("PDF_TOO_LARGE", 413)
    chunks: list[bytes] = []
    length = 0
    try:
        async for chunk in request.stream():
            length += len(chunk)
            if length > MAX_PDF_BYTES:
                return _error("PDF_TOO_LARGE", 413)
            chunks.append(chunk)
    except Exception:
        return _error("PDF_STREAM_ERROR", 400)
    if declared is not None and int(declared) != length:
        return _error("PDF_LENGTH_MISMATCH", 400)
    try:
        return JSONResponse(extract_pdf(b"".join(chunks)))
    except PdfExtractionError as error:
        return _error(error.code, error.http_status)
    except Exception:
        return _error("PDF_EXTRACTION_FAILED", 500)
