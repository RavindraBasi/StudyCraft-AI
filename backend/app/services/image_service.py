import io
import os
import re
import json
import uuid
import urllib.parse
import urllib.request
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image
import pymupdf

from app.core.config import IMAGES_DIR
from app.models.db_models import DocumentImage
from sqlalchemy.orm import Session

# Minimum pixel threshold to ignore tiny decorative icons, bullets, and lines
MIN_IMAGE_WIDTH = 70
MIN_IMAGE_HEIGHT = 70
MIN_FILE_SIZE_BYTES = 800

def clean_concept_query(query: str) -> str:
    """
    Cleans study prompt into a concise academic concept suitable for encyclopedic/diagram search.
    Example: 'What is TCP Congestion Control and slow start?' -> 'TCP congestion control'
    """
    if not query:
        return ""
    q = query.strip()
    # Remove leading question prefixes
    q = re.sub(r'^(what is|explain|define|how does|why does|describe|tell me about|notes on|summary of|introduction to)\s+', '', q, flags=re.IGNORECASE)
    # Remove trailing question marks and punctuation
    q = re.sub(r'[?!,;:]+$', '', q).strip()
    # If query is still long, take the primary clause
    if len(q.split()) > 7:
        parts = re.split(r'\b(and|or|with|using|in|for)\b', q, flags=re.IGNORECASE)
        if parts:
            q = parts[0].strip()
    return q or query.strip()


