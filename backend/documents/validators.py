from django.core.exceptions import ValidationError


def validate_pdf(file):
    # File extension check
    if not file.name.lower().endswith(".pdf"):
        raise ValidationError("Only PDF files are allowed.")

    # Check PDF signature
    try:
        header = file.read(5)
        file.seek(0)
    except Exception:
        raise ValidationError("Unable to read the uploaded file.")

    if header != b"%PDF-":
        raise ValidationError("The uploaded file is not a valid PDF.")

    # 10 MB limit
    max_size = 10 * 1024 * 1024

    if file.size > max_size:
        raise ValidationError("PDF file size cannot exceed 10 MB.")