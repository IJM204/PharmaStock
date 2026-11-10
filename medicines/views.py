from rest_framework import viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated

from .models import Category, Medicine
from .serializers import CategorySerializer, MedicineSerializer


class MedicinePermission(BasePermission):
    """
    Seuls l'administrateur et le gestionnaire de stock
    peuvent modifier les médicaments et les catégories.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == 'Admin':
            return True

        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        return user.role == 'STOCK_Manager'


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, MedicinePermission]


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.select_related('category').all()
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated, MedicinePermission]