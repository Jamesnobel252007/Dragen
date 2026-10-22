from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):

    sender_username = serializers.CharField(
        source="sender.username",
        read_only=True
    )

    document_title = serializers.CharField(
        source="document.title",
        read_only=True
    )

    class Meta:
        model = Notification

        fields = [
            "id",
            "notification_type",
            "message",
            "sender_username",
            "document",
            "document_title",
            "is_read",
            "created_at",
        ]