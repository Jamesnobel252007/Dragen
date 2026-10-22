
import html
import io
import logging
import os
import re
import statistics
import uuid

import pymupdf  # PyMuPDF / fitz
import requests

from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.views.decorators.clickjacking import xframe_options_exempt

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Document
from .serializers import DocumentSerializer
from collaboration.models import Collaborator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# High-Fidelity PDF Extraction & Layout Analysis Engine
# ---------------------------------------------------------------------------

def _color_int_to_hex(color_int):
    """Convert a PyMuPDF 24-bit sRGB integer into a hex color string."""
    if color_int is None or not isinstance(color_int, int) or color_int < 0:
        return None
    # Filter out pure black or default text color to avoid excessive inline styles
    if color_int == 0 or color_int == 0x202124 or color_int == 0x111110:
        return None
    r = (color_int >> 16) & 255
    g = (color_int >> 8) & 255
    b = color_int & 255
    return f"#{r:02x}{g:02x}{b:02x}"


def _span_to_tiptap_html(span, typical_size):
    """Convert an individual text span to styled, safe Tiptap HTML."""
    text = html.escape(span.get("text", ""), quote=False)
    if not text:
        return ""

    font_name = (span.get("font") or "").lower()
    flags = span.get("flags", 0)

    try:
        size = float(span.get("size", typical_size))
    except (TypeError, ValueError):
        size = typical_size

    size = max(7.0, min(72.0, round(size, 1)))
    styles = []

    # Only include font size style if noticeably different from standard body text
    if abs(size - typical_size) >= 0.5:
        styles.append(f"font-size: {size:.1f}pt")

    color_int = span.get("color")
    color_hex = _color_int_to_hex(color_int)
    if color_hex:
        styles.append(f"color: {color_hex}")

    if styles:
        text = f'<span style="{"; ".join(styles)}">{text}</span>'

    # Font style flags: bit 1 (italic), bit 4 (bold)
    is_italic = bool(flags & 2) or any(w in font_name for w in ("italic", "oblique"))
    is_bold = bool(flags & 16) or any(w in font_name for w in ("bold", "black", "heavy", "semibold"))

    if is_italic:
        text = f"<em>{text}</em>"
    if is_bold:
        text = f"<strong>{text}</strong>"

    return text


def _extract_page_images(page, doc_id, page_num):
    """Extract embedded images from page and save via Django default_storage."""
    from django.core.files.base import ContentFile

    image_htmls = []
    try:
        image_list = page.get_images(full=True)
        if not image_list:
            return image_htmls

        for img_idx, img in enumerate(image_list[:5]):  # limit per page to avoid memory exhaustion
            xref = img[0]
            base_image = page.parent.extract_image(xref)
            image_bytes = base_image.get("image")
            image_ext = base_image.get("ext", "png")

            # Skip tiny icons / decorative lines (< 60px)
            width = base_image.get("width", 0)
            height = base_image.get("height", 0)
            if width < 60 and height < 60:
                continue

            rel_filename = f"documents/images/doc_{doc_id}_p{page_num}_{img_idx}_{uuid.uuid4().hex[:6]}.{image_ext}"
            saved_name = default_storage.save(rel_filename, ContentFile(image_bytes))
            img_url = default_storage.url(saved_name)

            image_htmls.append(
                f'<p style="text-align: center;"><img src="{img_url}" alt="Figure from page {page_num}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0;" /></p>'
            )
    except Exception as e:
        logger.warning("Image extraction warning for page %d: %s", page_num, e)

    return image_htmls


def _extract_page_tables(page):
    """Extract tabular data using PyMuPDF TableFinder if available."""
    table_items = []
    table_bboxes = []

    if not hasattr(page, "find_tables"):
        return table_items, table_bboxes

    try:
        tabs = page.find_tables()
        for tab in tabs:
            bbox = tab.bbox
            table_bboxes.append(bbox)
            extracted = tab.extract()
            if not extracted or len(extracted) < 1:
                continue

            rows_html = []
            for r_idx, row in enumerate(extracted):
                cell_tag = "th" if r_idx == 0 else "td"
                cells = []
                for cell in row:
                    cell_text = html.escape(str(cell or "").strip(), quote=False)
                    cells.append(
                        f'<{cell_tag} style="border: 1px solid #d4cebf; padding: 6px 10px; text-align: left;">{cell_text}</{cell_tag}>'
                    )
                rows_html.append(f"<tr>{''.join(cells)}</tr>")

            if rows_html:
                table_markup = (
                    '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #d4cebf;">'
                    f'<tbody>{"".join(rows_html)}</tbody>'
                    '</table>'
                )
                table_items.append({"html": table_markup, "bbox": bbox})
    except Exception as e:
        logger.warning("Table extraction error: %s", e)

    return table_items, table_bboxes


