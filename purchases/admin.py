from django.contrib import admin
from .models import Purchase, PurchaseItem, PurchaseReceipt


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'supplier', 'status', 'order_date',
        'ordered_by', 'total_amount_display'
    ]
    list_filter = ['status', 'order_date', 'supplier']
    search_fields = ['supplier__name', 'ordered_by__username', 'notes']
    readonly_fields = ['order_date', 'total_amount', 'created_at', 'updated_at']
    date_hierarchy = 'order_date'

    def total_amount_display(self, obj):
        """Affichage formaté du total."""
        return f"{obj.total_amount} €"
    total_amount_display.short_description = 'Montant total'


@admin.register(PurchaseItem)
class PurchaseItemAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'purchase', 'medicine', 'quantity_ordered',
        'quantity_received', 'unit_price', 'subtotal'
    ]
    list_filter = ['purchase__status', 'medicine__name']
    search_fields = ['purchase__id', 'medicine__name', 'medicine__generic_name']
    raw_id_fields = ['purchase', 'medicine']

    def subtotal(self, obj):
        """Affichage du sous-total."""
        return f"{obj.subtotal()} €"
    subtotal.short_description = 'Sous-total'


@admin.register(PurchaseReceipt)
class PurchaseReceiptAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'purchase_item', 'quantity', 'received_by',
        'receipt_date', 'status', 'batch_number'
    ]
    list_filter = ['status', 'receipt_date', 'purchase_item__purchase__status']
    search_fields = [
        'purchase_item__purchase__id',
        'purchase_item__medicine__name',
        'received_by__username'
    ]
    raw_id_fields = ['purchase_item', 'received_by']
    date_hierarchy = 'receipt_date'

    def get_queryset(self, request):
        """Filtrer l'affichage selon les permissions."""
        return super().get_queryset(request)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Empêcher le changement de received_by sur les reçus confirmés."""
        if db_field.name == 'received_by' and self.get_object(request):
            obj = self.get_object(request)
            if obj and obj.status == 'CONFIRMED':
                kwargs['disabled'] = True
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_delete_permission(self, request, obj=None):
        """Empêcher la suppression des reçus confirmés."""
        if obj and obj.status == 'CONFIRMED':
            return False
        return super().has_delete_permission(request, obj)

    def save_model(self, request, obj, form, change):
        """
        Surcharge save_model pour interdire la modification
        d'un reçu déjà confirmé via l'interface admin.
        """
        if obj.pk and change:  # Modification d'un objet existant
            try:
                existing = PurchaseReceipt.objects.get(pk=obj.pk)
                if existing.status == 'CONFIRMED':
                    raise ValidationError(
                        "Impossible de modifier une réception déjà confirmée."
                    )
            except PurchaseReceipt.DoesNotExist:
                pass
        super().save_model(request, obj, form, change)

    def delete_model(self, request, obj):
        """
        Surcharge delete_model pour interdire la suppression
        d'un reçu confirmé via l'interface admin.
        """
        if obj.status == 'CONFIRMED':
            raise ValidationError(
                "Impossible de supprimer une réception confirmée. "
                "Utilisez l'annulation prévue ou contactez l'administration."
            )
        super().delete_model(request, obj)