from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Sum, F
from django.utils import timezone

from inventory.models import Batch, StockMovement


class Sale(models.Model):

    STATUS_CHOICES = [
        ('COMPLETED', 'Terminée'),
        ('CANCELLED', 'Annulée'),
    ]

    sold_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='sales'
    )

    sale_date = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='COMPLETED'
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-sale_date']

    def __str__(self):
        return f"Vente #{self.id} - {self.total_amount}"

    def recalculate_total(self):
        total = self.items.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or 0

        Sale.objects.filter(pk=self.pk).update(
            total_amount=total
        )

        self.total_amount = total
        return total


class SaleItem(models.Model):

    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name='items'
    )

    batch = models.ForeignKey(
        Batch,
        on_delete=models.PROTECT,
        related_name='sale_items'
    )

    quantity = models.PositiveIntegerField()

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.batch.medicine.name} - {self.quantity}"

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)