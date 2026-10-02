from pathlib import Path
import pypdf
from typing import List, Dict, Any, Tuple

class PDFProcessingError(Exception):
    """Custom exception for PDF validation or parsing failures."""
    pass

def validate_pdf_file(file_path: Path) -> Tuple[bool, str]:
    """
    Validates file exists, has PDF magic header, and can be read by pypdf.
    Returns (is_valid, error_reason).
    """
    if not file_path.exists():
        return False, "File does not exist on disk."

    if file_path.stat().st_size == 0:
        return False, "Uploaded file is empty (0 bytes)."

    # Check PDF magic bytes (%PDF-)
    try:
        with open(file_path, "rb") as f:
            header = f.read(5)
            if not header.startswith(b"%PDF-"):
                return False, "File header does not match a valid PDF document (%PDF- magic bytes missing)."
    except Exception as e:
        return False, f"Could not read file header: {str(e)}"

    # Attempt parsing with pypdf
    try:
        reader = pypdf.PdfReader(str(file_path))
        if reader.is_encrypted:
            try:
                decrypted = reader.decrypt("")
                if not decrypted:
                    return False, "PDF is password protected / encrypted."
            except Exception:
                return False, "PDF is password protected / encrypted."

        if len(reader.pages) == 0:
            return False, "PDF document contains 0 pages."

    except Exception as e:
        return False, f"Failed to parse PDF document structure: {str(e)}"

    return True, ""


def extract_pages_from_pdf(file_path: Path) -> List[Dict[str, Any]]:
    """
    Extracts text page by page from the PDF.
    Preserves page numbers (1-based).
    Returns list of page info dicts with page boundaries preserved.
    """
    is_valid, error_msg = validate_pdf_file(file_path)
    if not is_valid:
        raise PDFProcessingError(error_msg)

    try:
        reader = pypdf.PdfReader(str(file_path))
        pages_data = []

        for i, page in enumerate(reader.pages):
            page_number = i + 1
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""

            cleaned_text = text.strip()
            is_empty = len(cleaned_text) == 0
            char_count = len(cleaned_text)
            word_count = len(cleaned_text.split()) if cleaned_text else 0

            pages_data.append({
                "page_number": page_number,
                "text_content": cleaned_text,
                "char_count": char_count,
                "word_count": word_count,
                "is_empty": is_empty
            })

        return pages_data

    except Exception as e:
        if isinstance(e, PDFProcessingError):
            raise e
        raise PDFProcessingError(f"Error during page text extraction: {str(e)}")


def create_text_previews(pages_data: List[Dict[str, Any]], max_previews: int = 5, preview_char_limit: int = 200) -> List[Dict[str, Any]]:
    """
    Generates text previews for the first N pages of the extracted PDF.
    """
    previews = []
    for p in pages_data[:max_previews]:
        page_num = p["page_number"]
        text = p["text_content"]
        is_empty = p.get("is_empty", False)

        if is_empty or not text:
            snippet = "[No selectable text detected / Scanned image page]"
        else:
            snippet = text[:preview_char_limit] + ("..." if len(text) > preview_char_limit else "")

        previews.append({
            "page": page_num,
            "text_snippet": snippet,
            "is_empty": is_empty
        })

    return previews
