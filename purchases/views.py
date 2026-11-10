"""Vues API du module Achats.

La réception ne réimplémente pas la logique métier : chaque réception est
créée puis traitée par PurchaseReceipt.process_receipt(), dans une transaction
englobante pour garantir un traitement tout-ou-rien.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Purchase, PurchaseReceipt
from .permissions import PurchasePermission
from .serializers import (
    PurchaseReadSerializer,
    PurchaseReceiptReadSerializer,
    PurchaseReceiveSerializer,
    PurchaseWriteSerializer,
)


class PurchaseViewSet(viewsets.ReadOnlyModelViewSet):
    """Consultation et création des achats, avec action de réception."""

    queryset = Purchase.objects.select_related(
        'supplier',
        'ordered_by',
    ).prefetch_related(
        'items__medicine',
    ).all()

    permission_classes = [PurchasePermission]

    def get_serializer_class(self):
        if self.action == 'create':
            return PurchaseWriteSerializer

        return PurchaseReadSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        supplier_filter = self.request.query_params.get('supplier')

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if supplier_filter:
            queryset = queryset.filter(supplier_id=supplier_filter)

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = PurchaseWriteSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)

        try:
            purchase = serializer.save()
        except DjangoValidationError as error:
            raise ValidationError({'detail': error.messages})

        output = PurchaseReadSerializer(
            purchase,
            context={'request': request},
        )
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        purchase = self.get_object()
        serializer = PurchaseReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entries = serializer.validated_data['items']

        if purchase.status == 'CANCELLED':
            raise ValidationError({
                'detail': 'Impossible de réceptionner un achat annulé.',
            })

        for entry in entries:
            item = entry['purchase_item']

            if item.purchase_id != purchase.id:
                raise ValidationError({
                    'items': [
                        f"La ligne d’achat {item.id} n’appartient pas "
                        "à cet achat."
                    ],
                })

            remaining = item.quantity_ordered - item.quantity_received

            if entry['quantity'] > remaining:
                raise ValidationError({
                    'items': [
                        f"La quantité reçue ({entry['quantity']}) dépasse "
                        f"le restant à recevoir ({remaining}) pour "
                        f"« {item.medicine.name} »."
                    ],
                })

        receipts = []

        try:
            with transaction.atomic():
                for entry in entries:
                    item = entry['purchase_item']
                    receipt = PurchaseReceipt.objects.create(
                        purchase_item=item,
                        quantity=entry['quantity'],
                        received_by=request.user,
                        batch_number=entry['batch_number'],
                        manufacturing_date=entry.get('manufacturing_date'),
                        expiry_date=entry.get('expiry_date'),
                        notes=entry.get('notes', ''),
                    )
                    receipt.process_receipt()
                    receipt.refresh_from_db()
                    receipts.append(receipt)
        except DjangoValidationError as error:
            raise ValidationError({'detail': error.messages})

        purchase.refresh_from_db()
        output = PurchaseReadSerializer(
            purchase,
            context={'request': request},
        ).data
        output['receipts'] = PurchaseReceiptReadSerializer(
            receipts,
            many=True,
        ).data

        return Response(output, status=status.HTTP_200_OK)


class PurchaseReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """Historique des réceptions d'achat."""

    queryset = PurchaseReceipt.objects.select_related(
        'purchase_item__purchase',
        'purchase_item__medicine',
        'received_by',
    ).all()

    serializer_class = PurchaseReceiptReadSerializer
    permission_classes = [PurchasePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        purchase_filter = self.request.query_params.get('purchase')
        item_filter = self.request.query_params.get('purchase_item')
        status_filter = self.request.query_params.get('status')

        if purchase_filter:
            queryset = queryset.filter(
                purchase_item__purchase_id=purchase_filter
            )

        if item_filter:
            queryset = queryset.filter(purchase_item_id=item_filter)

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset
