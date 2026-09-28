from django.utils import timezone
from .models import User

class UpdateLastSeenMiddleware:
    """
    Middleware that updates request.user.last_seen on any authenticated API call.
    Throttled to update at most once every 25 seconds per user to keep database load minimal.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            now = timezone.now()
            last = getattr(user, 'last_seen', None)
            if not last or (now - last).total_seconds() > 25:
                User.objects.filter(id=user.id).update(last_seen=now)
                user.last_seen = now
        return response
