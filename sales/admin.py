from django.contrib import admin
from .models import Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ('subtotal',)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'sold_by',
        'sale_date',
        'status',
        'total_amount',
    )

    list_filter = ('status', 'sale_date')
    search_fields = ('sold_by__username',)
    readonly_fields = ('sale_date', 'created_at', 'updated_at')
    inlines = [SaleItemInline]


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = (
        'sale',
        'batch',
        'quantity',
        'unit_price',
        'subtotal',
    )

    list_filter = ('created_at',)