import io
import os
from typing import Union
import fitz  # PyMuPDF
import docx
from module1.parsing.clean import clean_text


class DocumentExtractionError(Exception):
    """Raised when text cannot be extracted from a document."""
    pass


def extract_text_from_pdf(source: Union[str, bytes]) -> str:
    """Extracts raw text from a PDF file path or byte buffer using PyMuPDF."""
    text_chunks = []
    try:
        if isinstance(source, bytes):
            doc = fitz.open(stream=source, filetype="pdf")
        else:
            if not os.path.exists(source):
                raise DocumentExtractionError(f"PDF file not found at: {source}")
            doc = fitz.open(source)

        if doc.page_count == 0:
            raise DocumentExtractionError("PDF document is empty (0 pages).")

        for page_idx in range(doc.page_count):
            page = doc[page_idx]
            page_text = page.get_text("text")
            if page_text:
                text_chunks.append(page_text)

        doc.close()
    except Exception as e:
        if isinstance(e, DocumentExtractionError):
            raise e
        raise DocumentExtractionError(f"Failed to read PDF document: {str(e)}")

    full_text = "\n".join(text_chunks)
    cleaned = clean_text(full_text)
    if not cleaned.strip():
        raise DocumentExtractionError("PDF text extraction resulted in empty content. Document may be scanned or corrupted.")
    return cleaned


def extract_text_from_docx(source: Union[str, bytes]) -> str:
    """Extracts raw text from a DOCX file path or byte buffer using python-docx."""
    text_chunks = []
    try:
        if isinstance(source, bytes):
            file_stream = io.BytesIO(source)
            doc = docx.Document(file_stream)
        else:
            if not os.path.exists(source):
                raise DocumentExtractionError(f"DOCX file not found at: {source}")
            doc = docx.Document(source)

        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_chunks.append(paragraph.text)

        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    text_chunks.append(row_text)

    except Exception as e:
        if isinstance(e, DocumentExtractionError):
            raise e
        raise DocumentExtractionError(f"Failed to read DOCX document: {str(e)}")

    full_text = "\n".join(text_chunks)
    cleaned = clean_text(full_text)
    if not cleaned.strip():
        raise DocumentExtractionError("DOCX text extraction resulted in empty content.")
    return cleaned


def extract_text(source: Union[str, bytes], filename: str = "") -> str:
    """
    Extracts text from PDF or DOCX file by checking extension.
    """
    ext = ""
    if filename:
        ext = os.path.splitext(filename)[1].lower()
    elif isinstance(source, str):
        ext = os.path.splitext(source)[1].lower()

    if ext == ".pdf":
        return extract_text_from_pdf(source)
    elif ext in [".docx", ".doc"]:
        if ext == ".doc":
            raise DocumentExtractionError("Legacy .doc format is not supported. Please upload a .docx or .pdf file.")
        return extract_text_from_docx(source)
    else:
        raise DocumentExtractionError(f"Unsupported file format '{ext}'. Only PDF (.pdf) and Word (.docx) files are supported.")
