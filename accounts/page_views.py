"""Vues HTML du module Comptes."""

from django.views.generic import TemplateView

from dashboard.permissions import RoleRequiredMixin


class AccountsPageMixin(RoleRequiredMixin):
    """Accès commun aux pages de comptes."""

    allowed_roles = ('Cashier', 'STOCK_Manager', 'PHARMASIST')


class AccountsPageView(RoleRequiredMixin, TemplateView):
    """Gestion des utilisateurs, réservée aux administrateurs."""

    allowed_roles = ()
    template_name = 'accounts/list.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['current_user_id'] = self.request.user.id
        return context


class ProfilePageView(AccountsPageMixin, TemplateView):
    """Profil de l'utilisateur connecté."""

    template_name = 'accounts/profile.html'
