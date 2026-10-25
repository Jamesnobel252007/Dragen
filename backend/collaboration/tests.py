from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from documents.models import Document
from collaboration.models import Collaborator

User = get_user_model()


class CollaboratorPermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="doc_owner", email="owner@example.com", password="password123"
        )
        self.collaborator_user = User.objects.create_user(
            username="collab_user", email="collab@example.com", password="password123"
        )
        self.other_user = User.objects.create_user(
            username="other_user", email="other@example.com", password="password123"
        )

        self.doc = Document.objects.create(
            owner=self.owner,
            title="Collab Test Document",
            content="<p>Test content</p>",
        )

        self.collab_record = Collaborator.objects.create(
            document=self.doc,
            user=self.collaborator_user,
            role="viewer",
        )

    # ---------------- REMOVE COLLABORATOR TESTS ----------------

    def test_owner_can_remove_collaborator(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(
            f"/api/documents/{self.doc.id}/remove-collaborator/{self.collaborator_user.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(
            Collaborator.objects.filter(
                document=self.doc, user=self.collaborator_user
            ).exists()
        )

    def test_non_owner_cannot_remove_collaborator(self):
        # A collaborator who is an editor on the document cannot remove another collaborator
        collab_editor = User.objects.create_user(
            username="collab_editor", email="editor@example.com", password="password123"
        )
        Collaborator.objects.create(
            document=self.doc,
            user=collab_editor,
            role="editor",
        )
        self.client.force_authenticate(user=collab_editor)
        res = self.client.delete(
            f"/api/documents/{self.doc.id}/remove-collaborator/{self.collaborator_user.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            Collaborator.objects.filter(
                document=self.doc, user=self.collaborator_user
            ).exists()
        )

        # A stranger who has no access to the document is also rejected
        self.client.force_authenticate(user=self.other_user)
        res = self.client.delete(
            f"/api/documents/{self.doc.id}/remove-collaborator/{self.collaborator_user.id}/"
        )
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_cannot_remove_owner(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(
            f"/api/documents/{self.doc.id}/remove-collaborator/{self.owner.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get("error"), "Owner cannot be removed.")

    def test_remove_nonexistent_collaborator_returns_404(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(
            f"/api/documents/{self.doc.id}/remove-collaborator/99999/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------- UPDATE ROLE TESTS ----------------

    def test_owner_can_update_role_with_user_id_and_document_id(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f"/api/collaborators/{self.collaborator_user.id}/",
            {"role": "editor", "document_id": self.doc.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.collab_record.refresh_from_db()
        self.assertEqual(self.collab_record.role, "editor")

    def test_owner_can_update_role_with_collaborator_pk(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f"/api/collaborators/{self.collab_record.id}/",
            {"role": "editor"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.collab_record.refresh_from_db()
        self.assertEqual(self.collab_record.role, "editor")

    def test_owner_can_update_role_without_document_id_when_owned(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f"/api/collaborators/{self.collaborator_user.id}/",
            {"role": "editor"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.collab_record.refresh_from_db()
        self.assertEqual(self.collab_record.role, "editor")

    def test_non_owner_cannot_update_role(self):
        self.client.force_authenticate(user=self.other_user)
        res = self.client.patch(
            f"/api/collaborators/{self.collaborator_user.id}/",
            {"role": "editor", "document_id": self.doc.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.collab_record.refresh_from_db()
        self.assertEqual(self.collab_record.role, "viewer")

    def test_cannot_update_to_invalid_role(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f"/api/collaborators/{self.collaborator_user.id}/",
            {"role": "admin", "document_id": self.doc.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.collab_record.refresh_from_db()
        self.assertEqual(self.collab_record.role, "viewer")

    def test_update_nonexistent_collaborator_returns_404(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            "/api/collaborators/99999/",
            {"role": "editor", "document_id": self.doc.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------- COLLABORATORS DELETE VIA /api/collaborators/<pk>/ ----------------

    def test_owner_can_delete_via_collaborator_endpoint(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.delete(
            f"/api/collaborators/{self.collaborator_user.id}/",
            {"document_id": self.doc.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(
            Collaborator.objects.filter(
                document=self.doc, user=self.collaborator_user
            ).exists()
        )
