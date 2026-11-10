from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Sale
from .serializers import SaleSerializer
from .permissions import SalesPermission
from .services import create_sale


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consultation de l'historique et création des ventes.
    """

    queryset = Sale.objects.select_related(
        'sold_by'
    ).prefetch_related(
        'items__batch__medicine'
    )

    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, SalesPermission]

    def get_queryset(self):
        queryset = super().get_queryset()

        user = self.request.user
        is_admin = (
            user.is_superuser
            or getattr(user, 'role', None) == 'Admin'
        )

        # Un caissier ne consulte que les ventes qu'il a lui-même réalisées.
        if (
            user.is_authenticated
            and not is_admin
            and getattr(user, 'role', None) == 'Cashier'
        ):
            queryset = queryset.filter(sold_by=user)

        status_filter = self.request.query_params.get('status')

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    @action(detail=False, methods=['post'], url_path='create')
    def create_sale_action(self, request):
        """
        Exemple de données :
        {
            "items": [
                {"medicine_id": 1, "quantity": 3}
            ]
        }
        """

        items = request.data.get('items')

        if not isinstance(items, list):
            return Response(
                {'error': 'Le champ items doit être une liste.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sale = create_sale(
            sold_by=request.user,
            items=items
        )

        serializer = self.get_serializer(sale)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )