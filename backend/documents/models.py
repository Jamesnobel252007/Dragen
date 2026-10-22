from django.db import models
from users.models import User
from .validators import validate_pdf

class Document(models.Model):
    title = models.CharField(max_length=255)

    # Existing text-based documents
    content = models.TextField(blank=True, default="")

    # Uploaded source file, currently PDF only
    file = models.FileField(
        upload_to="documents/",
         validators=[validate_pdf],
        blank=True,
        null=True,
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="documents"
    )

    is_favorite = models.BooleanField(default=False)
    is_trashed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title