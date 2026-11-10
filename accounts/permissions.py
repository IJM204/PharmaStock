from rest_framework.permissions import BasePermission


class IsPharmaAdmin(BasePermission):
    """
    Autorise uniquement les administrateurs PharmaStock.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.role == 'Admin'
            )
        )