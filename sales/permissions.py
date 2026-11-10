from rest_framework.permissions import BasePermission, SAFE_METHODS


class SalesPermission(BasePermission):
    """Gère les accès selon le rôle de l'utilisateur."""

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == 'Admin':
            return True

        if request.method in SAFE_METHODS:
            return user.role in [
                'Cashier',
                'PHARMASIST',
                'STOCK_Manager',
            ]

        return user.role in [
            'Cashier',
            'PHARMASIST',
        ]
