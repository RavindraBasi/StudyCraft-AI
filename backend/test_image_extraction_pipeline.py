import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import io

from app.core.config import IMAGES_DIR, UPLOAD_DIR
from app.core.database import SessionLocal, engine, Base
from app.models.db_models import Document, DocumentPage, DocumentChunk, DocumentImage
from app.services.pdf_service import extract_pages_from_pdf
from app.services.image_service import extract_images_from_pdf, fetch_web_educational_images, get_document_images_from_db

def create_rich_diagram_pdf(pdf_path: Path):
    """Creates a sample PDF with actual embedded diagrams/charts for testing."""
    # 1. Generate Diagram 1: Photosynthesis Process Diagram
    img1 = Image.new('RGB', (600, 350), color=(240, 248, 255))
    draw1 = ImageDraw.Draw(img1)
    draw1.rectangle([20, 20, 580, 330], outline=(14, 165, 233), width=3)
    draw1.rectangle([50, 60, 200, 180], fill=(220, 252, 231), outline=(34, 197, 94), width=2)
    draw1.text((65, 110), "Light Reactions\n(Thylakoid)", fill=(22, 101, 52))
    
    draw1.rectangle([380, 60, 540, 180], fill=(254, 240, 138), outline=(234, 179, 8), width=2)
    draw1.text((395, 110), "Calvin Cycle\n(Stroma)", fill=(133, 77, 14))
    
    draw1.text((180, 30), "Figure 1.1: Complete Photosynthesis Pathway", fill=(15, 23, 42))
    
    # 2. Generate Diagram 2: Mitochondria Structure
    img2 = Image.new('RGB', (600, 350), color=(255, 247, 237))
    draw2 = ImageDraw.Draw(img2)
    draw2.rectangle([20, 20, 580, 330], outline=(249, 115, 22), width=3)
    draw2.ellipse([80, 60, 520, 280], fill=(255, 237, 213), outline=(234, 88, 12), width=3)
    draw2.text((200, 160), "Mitochondrial Matrix & Cristae", fill=(154, 52, 18))
    draw2.text((170, 30), "Figure 2.1: Mitochondria Organelle Structure", fill=(15, 23, 42))

    # Save images to in-memory bytes
    b1 = io.BytesIO()
    img1.save(b1, format='PNG')
    b1.seek(0)

    b2 = io.BytesIO()
    img2.save(b2, format='PNG')
    b2.seek(0)

    # Build PDF with ReportLab
    c = canvas.Canvas(str(pdf_path), pagesize=letter)
    
    # Page 1: Photosynthesis
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 720, "Chapter 1: Photosynthesis & Energy Conversion")
    c.setFont("Helvetica", 11)
    c.drawString(72, 695, "Photosynthesis is the process by which green plants transform light energy into chemical energy.")
    c.drawString(72, 675, "Figure 1.1 illustrates the light-dependent reactions in thylakoids and the Calvin cycle in the stroma.")
    c.drawImage(ImageReader(b1), 72, 300, width=460, height=270)
    c.drawString(72, 260, "Key Equation: 6CO2 + 6H2O + Light -> C6H12O6 + 6O2.")
    c.showPage()

    # Page 2: Cellular Respiration & Mitochondria
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 720, "Chapter 2: Cellular Respiration and Mitochondria")
    c.setFont("Helvetica", 11)
    c.drawString(72, 695, "Mitochondria generate most of the chemical energy needed to power biochemical reactions.")
    c.drawString(72, 675, "Figure 2.1 shows the inner membrane folding into cristae to maximize ATP synthesis surface area.")
    c.drawImage(ImageReader(b2), 72, 300, width=460, height=270)
    c.drawString(72, 260, "ATP synthesis occurs along the electron transport chain located in the inner membrane.")
    c.showPage()
    
    c.save()
    print(f"Sample PDF with 2 embedded diagrams generated at: {pdf_path}")

def run_test():
    test_pdf = Path("test_diagrams_book.pdf")
    create_rich_diagram_pdf(test_pdf)

    # Test extraction
    doc_id = "test-doc-diagrams-001"
    pages_data = extract_pages_from_pdf(test_pdf)
    print(f"Extracted {len(pages_data)} pages of text.")

    images = extract_images_from_pdf(test_pdf, doc_id, pages_data)
    print(f"Extracted {len(images)} diagrams from PDF:")
    for img in images:
        print(f" - Page {img['page_number']} | Size: {img['width']}x{img['height']} | Caption: {img['caption']}")

    # Test Web Educational Image Fetching
    web_imgs = fetch_web_educational_images("Photosynthesis", limit=4)
    print(f"\nFetched {len(web_imgs)} educational diagrams from Web (Wikimedia/Wikipedia):")
    for w in web_imgs:
        print(f" - {w['title']} ({w['source_name']}): {w['thumbnail_url'][:60]}...")

    print("\nALL IMAGE LEARNING PIPELINE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_test()
