from rest_framework import serializers
from .models import Category, Medicine


class CategorySerializer(serializers.ModelSerializer):
    medicines_count = serializers.IntegerField(
        source='medicines.count',
        read_only=True
    )

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'description',
            'medicines_count',
        ]


class MedicineSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name',
        read_only=True
    )

    class Meta:
        model = Medicine
        fields = [
            'id',
            'category',
            'category_name',
            'name',
            'generic_name',
            'dosage',
            'form',
            'description',
            'unit_price',
            'is_active',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Le prix du médicament ne peut pas être négatif."
            )
        return value