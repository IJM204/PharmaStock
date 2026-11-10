from django.contrib import admin
from .models import Category, Medicine


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description')
    search_fields = ('name',)


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'generic_name',
        'category',
        'dosage',
        'form',
        'unit_price',
        'is_active',
    )

    list_filter = ('category', 'form', 'is_active')
    search_fields = ('name', 'generic_name')
    list_editable = ('unit_price', 'is_active')
    ordering = ('name',)