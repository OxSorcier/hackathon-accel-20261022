import json
import unittest

from starlette.requests import Request

from accel_pdf_http import read_pdf_request
from accel_pdf_reader import MAX_PDF_BYTES
from test_reader import pdf_bytes


def request(chunks: list[bytes], content_type: str = "application/pdf",
            content_length: str | None = None) -> Request:
    headers = [(b"content-type", content_type.encode())]
    if content_length is not None:
        headers.append((b"content-length", content_length.encode()))
    remaining = list(chunks)

    async def receive() -> dict[str, object]:
        part = remaining.pop(0) if remaining else b""
        return {"type": "http.request", "body": part, "more_body": bool(remaining)}

    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers}, receive)


class HttpTests(unittest.IsolatedAsyncioTestCase):
    async def test_streamed_pdf_returns_pages_and_digest(self) -> None:
        data = pdf_bytes(["Native public text"])
        response = await read_pdf_request(request([data[:30], data[30:]], content_length=str(len(data))))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.body)["pages"][0]["text"], "Native public text")

    async def test_unsupported_type_and_declared_oversize_are_rejected(self) -> None:
        for value, expected in [(request([b"secret"], "text/plain"), 415),
                                (request([], content_length=str(MAX_PDF_BYTES + 1)), 413),
                                (request([], content_length="invalid"), 400)]:
            response = await read_pdf_request(value)
            self.assertEqual(response.status_code, expected)
            self.assertEqual(set(json.loads(response.body)), {"error"})

    async def test_stream_limit_is_enforced_without_content_length(self) -> None:
        response = await read_pdf_request(request([b"%PDF-1.4\n", b" " * MAX_PDF_BYTES]))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(json.loads(response.body)["error"]["code"], "PDF_TOO_LARGE")

    async def test_invalid_pdf_and_blank_pdf_are_distinct(self) -> None:
        invalid = await read_pdf_request(request([b"not a PDF"]))
        self.assertEqual(invalid.status_code, 415)
        self.assertEqual(json.loads(invalid.body)["error"]["code"], "PDF_INVALID")
        blank = await read_pdf_request(request([pdf_bytes([""])]))
        self.assertEqual(blank.status_code, 200)
        self.assertEqual(json.loads(blank.body)["status"], "empty")

    async def test_mismatched_length_is_explicit(self) -> None:
        response = await read_pdf_request(request([b"%PDF-1.4\n"], content_length="100"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(json.loads(response.body)["error"]["code"], "PDF_LENGTH_MISMATCH")
