"""Behaviour tests using PDF bytes constructed independently of the extractor."""
import hashlib
import io
import unittest
import unicodedata

from pypdf import PdfReader, PdfWriter

from accel_pdf_reader import (
    EXTRACTOR_VERSION,
    MAX_PAGES,
    MAX_PAGE_CHARACTERS,
    MAX_PDF_BYTES,
    PdfExtractionError,
    extract_pdf,
)


def pdf_bytes(texts: list[str], unicode_map: bytes | None = None) -> bytes:
    objects: list[bytes] = []
    font_id = 3 + len(texts) * 2
    children = " ".join(f"{3 + i * 2} 0 R" for i in range(len(texts)))
    objects.extend([
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{children}] /Count {len(texts)} >>".encode(),
    ])
    for index, text in enumerate(texts):
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 30 700 Td ({escaped}) Tj ET".encode("latin-1")
        objects.extend([
            (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
             f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
             f"/Contents {4 + index * 2} 0 R >>").encode(),
            f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
        ])
    unicode_ref = f" /ToUnicode {font_id + 1} 0 R" if unicode_map is not None else ""
    objects.append(("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica" + unicode_ref + " >>").encode())
    if unicode_map is not None:
        objects.append(f"<< /Length {len(unicode_map)} >>\nstream\n".encode() + unicode_map + b"\nendstream")
    result = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, value in enumerate(objects, start=1):
        offsets.append(len(result))
        result.extend(f"{index} 0 obj\n".encode() + value + b"\nendobj\n")
    xref = len(result)
    result.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode())
    result.extend((f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                   f"startxref\n{xref}\n%%EOF\n").encode())
    return bytes(result)


class ReaderTests(unittest.TestCase):
    def test_nul_removal_preserves_canonical_unicode_and_its_hash(self) -> None:
        cmap = b"""/CIDInit /ProcSet findresource begin
12 dict begin begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def /CMapType 2 def
1 begincodespacerange <00> <FF> endcodespacerange
3 beginbfchar <41> <0065> <42> <0000> <43> <0301> endbfchar
endcmap CMapName currentdict /CMap defineresource pop end end"""
        source = pdf_bytes(["ABC"], unicode_map=cmap)
        raw = PdfReader(io.BytesIO(source)).pages[0].extract_text()
        self.assertEqual(raw, "e\x00\u0301")
        result = extract_pdf(source)
        page = result["pages"][0]
        self.assertEqual(page["text"], "é")
        self.assertTrue(unicodedata.is_normalized("NFC", page["text"]))
        self.assertEqual(page["characterCount"], 1)
        self.assertEqual(page["textHash"], hashlib.sha256("é".encode()).hexdigest())

    def test_pages_are_numbered_and_preserve_document_and_text_hashes(self) -> None:
        source = pdf_bytes(["Energy and transportation costs", "Roof insulation demand"])
        result = extract_pdf(source)
        self.assertEqual(result["schemaVersion"], "pdf-extraction/v1")
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["documentHash"], hashlib.sha256(source).hexdigest())
        self.assertEqual(result["byteLength"], len(source))
        self.assertEqual(result["extractorVersion"], EXTRACTOR_VERSION)
        self.assertEqual(result["pageCount"], 2)
        self.assertEqual([p["number"] for p in result["pages"]], [1, 2])
        self.assertEqual(result["pages"][0]["text"], "Energy and transportation costs")
        for page in result["pages"]:
            self.assertEqual(page["textHash"], hashlib.sha256(page["text"].encode()).hexdigest())
        self.assertEqual(extract_pdf(source), result)

    def test_blank_pages_are_explicit_without_a_successful_empty_extraction(self) -> None:
        empty = extract_pdf(pdf_bytes(["", ""]))
        self.assertEqual(empty["status"], "empty")
        self.assertEqual(empty["emptyPages"], [1, 2])
        self.assertEqual(empty["characterCount"], 0)
        mixed = extract_pdf(pdf_bytes(["Confirmed public text", ""]))
        self.assertEqual(mixed["status"], "partial")
        self.assertEqual(mixed["emptyPages"], [2])
        self.assertEqual(mixed["pageCount"], 2)

    def test_invalid_and_oversized_payloads_return_stable_errors(self) -> None:
        for value, code in [(b"", "PDF_EMPTY_INPUT"), (b"not a pdf", "PDF_INVALID"),
                            (b"%PDF-1.4\nbroken", "PDF_INVALID"),
                            (b"%PDF-1.4\n" + b" " * MAX_PDF_BYTES, "PDF_TOO_LARGE")]:
            with self.subTest(code=code):
                with self.assertRaises(PdfExtractionError) as raised:
                    extract_pdf(value)
                self.assertEqual(raised.exception.code, code)

    def test_encrypted_documents_are_rejected_without_attempting_passwords(self) -> None:
        writer = PdfWriter()
        writer.append(PdfReader(io.BytesIO(pdf_bytes(["Restricted text"]))))
        writer.encrypt("private-password-for-local-fixture")
        output = io.BytesIO()
        writer.write(output)
        with self.assertRaises(PdfExtractionError) as raised:
            extract_pdf(output.getvalue())
        self.assertEqual(raised.exception.code, "PDF_ENCRYPTED")

    def test_pdf_readable_without_a_password_is_supported_even_with_owner_protection(self) -> None:
        writer = PdfWriter()
        writer.append(PdfReader(io.BytesIO(pdf_bytes(["Public report text"]))))
        writer.encrypt(user_password="", owner_password="owner-permission-fixture", algorithm="AES-256")
        output = io.BytesIO()
        writer.write(output)
        result = extract_pdf(output.getvalue())
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["pages"][0]["text"], "Public report text")

    def test_page_limit_is_checked_before_returning_partial_document_as_complete(self) -> None:
        with self.assertRaises(PdfExtractionError) as raised:
            extract_pdf(pdf_bytes(["one line"] * (MAX_PAGES + 1)))
        self.assertEqual(raised.exception.code, "PDF_PAGE_LIMIT")

    def test_zero_pages_and_excessive_text_are_explicit_errors(self) -> None:
        for value, code in [(pdf_bytes([]), "PDF_NO_PAGES"),
                            (pdf_bytes(["x" * (MAX_PAGE_CHARACTERS + 1)]), "PDF_TEXT_LIMIT"),
                            (pdf_bytes(["x" * 29_000] * 7), "PDF_TEXT_LIMIT")]:
            with self.subTest(code=code):
                with self.assertRaises(PdfExtractionError) as raised:
                    extract_pdf(value)
                self.assertEqual(raised.exception.code, code)


if __name__ == "__main__":
    unittest.main()
