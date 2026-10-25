from pydoc import doc
from urllib import request

from django.shortcuts import render

# Create your views here.

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets
from users.models import User
from documents.models import Document
from .models import Collaborator
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from .serializers import CollaboratorSerializer
from notification.models import Notification
from documents.serializers import DocumentSerializer
from rest_framework.permissions import IsAuthenticated



class ShareDocumentView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        try:
            doc = Document.objects.get(
                id=request.data["document_id"]
            )
        except Document.DoesNotExist:
            return Response(
                {"error": "Document not found"},
                status=404
            )

        if doc.owner != request.user:
            return Response(
                {"error": "Not owner"},
                status=403
            )

        try:
            user = User.objects.get(
                email=request.data["email"]
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=404
            )

        if user == request.user:
            return Response(
                {"error": "Owner already has access"},
                status=400
            )

        role = request.data.get("role")

        VALID_ROLES = ["viewer", "editor"]

        if role not in VALID_ROLES:
            return Response(
                {"error": "Invalid role"},
                status=400
            )

        if Collaborator.objects.filter(
            user=user,
            document=doc
        ).exists():
            return Response(
                {"error": "User already has access"},
                status=400
            )

        Collaborator.objects.create(
            user=user,
            document=doc,
            role=role
        )
        Notification.objects.create(
    recipient=user,
    sender=request.user,
    notification_type="document_shared",
    message=f"{request.user.username} shared '{doc.title}' with you",
    document=doc
)
        return Response({
            "message": "Document shared successfully"
        })
    

class CollaboratorListView(ListAPIView):

    serializer_class = CollaboratorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Collaborator.objects.filter(
            document__owner=self.request.user
    )
    


class SharedDocumentsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        collaborations = Collaborator.objects.filter(
            user=request.user
        )

        documents = []

        for collaboration in collaborations:
            documents.append(
                collaboration.document
            )

        serializer = DocumentSerializer(
            documents,
            many=True
        )

        return Response(serializer.data)
    
class SharedByMeView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        documents = Document.objects.filter(
            collaborators__isnull=False,
            owner=request.user
        ).distinct()

        serializer = DocumentSerializer(documents, many=True)

        return Response(serializer.data)

def _find_collaborator(request, pk):
    """
    Look up a Collaborator by:
    1. document_id (from payload/query) + user_id or collaborator_id
    2. direct Collaborator PK (id=pk)
    3. user_id where the requesting user is the document owner
    """
    document_id = request.data.get("document_id") or request.query_params.get("document_id")

    collaborator = None
    if document_id:
        collaborator = Collaborator.objects.filter(
            document_id=document_id,
            user_id=pk,
        ).select_related("document", "user").first()
        if not collaborator:
            collaborator = Collaborator.objects.filter(
                document_id=document_id,
                id=pk,
            ).select_related("document", "user").first()

    if not collaborator:
        collaborator = Collaborator.objects.filter(id=pk).select_related("document", "user").first()

    if not collaborator:
        owned_collabs = Collaborator.objects.filter(
            user_id=pk,
            document__owner=request.user,
        ).select_related("document", "user")
        if owned_collabs.exists():
            collaborator = owned_collabs.first()

    return collaborator


class UpdateCollaboratorRoleView(APIView):

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        collaborator = _find_collaborator(request, pk)
        if not collaborator:
            return Response(
                {"error": "Collaborator not found"},
                status=404,
            )

        if collaborator.document.owner != request.user:
            return Response(
                {"error": "Only document owner can update collaborator roles"},
                status=403,
            )

        if collaborator.user == collaborator.document.owner:
            return Response(
                {"error": "Owner role cannot be changed"},
                status=400,
            )

        new_role = request.data.get("role")

        if new_role not in ["viewer", "editor"]:
            return Response(
                {"error": "Invalid role. Role must be 'viewer' or 'editor'"},
                status=400,
            )

        old_role = collaborator.role

        collaborator.role = new_role
        collaborator.save()

        return Response({
            "message": "Role updated successfully",
            "user": collaborator.user.email,
            "document": collaborator.document.title,
            "previous_role": old_role,
            "new_role": collaborator.role,
        })

    def delete(self, request, pk):
        return RemoveCollaboratorView().delete(request, pk)


class RemoveCollaboratorView(APIView):

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        collaborator = _find_collaborator(request, pk)
        if not collaborator:
            return Response(
                {"error": "Collaborator not found"},
                status=404,
            )

        if collaborator.document.owner != request.user:
            return Response(
                {"error": "Only document owner can remove collaborators"},
                status=403,
            )

        if collaborator.user == collaborator.document.owner:
            return Response(
                {"error": "Owner cannot be removed"},
                status=400,
            )

        user_email = collaborator.user.email
        document_title = collaborator.document.title
        role = collaborator.role

        collaborator.delete()

        return Response({
            "message": "Access removed successfully",
            "user": user_email,
            "document": document_title,
            "role_removed": role,
        })
       
from collaboration.models import Collaborator

class SharedViewSet(viewsets.ViewSet):

    def list_shared_to_me(self, request):
        docs = Document.objects.filter(
            collaborators__user=request.user
        )
        return Response(DocumentSerializer(docs, many=True).data)

    def list_shared_by_me(self, request):
        docs = Document.objects.filter(owner=request.user)
        return Response(DocumentSerializer(docs, many=True).data)        
    