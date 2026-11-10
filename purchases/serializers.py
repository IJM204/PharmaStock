"""Serializers de l'API Achats.

La logique métier de réception reste dans PurchaseReceipt.process_receipt().
Ces serializers préparent et valident uniquement les données d'entrée.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from medicines.models import Medicine
from suppliers.models import Supplier

from .models import Purchase, PurchaseItem, PurchaseReceipt


class PurchaseItemReadSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.name',
        read_only=True,
    )
    quantity_remaining = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseItem
        fields = [
            'id',
            'medicine',
            'medicine_name',
            'quantity_ordered',
            'quantity_received',
            'quantity_remaining',
            'unit_price',
            'subtotal',
            'manufacturing_date',
            'expiry_date',
            'notes',
            'created_at',
        ]

    def get_quantity_remaining(self, obj):
        return max(0, obj.quantity_ordered - obj.quantity_received)

    def get_subtotal(self, obj):
        return obj.subtotal()


class PurchaseReceiptReadSerializer(serializers.ModelSerializer):
    purchase_item = serializers.IntegerField(
        source='purchase_item_id',
        read_only=True,
    )
    purchase_id = serializers.IntegerField(
        source='purchase_item.purchase_id',
        read_only=True,
    )
    medicine = serializers.IntegerField(
        source='purchase_item.medicine_id',
        read_only=True,
    )
    medicine_name = serializers.CharField(
        source='purchase_item.medicine.name',
        read_only=True,
    )
    received_by_username = serializers.CharField(
        source='received_by.username',
        read_only=True,
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True,
    )

    class Meta:
        model = PurchaseReceipt
        fields = [
            'id',
            'purchase_item',
            'purchase_id',
            'medicine',
            'medicine_name',
            'quantity',
            'received_by',
            'received_by_username',
            'receipt_date',
            'batch_number',
            'manufacturing_date',
            'expiry_date',
            'status',
            'status_display',
            'notes',
        ]


class PurchaseReadSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source='supplier.name',
        read_only=True,
    )
    ordered_by_username = serializers.CharField(
        source='ordered_by.username',
        read_only=True,
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True,
    )
    items = PurchaseItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Purchase
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'ordered_by',
            'ordered_by_username',
            'order_date',
            'expected_date',
            'status',
            'status_display',
            'total_amount',
            'notes',
            'items',
            'created_at',
            'updated_at',
        ]


class PurchaseItemWriteSerializer(serializers.Serializer):
    medicine = serializers.PrimaryKeyRelatedField(
        queryset=Medicine.objects.all(),
    )
    quantity_ordered = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
    )
    manufacturing_date = serializers.DateField(
        required=False,
        allow_null=True,
    )
    expiry_date = serializers.DateField(
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
    )

    def validate(self, attrs):
        medicine = attrs['medicine']
        manufacturing_date = attrs.get('manufacturing_date')
        expiry_date = attrs.get('expiry_date')

        if not medicine.is_active:
            raise serializers.ValidationError({
                'medicine': 'Ce médicament est inactif.',
            })

        if (
            manufacturing_date
            and expiry_date
            and manufacturing_date > expiry_date
        ):
            raise serializers.ValidationError({
                'expiry_date': (
                    'La date d’expiration doit être postérieure '
                    'à la date de fabrication.'
                ),
            })

        return attrs


class PurchaseWriteSerializer(serializers.Serializer):
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
    )
    expected_date = serializers.DateField(
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
    )
    items = PurchaseItemWriteSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError(
                'Un achat doit contenir au moins une ligne.'
            )

        medicine_ids = [item['medicine'].id for item in items]

        if len(medicine_ids) != len(set(medicine_ids)):
            raise serializers.ValidationError(
                'Un médicament ne peut apparaître qu’une seule fois dans l’achat.'
            )

        return items

    def create(self, validated_data):
        request = self.context.get('request')
        items_data = validated_data.pop('items')

        with transaction.atomic():
            purchase = Purchase.objects.create(
                supplier=validated_data['supplier'],
                ordered_by=request.user,
                expected_date=validated_data.get('expected_date'),
                notes=validated_data.get('notes', ''),
            )

            for item_data in items_data:
                PurchaseItem.objects.create(
                    purchase=purchase,
                    **item_data,
                )

            purchase.refresh_from_db()

        return purchase


class PurchaseReceiveItemSerializer(serializers.Serializer):
    purchase_item = serializers.PrimaryKeyRelatedField(
        queryset=PurchaseItem.objects.select_related(
            'purchase',
            'medicine',
        ).all(),
    )
    quantity = serializers.IntegerField(min_value=1)
    batch_number = serializers.CharField(max_length=100)
    manufacturing_date = serializers.DateField(
        required=False,
        allow_null=True,
    )
    expiry_date = serializers.DateField(
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
    )


class PurchaseReceiveSerializer(serializers.Serializer):
    items = PurchaseReceiveItemSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError(
                'Au moins une ligne de réception est obligatoire.'
            )

        item_ids = [item['purchase_item'].id for item in items]

        if len(item_ids) != len(set(item_ids)):
            raise serializers.ValidationError(
                'Une ligne d’achat ne peut être réceptionnée qu’une seule fois par opération.'
            )

        return items
