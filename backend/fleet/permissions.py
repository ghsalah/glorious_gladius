from rest_framework.permissions import BasePermission

from .models import User


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", None) == User.Role.ADMIN)
