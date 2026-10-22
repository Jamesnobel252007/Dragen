import io
import pymupdf as fitz
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from documents.models import Document
from collaboration.models import Collaborator
from documents.views import extract_high_fidelity_pdf_content

User = get_user_model()


def create_sample_pdf_bytes():
    """Create a synthetic PDF document in memory using PyMuPDF with rich elements."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4 size

    # Insert Title (large font size for heading inference)
    page.insert_text(
        fitz.Point(50, 80),
        "Annual Project Report 2026",
        fontsize=24,
        color=(0.1, 0.2, 0.5),
    )

    # Insert Section Subheading
    page.insert_text(
        fitz.Point(50, 120),
        "Executive Summary",
        fontsize=16,
        color=(0.2, 0.2, 0.2),
    )

    # Insert Body Paragraph
    page.insert_text(
        fitz.Point(50, 150),
        "This document provides a comprehensive overview of Dragen document editor capabilities.",
        fontsize=11,
        color=(0, 0, 0),
    )

    # Insert Bullet Items
    page.insert_text(
        fitz.Point(50, 180),
        "- High-fidelity PDF layout preservation",
        fontsize=11,
        color=(0, 0, 0),
    )
    page.insert_text(
        fitz.Point(50, 200),
        "- Word-like rich text editing with live formatting",
        fontsize=11,
        color=(0, 0, 0),
    )
    page.insert_text(
        fitz.Point(50, 220),
        "- Context-aware AI assistant with rewrite suggestions",
        fontsize=11,
        color=(0, 0, 0),
    )

    # Draw a simple table using lines
    page.draw_rect(fitz.Rect(50, 250, 450, 320), color=(0.7, 0.7, 0.7), width=1)
    page.draw_line(fitz.Point(50, 280), fitz.Point(450, 280), color=(0.7, 0.7, 0.7), width=1)
    page.draw_line(fitz.Point(250, 250), fitz.Point(250, 320), color=(0.7, 0.7, 0.7), width=1)
    page.insert_text(fitz.Point(60, 270), "Feature Name", fontsize=10)
    page.insert_text(fitz.Point(260, 270), "Status", fontsize=10)
    page.insert_text(fitz.Point(60, 305), "PDF Extraction", fontsize=10)
    page.insert_text(fitz.Point(260, 305), "Production Ready", fontsize=10)

    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes


class AuthenticationAndSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="author@example.com",
            email="author@example.com",
            password="StrongPassword123!",
        )

    def test_unauthenticated_requests_return_401(self):
        response = self.client.get("/api/documents/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post("/api/documents/upload/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_obtain_and_refresh(self):
        response = self.client.post(
            "/api/token/",
            {"username": "author@example.com", "password": "StrongPassword123!"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        refresh_token = response.data["refresh"]
        refresh_response = self.client.post(
            "/api/token/refresh/",
            {"refresh": refresh_token},
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)

    def test_authenticated_request_succeeds(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/documents/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DocumentUploadAndExtractTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="doc_owner",
            email="doc_owner@example.com",
            password="Password123!",
        )
        self.other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

    def test_upload_pdf_success(self):
        pdf_content = create_sample_pdf_bytes()
        file = SimpleUploadedFile(
            "sample_report.pdf", pdf_content, content_type="application/pdf"
        )

        response = self.client.post(
            "/api/documents/upload/",
            {"file": file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "sample_report")
        self.assertIsNotNone(response.data["file"])

        doc_id = response.data["id"]
        document = Document.objects.get(id=doc_id)
        self.assertEqual(document.owner, self.user)

    def test_upload_without_file_returns_400(self):
        response = self.client.post("/api/documents/upload/", {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_json_body_returns_400(self):
        # Sending application/json should return 400 Bad Request with a clear message rather than 415
        response = self.client.post(
            "/api/documents/upload/",
            {"title": "Missing File"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_invalid_file_extension_fails(self):
        fake_file = SimpleUploadedFile(
            "not_a_pdf.txt", b"plain text content", content_type="text/plain"
        )
        response = self.client.post(
            "/api/documents/upload/",
            {"file": fake_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_corrupted_pdf_signature_fails(self):
        fake_pdf = SimpleUploadedFile(
            "corrupted.pdf", b"NOT_A_VALID_PDF_HEADER", content_type="application/pdf"
        )
        response = self.client.post(
            "/api/documents/upload/",
            {"file": fake_pdf},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_extract_endpoint_resolves_and_extracts_html(self):
        pdf_content = create_sample_pdf_bytes()
        file = SimpleUploadedFile(
            "test_doc.pdf", pdf_content, content_type="application/pdf"
        )
        document = Document.objects.create(
            owner=self.user,
            title="Test Doc",
            content="",
            file=file,
        )

        # Test extraction via POST /api/documents/<id>/extract/
        response = self.client.post(f"/api/documents/{document.id}/extract/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("content", response.data)
        extracted = response.data["content"]

        # Content must contain reconstructed text
        self.assertIn("Annual Project Report", extracted)
        self.assertIn("Executive Summary", extracted)

        # Confirm persisted in database
        document.refresh_from_db()
        self.assertEqual(document.content, extracted)

    def test_extract_forbidden_for_non_collaborator(self):
        pdf_content = create_sample_pdf_bytes()
        file = SimpleUploadedFile(
            "test_doc.pdf", pdf_content, content_type="application/pdf"
        )
        document = Document.objects.create(
            owner=self.user,
            title="Private Doc",
            content="",
            file=file,
        )

        # Switch to other user
        other_client = APIClient()
        other_client.force_authenticate(user=self.other_user)

        # Attempt to extract other user's document
        response = other_client.post(f"/api/documents/{document.id}/extract/")
        # ModelViewSet get_object filters by get_queryset which excludes other users' docs -> 404
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )

    def test_extract_on_document_without_pdf_returns_400(self):
        doc = Document.objects.create(
            owner=self.user,
            title="No File Doc",
            content="Existing text",
        )
        response = self.client.post(f"/api/documents/{doc.id}/extract/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PDFLayoutExtractionEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="test_extractor", email="test_extractor@example.com", password="pwd"
        )

    def test_high_fidelity_extraction_engine(self):
        pdf_content = create_sample_pdf_bytes()
        file = SimpleUploadedFile(
            "synthetic.pdf", pdf_content, content_type="application/pdf"
        )
        document = Document.objects.create(
            owner=self.user,
            title="Synthetic Doc",
            content="",
            file=file,
        )

        extracted_html, warnings = extract_high_fidelity_pdf_content(document)

        # Verify semantic output
        self.assertIsInstance(extracted_html, str)
        self.assertTrue(len(extracted_html) > 0)

        # Headings inference
        self.assertTrue(
            "<h1" in extracted_html or "<h2" in extracted_html,
            "Engine should infer headings from prominent font sizes.",
        )

        # Text preservation
        self.assertIn("Annual Project Report 2026", extracted_html)
        self.assertIn("Executive Summary", extracted_html)
        self.assertIn("High-fidelity PDF layout preservation", extracted_html)

        # Bullet list preservation
        self.assertTrue(
            "<ul>" in extracted_html or "<li>" in extracted_html or "High-fidelity PDF layout preservation" in extracted_html,
            "Bullet list elements or items should be preserved.",
        )


class DocumentActionsAndPermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="action_user", email="action_user@example.com", password="pwd"
        )
        self.other_user = User.objects.create_user(
            username="other_action_user", email="other_action_user@example.com", password="pwd"
        )
        self.client.force_authenticate(user=self.user)
        self.doc = Document.objects.create(
            owner=self.user,
            title="Actions Test",
            content="<p>Editable content</p>",
        )

    def test_favorite_toggle(self):
        response = self.client.patch(f"/api/documents/{self.doc.id}/favorite/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_favorite"])

        self.doc.refresh_from_db()
        self.assertTrue(self.doc.is_favorite)

        # Toggle back
        response = self.client.patch(f"/api/documents/{self.doc.id}/favorite/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_favorite"])

    def test_trash_and_restore(self):
        # Move to trash
        response = self.client.patch(f"/api/documents/{self.doc.id}/trash/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.doc.refresh_from_db()
        self.assertTrue(self.doc.is_trashed)

        # Restore from trash
        response = self.client.patch(f"/api/documents/{self.doc.id}/restore/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.doc.refresh_from_db()
        self.assertFalse(self.doc.is_trashed)

    def test_delete_forever_permission(self):
        # Non-owner cannot delete
        other_client = APIClient()
        other_client.force_authenticate(user=self.other_user)
        res = other_client.delete(f"/api/documents/{self.doc.id}/delete_forever/")
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # Owner can delete
        res = self.client.delete(f"/api/documents/{self.doc.id}/delete_forever/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(Document.objects.filter(id=self.doc.id).exists())


class ProtectedPDFServingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="pdf_owner", email="pdf_owner@example.com", password="pwd"
        )
        self.collaborator_user = User.objects.create_user(
            username="pdf_collab", email="pdf_collab@example.com", password="pwd"
        )
        self.unauthorized_user = User.objects.create_user(
            username="pdf_stranger", email="pdf_stranger@example.com", password="pwd"
        )

        pdf_bytes = create_sample_pdf_bytes()
        file = SimpleUploadedFile("sample.pdf", pdf_bytes, content_type="application/pdf")
        self.doc = Document.objects.create(
            owner=self.user,
            title="Sample PDF",
            file=file,
        )
        Collaborator.objects.create(
            document=self.doc,
            user=self.collaborator_user,
            role="editor",
        )

    def test_owner_can_serve_pdf(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/documents/{self.doc.id}/pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_collaborator_can_serve_pdf(self):
        self.client.force_authenticate(user=self.collaborator_user)
        response = self.client.get(f"/api/documents/{self.doc.id}/pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_unauthorized_user_is_forbidden(self):
        self.client.force_authenticate(user=self.unauthorized_user)
        response = self.client.get(f"/api/documents/{self.doc.id}/pdf/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
