"""Vues HTML du module Stock."""

from django.views.generic import TemplateView

from dashboard.permissions import RoleRequiredMixin

from .models import StockMovement


class InventoryPageMixin(RoleRequiredMixin):
    """Accès commun aux pages de stock."""

    allowed_roles = ('STOCK_Manager', 'PHARMASIST')


class InventoryPageView(InventoryPageMixin, TemplateView):
    """Liste des lots de stock."""

    template_name = 'inventory/batches.html'


class MovementPageView(InventoryPageMixin, TemplateView):
    """Historique et enregistrement des mouvements."""

    template_name = 'inventory/movements.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['movement_types'] = StockMovement.MOVEMENT_TYPES
        context['adjustment_directions'] = StockMovement.ADJUSTMENT_DIRECTIONS
        return context


class LowStockPageView(InventoryPageMixin, TemplateView):
    """Lots dont la quantité disponible est faible."""

    template_name = 'inventory/low_stock.html'


class ExpiredPageView(InventoryPageMixin, TemplateView):
    """Lots expirés ayant encore du stock."""

    template_name = 'inventory/expired.html'
