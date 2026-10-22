"""Bounded native-text PDF extraction. It never fetches URLs or executes PDF actions."""
import hashlib
import io
import unicodedata
from typing import Literal, TypedDict

from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError, WrongPasswordError

MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_PAGES = 40
MAX_PAGE_CHARACTERS = 30_000
MAX_TEXT_CHARACTERS = 200_000
EXTRACTOR_VERSION = "pypdf/6.21.2+accel.1"


class ExtractedPage(TypedDict):
    number: int
    text: str
    textHash: str
    characterCount: int


class PdfExtraction(TypedDict):
    schemaVersion: Literal["pdf-extraction/v1"]
    status: Literal["complete", "partial", "empty"]
    documentHash: str
    byteLength: int
    pageCount: int
    pages: list[ExtractedPage]
    emptyPages: list[int]
    characterCount: int
    extractorVersion: str


class PdfExtractionError(Exception):
    def __init__(self, code: str, http_status: int = 422) -> None:
        super().__init__(code)
        self.code = code
        self.http_status = http_status


def extract_pdf(data: bytes) -> PdfExtraction:
    """Return all physical pages or a stable error, with no silent truncation."""
    if not data:
        raise PdfExtractionError("PDF_EMPTY_INPUT", 400)
    if len(data) > MAX_PDF_BYTES:
        raise PdfExtractionError("PDF_TOO_LARGE", 413)
    if not data.startswith(b"%PDF-"):
        raise PdfExtractionError("PDF_INVALID", 415)
    pages: list[ExtractedPage] = []
    empty_pages: list[int] = []
    characters = 0
    try:
        with io.BytesIO(data) as stream:
            reader = PdfReader(stream, strict=True)
            # pypdf opens documents readable without a password in the normal way.
            # No password input or guessing is supported by this service.
            count = len(reader.pages)
            if count == 0:
                raise PdfExtractionError("PDF_NO_PAGES")
            if count > MAX_PAGES:
                raise PdfExtractionError("PDF_PAGE_LIMIT")
            for number, page in enumerate(reader.pages, start=1):
                text = unicodedata.normalize("NFC", (page.extract_text() or "").replace("\x00", "")).strip()
                characters += len(text)
                if len(text) > MAX_PAGE_CHARACTERS or characters > MAX_TEXT_CHARACTERS:
                    raise PdfExtractionError("PDF_TEXT_LIMIT")
                if not text:
                    empty_pages.append(number)
                pages.append({"number": number, "text": text,
                              "textHash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                              "characterCount": len(text)})
    except PdfExtractionError:
        raise
    except (FileNotDecryptedError, WrongPasswordError):
        raise PdfExtractionError("PDF_ENCRYPTED") from None
    except Exception:
        raise PdfExtractionError("PDF_INVALID") from None
    status: Literal["complete", "partial", "empty"] = "complete"
    if empty_pages:
        status = "empty" if len(empty_pages) == len(pages) else "partial"
    return {"schemaVersion": "pdf-extraction/v1", "status": status,
            "documentHash": hashlib.sha256(data).hexdigest(), "byteLength": len(data),
            "pageCount": len(pages), "pages": pages, "emptyPages": empty_pages,
            "characterCount": characters, "extractorVersion": EXTRACTOR_VERSION}
