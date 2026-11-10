
from django.db import models
from django.conf import settings
from medicines.models import Medicine


class Batch(models.Model):

    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.PROTECT,
        related_name='batches'
    )

    batch_number = models.CharField(max_length=100, unique=True)

    quantity_received = models.PositiveIntegerField()

    quantity_available = models.PositiveIntegerField()

    manufacturing_date = models.DateField(
        blank=True,
        null=True
    )

    expiry_date = models.DateField()

    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.medicine.name} - {self.batch_number}"


class StockMovement(models.Model):

    MOVEMENT_TYPES = [
        ('IN', 'Entrée'),
        ('OUT', 'Sortie'),
        ('ADJUSTMENT', 'Ajustement'),
    ]

    ADJUSTMENT_DIRECTIONS = [
        ('INCREASE', 'Augmentation'),
        ('DECREASE', 'Diminution'),
    ]

    batch = models.ForeignKey(
        Batch,
        on_delete=models.PROTECT,
        related_name='movements'
    )

    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPES
    )

    adjustment_direction = models.CharField(
        max_length=20,
        choices=ADJUSTMENT_DIRECTIONS,
        blank=True,
        null=True
    )

    quantity = models.PositiveIntegerField()

    reason = models.TextField(blank=True)

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='stock_movements'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.movement_type} - {self.batch.batch_number}"
