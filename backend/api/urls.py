from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView, dashboard_stats, upload_chat_attachment,
    UserViewSet, ClientViewSet, ProjectViewSet,
    TaskViewSet, InvoiceViewSet, PaymentViewSet, SupportRequestViewSet,
    ChatGroupViewSet, ChatMessageViewSet, CallSessionViewSet,
    NotificationViewSet, AttendanceViewSet, LeaveRequestViewSet
)

router = DefaultRouter()
router.register('users', UserViewSet, basename='user')
router.register('clients', ClientViewSet, basename='client')
router.register('projects', ProjectViewSet, basename='project')
router.register('tasks', TaskViewSet, basename='task')
router.register('invoices', InvoiceViewSet, basename='invoice')
router.register('payments', PaymentViewSet, basename='payment')
router.register('support-requests', SupportRequestViewSet, basename='support-request')
router.register('chat-groups', ChatGroupViewSet, basename='chat-group')
router.register('chat-messages', ChatMessageViewSet, basename='chat-message')
router.register('call-sessions', CallSessionViewSet, basename='call-session')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('attendance', AttendanceViewSet, basename='attendance')
router.register('leave-requests', LeaveRequestViewSet, basename='leave-request')

urlpatterns = [
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('dashboard-stats/', dashboard_stats, name='dashboard_stats'),
    path('upload-chat-attachment/', upload_chat_attachment, name='upload_chat_attachment'),
    path('', include(router.urls)),
]