def _is_inside_any_bbox(bbox, bboxes):
    """Check if block's bounding box intersects with any table bounding box."""
    if not bbox or not bboxes:
        return False
    bx0, by0, bx1, by1 = bbox
    for tx0, ty0, tx1, ty1 in bboxes:
        if bx0 >= tx0 - 5 and bx1 <= tx1 + 5 and by0 >= ty0 - 5 and by1 <= ty1 + 5:
            return True
    return False


def _perform_ocr_fallback(page, page_num):
    """Fallback OCR for scanned pages using pytesseract if installed."""
    try:
        import pytesseract
        from PIL import Image

        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        ocr_text = pytesseract.image_to_string(img)
        lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]

        if not lines:
            return "", False

        paragraphs = [f"<p>{html.escape(line, quote=False)}</p>" for line in lines]
        return "\n".join(paragraphs), True
    except Exception as e:
        logger.info("OCR not available or failed on page %d: %s", page_num, e)
        return "", False


def extract_high_fidelity_pdf_content(doc):
    """
    Structured, layout-aware extraction of PDF documents.
    Preserves:
    - Text styling (bold, italic, font sizes, colors).
    - Headings (h1, h2, h3, h4) based on statistical font analysis.
    - Bullet and ordered lists with correct grouping.
    - Tables converted to editable semantic HTML tables.
    - Embedded images extracted and preserved in media storage.
    - Alignment (left, center, right, justify).
    - Scanned page OCR fallback.
    """
    if not doc.file:
        raise ValueError("Document has no PDF file attached.")

    pages_html = []
    warnings = []

    try:
        doc.file.open("rb")
        file_bytes = doc.file.read()
        pdf_ctx = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception:
        if hasattr(doc.file, "path") and os.path.exists(doc.file.path):
            pdf_ctx = pymupdf.open(doc.file.path)
        else:
            raise

    with pdf_ctx as pdf:
        total_pages = len(pdf)

        for page_idx, page in enumerate(pdf):
            page_num = page_idx + 1
            page_width = page.rect.width

            # 1. Check for Tables
            table_items, table_bboxes = _extract_page_tables(page)

            # 2. Extract Text Blocks
            page_data = page.get_text("dict", sort=True)
            raw_blocks = page_data.get("blocks", [])

            text_blocks = [
                b for b in raw_blocks
                if b.get("type") == 0 and b.get("lines")
                and not _is_inside_any_bbox(b.get("bbox"), table_bboxes)
            ]

            # 3. Detect Scanned Page (< 25 characters of extractable text)
            total_text_len = sum(
                len(span.get("text", "").strip())
                for b in text_blocks
                for line in b.get("lines", [])
                for span in line.get("spans", [])
            )

            if total_text_len < 25 and len(raw_blocks) > 0:
                ocr_html, ocr_success = _perform_ocr_fallback(page, page_num)
                if ocr_success and ocr_html:
                    warnings.append(f"Page {page_num} was processed using OCR.")
                    pages_html.append(ocr_html)
                    continue
                elif total_text_len == 0:
                    warnings.append(f"Page {page_num} contains scanned images or no extractable text.")

            # 4. Compute Typical (Body) Font Size for Headings Inference
            all_sizes = [
                float(span["size"])
                for b in text_blocks
                for line in b.get("lines", [])
                for span in line.get("spans", [])
                if span.get("text", "").strip() and span.get("size")
            ]
            typical_size = statistics.median(all_sizes) if all_sizes else 11.0

            # 5. Detect Multi-Column Layout vs Single-Column
            mid_x = page_width / 2.0
            left_col = [b for b in text_blocks if b.get("bbox") and b["bbox"][2] <= mid_x + 15]
            right_col = [b for b in text_blocks if b.get("bbox") and b["bbox"][0] >= mid_x - 15]
            is_two_column = (
                len(left_col) >= 2
                and len(right_col) >= 2
                and (len(left_col) + len(right_col)) >= len(text_blocks) * 0.75
            )

            if is_two_column:
                left_col.sort(key=lambda b: b["bbox"][1] if b.get("bbox") else 0)
                right_col.sort(key=lambda b: b["bbox"][1] if b.get("bbox") else 0)
                other_blocks = [
                    b for b in text_blocks
                    if b not in left_col and b not in right_col
                ]
                other_blocks.sort(key=lambda b: b["bbox"][1] if b.get("bbox") else 0)
                ordered_blocks = [("text", b.get("bbox"), b) for b in other_blocks if b["bbox"][1] < 120]
                ordered_blocks.extend([("text", b.get("bbox"), b) for b in left_col])
                ordered_blocks.extend([("text", b.get("bbox"), b) for b in right_col])
                ordered_blocks.extend([("text", b.get("bbox"), b) for b in other_blocks if b["bbox"][1] >= 120])
            else:
                # Interleave text blocks and tables in natural reading order
                unified_items = [("text", b.get("bbox"), b) for b in text_blocks]
                for tbl in table_items:
                    unified_items.append(("table", tbl.get("bbox"), tbl["html"]))
                unified_items.sort(
                    key=lambda item: (
                        round(item[1][1] / 6) * 6 if item[1] else 0,
                        item[1][0] if item[1] else 0,
                    )
                )
                ordered_blocks = unified_items

            page_elements = []
            bullet_items = []
            numbered_items = []

            def flush_lists():
                nonlocal bullet_items, numbered_items
                if bullet_items:
                    page_elements.append("<ul>" + "".join(bullet_items) + "</ul>")
                    bullet_items = []
                if numbered_items:
                    page_elements.append("<ol>" + "".join(numbered_items) + "</ol>")
                    numbered_items = []

            for item_type, bbox, item_data in ordered_blocks:
                if item_type == "table":
                    flush_lists()
                    page_elements.append(item_data)
                    continue

                block = item_data
                lines = block.get("lines", [])
                block_plain = " ".join(
                    "".join(span.get("text", "") for span in line.get("spans", []))
                    for line in lines
                ).strip()

                if not block_plain:
                    continue

                spans = [
                    span
                    for line in lines
                    for span in line.get("spans", [])
                    if span.get("text", "").strip()
                ]

                if not spans:
                    continue

                largest_span_size = max((float(s.get("size", typical_size)) for s in spans), default=typical_size)
                has_bold = any(
                    bool(s.get("flags", 0) & 16) or any(w in (s.get("font") or "").lower() for w in ("bold", "black", "heavy", "semibold"))
                    for s in spans
                )

                # Alignment
                alignment = "left"
                if bbox and page_width:
                    x0, _, x1, _ = bbox
                    block_width = x1 - x0
                    center_offset = abs((x0 + x1) / 2 - page_width / 2)
                    if block_width < page_width * 0.82 and center_offset < page_width * 0.05:
                        alignment = "center"
                    elif (page_width - x1) < page_width * 0.06 and x0 > page_width * 0.18:
                        alignment = "right"

                align_style = f' style="text-align: {alignment};"' if alignment != "left" else ""

                # Render Lines inside block
                rendered_lines = []
                for line in lines:
                    line_spans = line.get("spans", [])
                    rendered_span_parts = [
                        _span_to_tiptap_html(span, typical_size)
                        for span in line_spans
                        if span.get("text")
                    ]
                    line_text = "".join(rendered_span_parts).strip()
                    if line_text:
                        rendered_lines.append(line_text)

                if not rendered_lines:
                    continue

                # Group lines into a clean paragraph or break-joined block
                block_html = " ".join(rendered_lines)

                # Check for bullet list item (•, ●, ▪, ◦, ‣, -, *)
                bullet_match = re.match(r"^\s*[•●▪◦‣\-\*]\s*(.+)", block_plain)
                numbered_match = re.match(r"^\s*(\d+[\.\)]|[a-zA-Z][\.\)])\s*(.+)", block_plain)

                if bullet_match:
                    if numbered_items:
                        page_elements.append("<ol>" + "".join(numbered_items) + "</ol>")
                        numbered_items = []
                    # Strip bullet symbol from rendered HTML
                    cleaned_html = re.sub(
                        r"(<[^>]*>)?\s*[•●▪◦‣\-\*]\s*",
                        r"\1",
                        block_html,
                        count=1,
                    )
                    bullet_items.append(f"<li>{cleaned_html}</li>")
                elif numbered_match:
                    if bullet_items:
                        page_elements.append("<ul>" + "".join(bullet_items) + "</ul>")
                        bullet_items = []
                    cleaned_html = re.sub(
                        r"(<[^>]*>)?\s*(\d+[\.\)]|[a-zA-Z][\.\)])\s*",
                        r"\1",
                        block_html,
                        count=1,
                    )
                    numbered_items.append(f"<li>{cleaned_html}</li>")
                else:
                    flush_lists()

                    # Infer Headings using multi-signal analysis (size, weight, length)
                    is_short = len(block_plain) <= 120 and len(rendered_lines) <= 2
                    if is_short and (largest_span_size >= typical_size * 1.5 or (has_bold and largest_span_size >= typical_size * 1.3)):
                        tag = "h1"
                        page_elements.append(f"<{tag}{align_style}>{block_html}</{tag}>")
                    elif is_short and (largest_span_size >= typical_size * 1.25 or (has_bold and largest_span_size >= typical_size * 1.12)):
                        tag = "h2"
                        page_elements.append(f"<{tag}{align_style}>{block_html}</{tag}>")
                    elif is_short and (largest_span_size >= typical_size * 1.1 or (has_bold and len(block_plain) <= 80)):
                        tag = "h3"
                        page_elements.append(f"<{tag}{align_style}>{block_html}</{tag}>")
                    else:
                        page_elements.append(f"<p{align_style}>{block_html}</p>")

            flush_lists()

            # 6. Extract page images
            image_elements = _extract_page_images(page, doc.id, page_num)
            page_elements.extend(image_elements)

            if page_elements:
                if page_idx > 0:
                    pages_html.append(
                        f'<hr class="dragen-page-break" data-page="{page_num}" style="page-break-after: always; margin: 32px 0; border: none; border-top: 1px dashed #D4CEBF;" />'
                    )
                pages_html.append("\n".join(page_elements))

    final_content = "\n".join(pages_html)
    return final_content, warnings


