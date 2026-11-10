
from django.contrib import admin
from .models import Batch, StockMovement


@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):

    list_display = (
        'batch_number',
        'medicine',
        'quantity_received',
        'quantity_available',
        'expiry_date',
        'purchase_price',
    )

    search_fields = ('batch_number', 'medicine__name')

    list_filter = ('expiry_date',)

    def get_readonly_fields(self, request, obj=None):

        if obj:
            return ('quantity_received', 'quantity_available')

        return ('quantity_available',)

    def save_model(self, request, obj, form, change):

        if not change:
            obj.quantity_available = obj.quantity_received

        super().save_model(request, obj, form, change)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):

    list_display = (
        'batch',
        'movement_type',
        'adjustment_direction',
        'quantity',
        'performed_by',
        'created_at',
    )

    search_fields = (
        'batch__batch_number',
        'performed_by__username',
    )

    list_filter = (
        'movement_type',
        'adjustment_direction',
        'created_at',
    )

    readonly_fields = (
        'batch',
        'movement_type',
        'adjustment_direction',
        'quantity',
        'reason',
        'performed_by',
        'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
