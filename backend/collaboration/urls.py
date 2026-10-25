from django.urls import path

from .views import (
    ShareDocumentView,
    CollaboratorListView,
    SharedByMeView,
    SharedDocumentsView,
    UpdateCollaboratorRoleView,
    RemoveCollaboratorView
)

urlpatterns = [
    path("share/", ShareDocumentView.as_view()),
    path("collaborators/", CollaboratorListView.as_view()),
    path(
    "shared-documents/",
    SharedDocumentsView.as_view()
),

path(
    "shared-by-me/",
    SharedByMeView.as_view()
),
    path(
        "collaborators/<int:pk>/",
        UpdateCollaboratorRoleView.as_view(),
    ),
    path(
        "collaborators/<int:pk>/role/",
        UpdateCollaboratorRoleView.as_view(),
    ),

path(
    "collaborators/<int:pk>/remove/",
    RemoveCollaboratorView.as_view()
),
]