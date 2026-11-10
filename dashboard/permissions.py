"""Permissions communes pour les pages HTML."""

from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied


class RoleRequiredMixin(LoginRequiredMixin):
    """Protège une page HTML et vérifie le rôle de l'utilisateur.

    L'administrateur et les superutilisateurs ont toujours accès.
    Les permissions des APIs restent la référence côté serveur.
    """

    allowed_roles = ()

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            is_admin = (
                request.user.is_superuser
                or getattr(request.user, 'role', None) == 'Admin'
            )

            if not is_admin and request.user.role not in self.allowed_roles:
                raise PermissionDenied

        return super().dispatch(request, *args, **kwargs)
