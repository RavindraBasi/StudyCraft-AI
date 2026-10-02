from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def create_sample_pdf(filename="sample_biology_textbook.pdf"):
    c = canvas.Canvas(filename, pagesize=letter)
    
    # Page 1
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "Chapter 1: Principles of Cell Biology")
    c.setFont("Helvetica", 12)
    c.drawString(50, 720, "Cellular biology is the foundational discipline of modern life sciences.")
    c.drawString(50, 700, "All living organisms are composed of one or more cells.")
    c.drawString(50, 680, "The cell is the basic structural and functional unit of life.")
    c.showPage()
    
    # Page 2
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "Chapter 2: Photosynthesis and Energy Conversion")
    c.setFont("Helvetica", 12)
    c.drawString(50, 720, "Photosynthesis converts solar light energy into chemical energy stored in glucose.")
    c.drawString(50, 700, "Chloroplasts contain chlorophyll pigments that absorb specific wavelengths of light.")
    c.drawString(50, 680, "The light-dependent reactions take place in the thylakoid membranes.")
    c.showPage()
    
    c.save()
    print(f"Successfully generated '{filename}'")

if __name__ == "__main__":
    create_sample_pdf()

