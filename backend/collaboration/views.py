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

class UpdateCollaboratorRoleView(APIView):

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):

        try:
            collaborator = Collaborator.objects.get(id=pk)
        except Collaborator.DoesNotExist:
            return Response(
                {"error": "Collaborator not found"},
                status=404
            )

        if collaborator.document.owner != request.user:
            return Response(
                {"error": "Not owner"},
                status=403
            )

        new_role = request.data.get("role")

        if new_role not in ["viewer", "editor"]:
            return Response(
        {"error": "Invalid role"},
        status=400
    )

        old_role = collaborator.role

        collaborator.role = new_role
        collaborator.save()

        return Response({
    "message": "Role updated successfully",
    "user": collaborator.user.email,
    "document": collaborator.document.title,
    "previous_role": old_role,
    "new_role": collaborator.role
})
    
class RemoveCollaboratorView(APIView):

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):

        try:
            collaborator = Collaborator.objects.get(id=pk)
        except Collaborator.DoesNotExist:
            return Response(
                {"error": "Collaborator not found"},
                status=404
            )

        if collaborator.document.owner != request.user:
            return Response(
                {"error": "Not owner"},
                status=403
            )

        user_email = collaborator.user.email
        document_title = collaborator.document.title
        role = collaborator.role

        collaborator.delete()

        return Response({
    "message": "Access removed successfully",
    "user": user_email,
    "document": document_title,
    "role_removed": role
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
    