from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from documents.views import serve_document_pdf
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from documents.views import (
    shared_to_me,
    shared_by_me,
)


def health_check(request):
    """Lightweight unauthenticated health probe for Render deployments."""
    return JsonResponse({"status": "healthy", "service": "dragen-backend"})


urlpatterns = [
    path("healthz", health_check, name="health_check"),
    path("healthz/", health_check, name="health_check_slash"),
    path("admin/", admin.site.urls),

    path("api/", include("users.urls")),

    path(
        "api/token/",
        TokenObtainPairView.as_view()
    ),

    path(
        "api/token/refresh/",
        TokenRefreshView.as_view()
    ),

    path(
        "api/comments/",
        include("comments.urls")
    ),

    path(
        "api/",
        include("collaboration.urls")
    ),

    path(
        "api/",
        include("documents.urls")
    ),

    path(
        "api/notifications/",
        include("notification.urls")
    ),

    path(
        "shared-documents/",
        shared_to_me
    ),

    path(
        "shared-by-me/",
        shared_by_me
    ),
    path(
        "api/documents/<int:document_id>/pdf/",
        serve_document_pdf,
        name="serve-document-pdf",
    ),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )