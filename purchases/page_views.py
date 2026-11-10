"""Vues HTML du module Achats."""

from django.shortcuts import get_object_or_404
from django.views.generic import TemplateView

from dashboard.permissions import RoleRequiredMixin

from .models import Purchase


class PurchasesPageMixin(RoleRequiredMixin):
    """Accès commun aux pages d'achats."""

    allowed_roles = ('STOCK_Manager',)


class PurchasesPageView(PurchasesPageMixin, TemplateView):
    """Liste des achats."""

    template_name = 'purchases/list.html'


class PurchaseCreatePageView(PurchasesPageMixin, TemplateView):
    """Formulaire de création d'un achat."""

    template_name = 'purchases/create.html'


class PurchaseDetailPageView(PurchasesPageMixin, TemplateView):
    """Détail d'un achat et réception des lignes."""

    template_name = 'purchases/detail.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        purchase = get_object_or_404(Purchase, pk=self.kwargs['pk'])
        context['purchase_id'] = purchase.id
        return context


class PurchaseReceiptsPageView(PurchasesPageMixin, TemplateView):
    """Historique global des réceptions."""

    template_name = 'purchases/receipts.html'
