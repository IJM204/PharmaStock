
from django.db import transaction
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Batch, StockMovement
from .serializers import BatchSerializer, StockMovementSerializer
from .permissions import InventoryPermission


class BatchViewSet(viewsets.ModelViewSet):

    queryset = Batch.objects.select_related('medicine').all()

    serializer_class = BatchSerializer

    permission_classes = [InventoryPermission]

    def get_queryset(self):

        queryset = super().get_queryset()

        medicine_id = self.request.query_params.get('medicine')

        if medicine_id:
            queryset = queryset.filter(medicine_id=medicine_id)

        return queryset.order_by('expiry_date')

    @action(detail=False, methods=['get'])
    def low_stock(self, request):

        batches = self.get_queryset().filter(
            quantity_available__lte=10
        )

        serializer = self.get_serializer(batches, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expired(self, request):

        batches = self.get_queryset().filter(
            expiry_date__lt=timezone.localdate(),
            quantity_available__gt=0
        )

        serializer = self.get_serializer(batches, many=True)

        return Response(serializer.data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):

    queryset = StockMovement.objects.select_related(
        'batch__medicine',
        'performed_by'
    ).all()

    serializer_class = StockMovementSerializer

    permission_classes = [InventoryPermission]

    def get_queryset(self):

        queryset = super().get_queryset()

        batch_id = self.request.query_params.get('batch')

        movement_type = self.request.query_params.get('type')

        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)

        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)

        return queryset.order_by('-created_at')

    @action(detail=False, methods=['post'])
    def register(self, request):

        batch_id = request.data.get('batch')
        movement_type = request.data.get('movement_type')
        quantity = request.data.get('quantity')
        reason = request.data.get('reason', '')
        adjustment_direction = request.data.get(
            'adjustment_direction'
        )

        if movement_type not in ['IN', 'OUT', 'ADJUSTMENT']:
            return Response(
                {'error': 'Type de mouvement invalide.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            quantity = int(quantity)

            if quantity <= 0:
                raise ValueError

        except (TypeError, ValueError):
            return Response(
                {'error': 'La quantité doit être un entier positif.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if movement_type == 'ADJUSTMENT':

            if adjustment_direction not in ['INCREASE', 'DECREASE']:
                return Response(
                    {'error': 'Précisez INCREASE ou DECREASE.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not str(reason).strip():
                return Response(
                    {'error': 'Le motif de l’ajustement est obligatoire.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif adjustment_direction:
            return Response(
                {'error': 'La direction est réservée aux ajustements.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():

            try:
                batch = Batch.objects.select_for_update().get(
                    pk=batch_id
                )

            except (Batch.DoesNotExist, ValueError, TypeError):
                return Response(
                    {'error': 'Lot introuvable.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            today = timezone.localdate()

            if movement_type in ['IN', 'OUT'] and batch.expiry_date < today:
                return Response(
                    {'error': 'Opération interdite sur un lot expiré.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if movement_type == 'IN':

                batch.quantity_available += quantity
                batch.quantity_received += quantity

            elif movement_type == 'OUT':

                if quantity > batch.quantity_available:
                    return Response(
                        {'error': 'Stock disponible insuffisant.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                batch.quantity_available -= quantity

            elif movement_type == 'ADJUSTMENT':

                if adjustment_direction == 'INCREASE':

                    batch.quantity_available += quantity

                elif adjustment_direction == 'DECREASE':

                    if quantity > batch.quantity_available:
                        return Response(
                            {'error': 'Quantité supérieure au stock disponible.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    batch.quantity_available -= quantity

            batch.save(
                update_fields=[
                    'quantity_available',
                    'quantity_received',
                    'updated_at'
                ]
            )

            movement = StockMovement.objects.create(
                batch=batch,
                movement_type=movement_type,
                adjustment_direction=(
                    adjustment_direction
                    if movement_type == 'ADJUSTMENT'
                    else None
                ),
                quantity=quantity,
                reason=reason,
                performed_by=request.user
            )

        serializer = StockMovementSerializer(movement)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )
