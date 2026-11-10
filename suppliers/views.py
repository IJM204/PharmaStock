from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, BasePermission

from .models import Supplier
from .serializers import SupplierSerializer


class SupplierPermission(BasePermission):
    """
    Tous les utilisateurs authentifiés peuvent consulter.
    Seuls les administrateurs et gestionnaires de stock
    peuvent modifier les fournisseurs.
    """

    def has_permission(self, request, view):

        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        return request.user.role in [
            'Admin',
            'STOCK_Manager',
        ]


class SupplierViewSet(viewsets.ModelViewSet):

    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, SupplierPermission]
