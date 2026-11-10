from django.contrib import admin
from .models import Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'name',
        'contact_person',
        'phone',
        'email',
        'is_active',
    )

    list_filter = ('is_active',)

    search_fields = (
        'name',
        'contact_person',
        'phone',
        'email',
    )

    list_editable = ('is_active',)

    ordering = ('name',)