def extract_images_from_pdf(
    file_path: Path,
    doc_id: str,
    pages_data: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Extracts embedded diagrams, illustrations, and figures from a PDF document using PyMuPDF.
    Saves images into storage/images/<doc_id>/ and returns metadata list for DB insertion.
    """
    if not file_path.exists():
        return []

    doc_img_dir = IMAGES_DIR / doc_id
    doc_img_dir.mkdir(parents=True, exist_ok=True)

    extracted_images = []
    
    try:
        pdf_doc = pymupdf.open(str(file_path))
        
        # Build page text mapping for caption generation
        page_text_map = {}
        if pages_data:
            for p in pages_data:
                page_text_map[p.get("page_number", 1)] = p.get("text_content", "")

        for page_idx, page in enumerate(pdf_doc):
            page_num = page_idx + 1
            image_list = page.get_images(full=True)
            page_text = page_text_map.get(page_num, page.get_text() or "")

            img_count_on_page = 0

            for img_info in image_list:
                xref = img_info[0]
                try:
                    base_image = pdf_doc.extract_image(xref)
                    if not base_image:
                        continue

                    image_bytes = base_image.get("image")
                    image_ext = base_image.get("ext", "png").lower()
                    width = base_image.get("width", 0)
                    height = base_image.get("height", 0)

                    # Filter out tiny icon noise or blank assets
                    if width < MIN_IMAGE_WIDTH or height < MIN_IMAGE_HEIGHT:
                        continue
                    if len(image_bytes) < MIN_FILE_SIZE_BYTES:
                        continue

                    # Validate with Pillow to ensure it's not a corrupted stream
                    try:
                        pil_img = Image.open(io.BytesIO(image_bytes))
                        # If color mode is CMYK or not web-friendly, convert to RGB
                        if pil_img.mode in ("CMYK", "P", "RGBA"):
                            if image_ext in ("jpg", "jpeg"):
                                pil_img = pil_img.convert("RGB")
                        width, height = pil_img.size
                    except Exception:
                        pass

                    img_count_on_page += 1
                    img_id = str(uuid.uuid4())
                    filename = f"page_{page_num}_fig_{img_count_on_page}.{image_ext}"
                    dest_path = doc_img_dir / filename

                    with open(dest_path, "wb") as f:
                        f.write(image_bytes)

                    # Generate a contextual caption from page text if available
                    caption = None
                    if page_text:
                        # Look for 'Figure', 'Fig.', 'Diagram', 'Chart' in text
                        fig_match = re.search(r'(?:Figure|Fig\.|Diagram|Chart|Table)\s*\d*[\.\:]?[^\.\n]{10,120}', page_text, re.IGNORECASE)
                        if fig_match:
                            caption = fig_match.group(0).strip()
                        else:
                            caption = f"Figure on Page {page_num}: " + page_text[:120].strip() + ("..." if len(page_text) > 120 else "")

                    extracted_images.append({
                        "id": img_id,
                        "document_id": doc_id,
                        "page_number": page_num,
                        "image_index": img_count_on_page,
                        "image_type": "embedded",
                        "file_path": str(dest_path.relative_to(IMAGES_DIR.parent)),
                        "image_url": f"/storage/images/{doc_id}/{filename}",
                        "width": width,
                        "height": height,
                        "format": image_ext,
                        "size_bytes": len(image_bytes),
                        "caption": caption
                    })

                except Exception as img_err:
                    print(f"Warning: Failed to extract image xref {xref} on page {page_num}: {img_err}")
                    continue

        pdf_doc.close()
        return extracted_images

    except Exception as e:
        print(f"Error during PDF image extraction: {e}")
        return extracted_images


def fetch_web_educational_images(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """
    Queries authoritative Wikimedia Commons / Wikipedia API for high-resolution
    educational diagrams, scientific illustrations, charts, and infographics.
    """
    clean_query = clean_concept_query(query)
    if not clean_query:
        return []

    images_found = []
    seen_urls = set()

    # Step 1: Query Wikipedia Page Images
    try:
        encoded_query = urllib.parse.quote(clean_query)
        wiki_url = (
            f"https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search"
            f"&gsrsearch={encoded_query}&gsrlimit={min(limit, 10)}"
            f"&prop=pageimages|pageterms|extracts&piprop=original|thumbnail&pithumbsize=800"
            f"&exintro=1&explaintext=1&exchars=200"
        )

        req = urllib.request.Request(
            wiki_url,
            headers={"User-Agent": "StudyCraftAI-AcademicAssistant/1.0 (academic-diagram-helper)"}
        )

        with urllib.request.urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})

            for page_id, pinfo in pages.items():
                title = pinfo.get("title", "")
                thumb_info = pinfo.get("thumbnail")
                orig_info = pinfo.get("original")

                img_url = (orig_info.get("source") if orig_info else None) or (thumb_info.get("source") if thumb_info else None)
                thumb_url = (thumb_info.get("source") if thumb_info else None) or img_url

                if not img_url:
                    continue

                if img_url in seen_urls:
                    continue

                # Filter out obvious non-diagrams like flag icons or tiny portraits if not relevant
                if any(bad in img_url.lower() for bad in ["disambig", "edit-clear", "symbol_question"]):
                    continue

                seen_urls.add(img_url)

                terms = pinfo.get("terms", {})
                descriptions = terms.get("description", [])
                desc_text = descriptions[0] if descriptions else pinfo.get("extract", "")
                if desc_text and len(desc_text) > 150:
                    desc_text = desc_text[:147] + "..."

                images_found.append({
                    "id": str(uuid.uuid4()),
                    "title": title,
                    "image_url": img_url,
                    "thumbnail_url": thumb_url,
                    "source_url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                    "source_name": "Wikipedia / Wikimedia Commons",
                    "description": desc_text or f"Academic concept visual for {title}",
                    "width": thumb_info.get("width", 800) if thumb_info else 800,
                    "height": thumb_info.get("height", 600) if thumb_info else 600
                })

                if len(images_found) >= limit:
                    break

    except Exception as err:
        print(f"Warning: Wikipedia image query error: {err}")

    # Step 2: If we still need more images/diagrams, query Wikimedia Commons search specifically for drawings/diagrams
    if len(images_found) < limit:
        try:
            commons_query = urllib.parse.quote(f"{clean_query} diagram OR structure OR chart OR illustration")
            commons_url = (
                f"https://commons.wikimedia.org/w/api.php?action=query&generator=search"
                f"&gsrnamespace=6&gsrsearch={commons_query}&gsrlimit={min(limit - len(images_found) + 4, 8)}"
                f"&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&format=json"
            )

            req_commons = urllib.request.Request(
                commons_url,
                headers={"User-Agent": "StudyCraftAI-AcademicAssistant/1.0 (academic-diagram-helper)"}
            )

            with urllib.request.urlopen(req_commons, timeout=6) as response:
                data_c = json.loads(response.read().decode("utf-8"))
                pages_c = data_c.get("query", {}).get("pages", {})

                for page_id, pinfo in pages_c.items():
                    title = pinfo.get("title", "").replace("File:", "").replace(".svg", "").replace(".png", "").replace(".jpg", "").replace("_", " ")
                    imageinfo = pinfo.get("imageinfo", [])
                    if not imageinfo:
                        continue

                    info0 = imageinfo[0]
                    img_url = info0.get("url")
                    thumb_url = info0.get("thumburl") or img_url

                    if not img_url or img_url in seen_urls:
                        continue

                    seen_urls.add(img_url)

                    extmeta = info0.get("extmetadata", {})
                    obj_desc = extmeta.get("ObjectName", {}).get("value") or extmeta.get("ImageDescription", {}).get("value") or ""
                    # Strip html from description
                    clean_desc = re.sub(r'<[^>]+>', '', obj_desc).strip()
                    if clean_desc and len(clean_desc) > 150:
                        clean_desc = clean_desc[:147] + "..."

                    images_found.append({
                        "id": str(uuid.uuid4()),
                        "title": title[:80],
                        "image_url": img_url,
                        "thumbnail_url": thumb_url,
                        "source_url": info0.get("descriptionurl") or "https://commons.wikimedia.org",
                        "source_name": "Wikimedia Commons",
                        "description": clean_desc or f"Educational diagram for {clean_query}",
                        "width": info0.get("thumbwidth", 800) or 800,
                        "height": info0.get("thumbheight", 600) or 600
                    })

                    if len(images_found) >= limit:
                        break

        except Exception as err:
            print(f"Warning: Wikimedia Commons diagram query error: {err}")

    return images_found


def get_document_images_from_db(
    doc_id: str,
    page_number: Optional[int] = None,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves stored textbook images from SQLite database for a document.
    """
    if not db:
        from app.core.database import SessionLocal
        db = SessionLocal()
        close_db = True
    else:
        close_db = False

    try:
        query = db.query(DocumentImage).filter(DocumentImage.document_id == doc_id)
        if page_number is not None:
            query = query.filter(DocumentImage.page_number == page_number)
        
        db_imgs = query.order_by(DocumentImage.page_number.asc(), DocumentImage.image_index.asc()).all()
        
        result = []
        for img in db_imgs:
            result.append({
                "id": img.id,
                "document_id": img.document_id,
                "page_number": img.page_number,
                "image_index": img.image_index,
                "image_type": img.image_type,
                "file_path": img.file_path,
                "image_url": f"/storage/images/{img.document_id}/{Path(img.file_path).name}",
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "size_bytes": img.size_bytes,
                "caption": img.caption
            })
        return result
    finally:
        if close_db:
            db.close()
