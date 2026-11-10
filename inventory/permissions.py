
from rest_framework.permissions import BasePermission, SAFE_METHODS


class InventoryPermission(BasePermission):
    """Règles d'accès selon le rôle utilisateur."""

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == 'Admin':
            return True

        if request.method in SAFE_METHODS:
            return user.role in ['STOCK_Manager', 'PHARMASIST', 'Cashier']

        return user.role in ['STOCK_Manager', 'PHARMASIST']
