
from rest_framework import serializers
from .models import Batch, StockMovement


class BatchSerializer(serializers.ModelSerializer):

    medicine_name = serializers.CharField(
        source='medicine.name',
        read_only=True
    )

    initial_quantity = serializers.IntegerField(
        write_only=True,
        min_value=1,
        required=False
    )

    class Meta:
        model = Batch

        fields = [
            'id',
            'medicine',
            'medicine_name',
            'batch_number',
            'initial_quantity',
            'quantity_received',
            'quantity_available',
            'manufacturing_date',
            'expiry_date',
            'purchase_price',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'quantity_received',
            'quantity_available',
            'created_at',
            'updated_at',
        ]

    def validate(self, data):

        if self.instance and 'initial_quantity' in data:
            raise serializers.ValidationError({
                'initial_quantity':
                'Cette quantité ne peut être définie qu’à la création.'
            })

        if not self.instance and 'initial_quantity' not in data:
            raise serializers.ValidationError({
                'initial_quantity':
                'La quantité initiale est obligatoire.'
            })

        manufacturing = data.get(
            'manufacturing_date',
            getattr(self.instance, 'manufacturing_date', None)
        )

        expiry = data.get(
            'expiry_date',
            getattr(self.instance, 'expiry_date', None)
        )

        if manufacturing and expiry and manufacturing > expiry:
            raise serializers.ValidationError({
                'expiry_date':
                'La date d’expiration doit être postérieure à la fabrication.'
            })

        return data

    def create(self, validated_data):

        initial_quantity = validated_data.pop('initial_quantity')

        return Batch.objects.create(
            **validated_data,
            quantity_received=initial_quantity,
            quantity_available=initial_quantity
        )


class StockMovementSerializer(serializers.ModelSerializer):

    medicine_name = serializers.CharField(
        source='batch.medicine.name',
        read_only=True
    )

    batch_number = serializers.CharField(
        source='batch.batch_number',
        read_only=True
    )

    performed_by_username = serializers.CharField(
        source='performed_by.username',
        read_only=True
    )

    class Meta:
        model = StockMovement

        fields = [
            'id',
            'batch',
            'batch_number',
            'medicine_name',
            'movement_type',
            'adjustment_direction',
            'quantity',
            'reason',
            'performed_by',
            'performed_by_username',
            'created_at',
        ]

        read_only_fields = [
            'id',
            'performed_by',
            'created_at',
        ]
