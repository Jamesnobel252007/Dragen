from rest_framework import serializers
from .models import Document
from .validators import validate_pdf


class DocumentSerializer(serializers.ModelSerializer):

    owner = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = [
            "owner",
            "created_at",
            "updated_at",
        ]

    def validate_file(self, value):
        validate_pdf(value)
        return value