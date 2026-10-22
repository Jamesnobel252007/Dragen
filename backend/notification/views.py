from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        notifications = Notification.objects.filter(
            recipient=request.user
        ).order_by("-created_at")

        serializer = NotificationSerializer(
            notifications,
            many=True
        )

        return Response(serializer.data)


class UnreadNotificationCountView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()

        return Response({
            "count": count
        })


class MarkNotificationReadView(APIView):

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):

        try:
            notification = Notification.objects.get(
                id=pk,
                recipient=request.user
            )

        except Notification.DoesNotExist:

            return Response(
                {"error": "Notification not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        notification.is_read = True
        notification.save()

        return Response({
            "message": "Notification marked as read"
        })


class MarkAllNotificationsReadView(APIView):

    permission_classes = [IsAuthenticated]

    def patch(self, request):

        Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)

        return Response({
            "message": "All notifications marked as read"
        })