# ---------------------------------------------------------------------------
# Document ViewSet
# ---------------------------------------------------------------------------

class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Document.objects.filter(
            Q(owner=user) | Q(collaborators__user=user)
        ).distinct().order_by("-updated_at")

        if self.action in ["restore", "delete_forever"]:
            return queryset

        filter_type = self.request.query_params.get("filter")
        if filter_type == "favorites":
            queryset = queryset.filter(is_favorite=True)
        elif filter_type == "trash":
            queryset = queryset.filter(is_trashed=True)
        else:
            # Default to non-trashed
            queryset = queryset.filter(is_trashed=False)

        search_query = self.request.query_params.get("q") or self.request.query_params.get("search")
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) | Q(content__icontains=search_query)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # ---------------- PDF UPLOAD ----------------
    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def upload(self, request):
        uploaded_file = (
            request.FILES.get("file")
            or request.FILES.get("pdf")
            or request.FILES.get("document")
        )
        if not uploaded_file:
            return Response(
                {"error": "No PDF file was provided. Please upload a PDF file using multipart/form-data."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = uploaded_file.name.rsplit(".", 1)[0]
        serializer = DocumentSerializer(
            data={
                "title": title,
                "content": "",
                "file": uploaded_file,
            }
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        document = serializer.save(owner=request.user)
        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)

    # ---------------- PDF EXTRACTION ----------------
    @action(detail=True, methods=["post"], url_path="extract")
    def extract(self, request, pk=None):
        document = self.get_object()

        # Permission check: owner or editor
        if document.owner != request.user:
            is_collaborator = Collaborator.objects.filter(
                document=document, user=request.user, role="editor"
            ).exists()
            if not is_collaborator:
               return Response(
                    {"error": "You do not have permission to extract or edit this document."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if not document.file:
            return Response(
                {"error": "This document does not contain a PDF file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            extracted_html, warnings = extract_high_fidelity_pdf_content(document)

            if not extracted_html or not extracted_html.strip():
                return Response(
                    {"error": "No readable text or layout could be extracted from this PDF."},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            document.content = extracted_html
            document.save(update_fields=["content", "updated_at"])

            return Response(
                {
                    "success": True,
                    "document_id": document.id,
                    "content": extracted_html,
                    "warnings": warnings,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception("PDF extraction failed for document %s: %s", document.id, e)
            return Response(
                {"error": f"Unable to extract text from this PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ---------------- FAVORITE ----------------
    @action(detail=True, methods=["patch"])
    def favorite(self, request, pk=None):
        doc = self.get_object()
        doc.is_favorite = not doc.is_favorite
        doc.save(update_fields=["is_favorite"])
        return Response({"is_favorite": doc.is_favorite})

    # ---------------- TRASH ----------------
    @action(detail=True, methods=["patch"])
    def trash(self, request, pk=None):
        doc = self.get_object()
        doc.is_trashed = True
        doc.save(update_fields=["is_trashed"])
        return Response(DocumentSerializer(doc).data)

    # ---------------- RESTORE ----------------
    @action(detail=True, methods=["patch"])
    def restore(self, request, pk=None):
        doc = self.get_object()
        doc.is_trashed = False
        doc.save(update_fields=["is_trashed"])
        return Response({"status": "restored", "document": DocumentSerializer(doc).data})

    # ---------------- DELETE FOREVER ----------------
    @action(detail=True, methods=["delete"])
    def delete_forever(self, request, pk=None):
        doc = self.get_object()
        if doc.owner != request.user:
            return Response(
                {"error": "Only the document owner can delete this document."},
                status=status.HTTP_403_FORBIDDEN,
            )
        doc.delete()
        return Response({"status": "deleted forever"})

    # ---------------- COLLABORATORS ----------------
    @action(detail=True, methods=["get"])
    def collaborators(self, request, pk=None):
        document = self.get_object()
        data = [
            {
                "id": document.owner.id,
                "username": document.owner.username,
                "role": "owner",
            }
        ]

        collaborators = Collaborator.objects.filter(
            document=document
        ).select_related("user")

        for c in collaborators:
            data.append({
                "id": c.user.id,
                "username": c.user.username,
                "role": c.role,
            })

        return Response(data)

    # ---------------- AI INDEX ----------------
    @action(detail=True, methods=["post"], url_path="ai/index")
    def ai_index(self, request, pk=None):
        document = self.get_object()

        if not document.content or not document.content.strip():
            return Response(
                {
                    "error": "This document has no editable content to index. Extract the PDF or add text first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ai_server_url = getattr(settings, "AI_SERVER_URL", "http://127.0.0.1:5000")
            ai_response = requests.post(
                f"{ai_server_url}/api/docs/dragen/index",
                json={
                    "documentId": document.id,
                    "filename": (
                        document.file.name.split("/")[-1]
                        if document.file
                        else document.title
                    ),
                    "content": document.content,
                },
                timeout=120,
            )

            try:
                ai_data = ai_response.json()
            except ValueError:
                ai_data = {"message": ai_response.text}

            if not ai_response.ok:
                return Response(
                    {
                        "error": ai_data.get("message", "AI indexing failed."),
                        "details": ai_data,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            return Response(
                {
                    "success": True,
                    "document_id": document.id,
                    "ai": ai_data,
                },
                status=status.HTTP_200_OK,
            )

        except requests.RequestException as exc:
            logger.warning("AI indexing connection error: %s", exc)
            return Response(
                {"error": "Unable to connect to the AI server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # ---------------- AI ASK ----------------
    @action(detail=True, methods=["post"], url_path="ai/ask")
    def ai_ask(self, request, pk=None):
        document = self.get_object()
        question = request.data.get("question")

        if not question or not question.strip():
            return Response(
                {"error": "Question is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not document.content or not document.content.strip():
            return Response(
                {
                    "error": "This document has no content available for AI analysis."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ai_server_url = getattr(settings, "AI_SERVER_URL", "http://127.0.0.1:5000")
            ai_response = requests.post(
                f"{ai_server_url}/api/docs/dragen/ask",
                json={
                    "documentId": document.id,
                    "question": question.strip(),
                    "content": document.content,  # Pass latest content for auto-indexing if needed
                },
                timeout=120,
            )

            try:
                ai_data = ai_response.json()
            except ValueError:
                ai_data = {"message": ai_response.text}

            if not ai_response.ok:
                return Response(
                    {
                        "error": ai_data.get("message", "AI request failed."),
                        "details": ai_data,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            return Response(
                {
                    "success": True,
                    "document_id": document.id,
                    "ai": ai_data,
                },
                status=status.HTTP_200_OK,
            )

        except requests.RequestException as exc:
            logger.warning("AI ask connection error: %s", exc)
            return Response(
                {"error": "Unable to connect to the AI server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # ---------------- AI REWRITE / WRITING ASSISTANT ----------------
    @action(detail=True, methods=["post"], url_path="ai/rewrite")
    def ai_rewrite(self, request, pk=None):
        document = self.get_object()
        text = request.data.get("text", "")
        action_type = request.data.get("action", "improve")
        custom_instruction = request.data.get("instruction", "")

        if not text or not text.strip():
            return Response(
                {"error": "Text selection is required for writing assistance."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ai_server_url = getattr(settings, "AI_SERVER_URL", "http://127.0.0.1:5000")
            ai_response = requests.post(
                f"{ai_server_url}/api/docs/dragen/rewrite",
                json={
                    "documentId": document.id,
                    "text": text.strip(),
                    "action": action_type,
                    "instruction": custom_instruction,
                },
                timeout=120,
            )

            try:
                ai_data = ai_response.json()
            except ValueError:
                ai_data = {"message": ai_response.text}

            if not ai_response.ok:
                return Response(
                    {
                        "error": ai_data.get("message", "AI rewrite request failed."),
                        "details": ai_data,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            return Response(
                {
                    "success": True,
                    "originalText": text,
                    "replacement": ai_data.get("replacement", ""),
                    "explanation": ai_data.get("explanation", ""),
                },
                status=status.HTTP_200_OK,
            )

        except requests.RequestException as exc:
            logger.warning("AI rewrite connection error: %s", exc)
            return Response(
                {"error": "Unable to connect to the AI server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # ---------------- AI SUMMARIZE ----------------
    @action(detail=True, methods=["post"], url_path="ai/summarize")
    def ai_summarize(self, request, pk=None):
        document = self.get_object()

        if not document.content or not document.content.strip():
            return Response(
                {"error": "This document has no content to summarize."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ai_server_url = getattr(settings, "AI_SERVER_URL", "http://127.0.0.1:5000")
            ai_response = requests.post(
                f"{ai_server_url}/api/docs/dragen/summarize",
                json={"content": document.content},
                timeout=120,
            )

            try:
                ai_data = ai_response.json()
            except ValueError:
                ai_data = {"summary": ai_response.text}

            if not ai_response.ok:
                return Response(
                    {"error": ai_data.get("message", "Document summarization failed.")},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            return Response(
                {
                    "success": True,
                    "document_id": document.id,
                    "summary": ai_data.get("summary", ""),
                },
                status=status.HTTP_200_OK,
            )

        except requests.RequestException as exc:
            logger.warning("AI summarize fallback: %s", exc)
            # Safe local extractive fallback
            plain_text = re.sub(r"<[^>]+>", " ", document.content).strip()
            sentences = [s.strip() for s in plain_text.split(". ") if len(s.strip()) > 35]
            summary_preview = ". ".join(sentences[:5]) + ("." if sentences else "")
            return Response(
                {
                    "success": True,
                    "document_id": document.id,
                    "summary": summary_preview or "Document content is too brief to generate a detailed summary.",
                    "note": "Extractive summary generated locally.",
                },
                status=status.HTTP_200_OK,
            )


# ---------------------------------------------------------------------------
# Module-Level Views (Shared Documents & Protected PDF Serving)
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def shared_to_me(request):
    docs = Document.objects.filter(
        collaborators__user=request.user,
        is_trashed=False,
    ).distinct().order_by("-updated_at")

    return Response(DocumentSerializer(docs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def shared_by_me(request):
    docs = Document.objects.filter(
        owner=request.user,
        collaborators__isnull=False,
        is_trashed=False,
    ).distinct().order_by("-updated_at")

    return Response(DocumentSerializer(docs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@xframe_options_exempt
def serve_document_pdf(request, document_id):
    """
    Securely serve original PDF for authenticated document owner or collaborator.
    Supports inline viewing in iframe.
    """
    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        raise Http404("Document not found.")

    # Authorization check
    if document.owner != request.user:
        is_collaborator = Collaborator.objects.filter(
            document=document, user=request.user
        ).exists()
        if not is_collaborator:
            return HttpResponseForbidden("You do not have permission to view this document's PDF.")

    if not document.file:
        raise Http404("This document has no PDF file attached.")

    try:
        response = FileResponse(
            document.file.open("rb"),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = f'inline; filename="{document.title or "document"}.pdf"'
        return response
    except Exception as e:
        logger.error("Error opening PDF file: %s", e)
        raise Http404("Unable to read PDF file.")
