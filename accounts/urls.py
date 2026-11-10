from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    ProfileView,
    RegisterView,
    UserCreateView,
    UserDetailView,
    UserListView,
)


urlpatterns = [
    # Inscription
    path('register/', RegisterView.as_view(), name='register'),

    # Connexion JWT
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),

    # Renouvellement du token
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Profil de l'utilisateur connecté
    path('profile/', ProfileView.as_view(), name='profile'),

    # Gestion des utilisateurs (administrateurs)
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/create/', UserCreateView.as_view(), name='user-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]
