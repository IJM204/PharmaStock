from rest_framework import serializers
from .models import Sale, SaleItem


class SaleItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='batch.medicine.name',
        read_only=True
    )

    batch_number = serializers.CharField(
        source='batch.batch_number',
        read_only=True
    )

    class Meta:
        model = SaleItem
        fields = [
            'id',
            'batch',
            'batch_number',
            'medicine_name',
            'quantity',
            'unit_price',
            'subtotal',
            'created_at',
        ]

        read_only_fields = [
            'id',
            'batch_number',
            'medicine_name',
            'subtotal',
            'created_at',
        ]


class SaleSerializer(serializers.ModelSerializer):
    sold_by_username = serializers.CharField(
        source='sold_by.username',
        read_only=True
    )

    items = SaleItemSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Sale
        fields = [
            'id',
            'sold_by',
            'sold_by_username',
            'sale_date',
            'status',
            'total_amount',
            'items',
            'created_at',
            'updated_at',
        ]

        read_only_fields = fields
