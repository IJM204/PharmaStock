"""Vues HTML du module Fournisseurs."""

from django.views.generic import TemplateView

from dashboard.permissions import RoleRequiredMixin


class SupplierPageView(RoleRequiredMixin, TemplateView):
    """Page de gestion des fournisseurs."""

    template_name = 'suppliers/list.html'
    allowed_roles = ('STOCK_Manager',)
