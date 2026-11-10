"""Vues HTML du module Ventes."""

from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.views.generic import TemplateView

from dashboard.permissions import RoleRequiredMixin

from .models import Sale


class SalesPageMixin(RoleRequiredMixin):
    """Accès commun aux pages de ventes."""

    allowed_roles = ('PHARMASIST', 'Cashier')


class SalesPageView(SalesPageMixin, TemplateView):
    """Historique des ventes."""

    template_name = 'sales/list.html'


class SaleCreatePageView(SalesPageMixin, TemplateView):
    """Formulaire de création d'une vente."""

    template_name = 'sales/create.html'


class SaleDetailPageView(SalesPageMixin, TemplateView):
    """Détail d'une vente."""

    template_name = 'sales/detail.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        sale = get_object_or_404(Sale, pk=self.kwargs['pk'])
        user = self.request.user
        is_admin = (
            user.is_superuser
            or getattr(user, 'role', None) == 'Admin'
        )

        if (
            not is_admin
            and getattr(user, 'role', None) == 'Cashier'
            and sale.sold_by_id != user.id
        ):
            raise PermissionDenied

        context['sale_id'] = sale.id
        return context
