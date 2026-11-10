"""Permissions de l'API Achats."""

from rest_framework.permissions import BasePermission


class PurchasePermission(BasePermission):
    """Les achats sont réservés aux administrateurs et gestionnaires de stock."""

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        return (
            user.is_superuser
            or getattr(user, 'role', None) in ['Admin', 'STOCK_Manager']
        )
