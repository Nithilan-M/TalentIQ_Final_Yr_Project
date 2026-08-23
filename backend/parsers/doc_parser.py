import os
import pymupdf as fitz  # PyMuPDF
import docx

def parse_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file using PyMuPDF (fitz).
    Handles multi-page PDFs, empty PDFs, scanned/image-only PDFs, and corrupted files.
    """
    if not os.path.exists(file_path):
        raise ValueError("Uploaded PDF file does not exist on disk.")

    file_size = os.path.getsize(file_path)
    if file_size == 0:
        raise ValueError("Uploaded file is empty (0 bytes). Please upload a valid Project Requirement PDF.")

    text_parts = []
    total_pages = 0
    total_images = 0

    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
        if total_pages == 0:
            doc.close()
            raise ValueError("Uploaded PDF contains no pages. Please upload a valid document.")

        for page in doc:
            page_text = page.get_text()
            if page_text:
                text_parts.append(page_text)
            total_images += len(page.get_images())
        
        doc.close()
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        raise ValueError(f"The PDF file appears to be corrupted or unreadable. Details: {str(e)}")

    full_text = "\n".join(text_parts).strip()
    
    if not full_text:
        if total_images > 0:
            raise ValueError("The uploaded PDF appears to be a scanned or image-only PDF without a selectable text layer. Please upload a PDF with readable text.")
        else:
            raise ValueError("Unable to extract project requirements from this PDF. The document contains no readable text.")

    if len(full_text) < 15:
        raise ValueError("Extracted text is too short to be a valid project requirement document.")

    return full_text

def parse_docx(file_path: str) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        text = "\n".join(full_text).strip()
        if not text:
            raise ValueError("The uploaded Word document contains no text.")
        return text
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        raise ValueError(f"Failed to parse DOCX file: {str(e)}")

def parse_txt(file_path: str) -> str:
    """Extract text from a TXT file."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read().strip()
            if not text:
                raise ValueError("The uploaded text file is empty.")
            return text
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        raise ValueError(f"Failed to parse TXT file: {str(e)}")

def parse_document(file_path: str) -> str:
    """Detect file extension and parse the document text."""
    _, ext = os.path.splitext(file_path.lower())
    
    if ext == ".pdf":
        return parse_pdf(file_path)
    elif ext == ".docx":
        return parse_docx(file_path)
    elif ext in [".txt", ".md", ".json"]:
        return parse_txt(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Only PDF documents are supported for Project Requirement uploads.")

