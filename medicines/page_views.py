"""Vues HTML du module Médicaments."""

from django.views.generic import TemplateView

from dashboard.permissions import RoleRequiredMixin

from .models import Medicine


class MedicinePageView(RoleRequiredMixin, TemplateView):
    """Page de gestion du catalogue des médicaments."""

    template_name = 'medicines/list.html'
    allowed_roles = ('STOCK_Manager', 'PHARMASIST')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['form_choices'] = Medicine.FORM_CHOICES
        return context


class CategoryPageView(RoleRequiredMixin, TemplateView):
    """Page de gestion des catégories de médicaments."""

    template_name = 'medicines/categories.html'
    allowed_roles = ('STOCK_Manager', 'PHARMASIST')
