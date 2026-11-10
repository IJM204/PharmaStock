"""URLs des pages HTML du module Comptes."""

from django.urls import path

from .page_views import AccountsPageView, ProfilePageView


urlpatterns = [
    path('', AccountsPageView.as_view(), name='accounts-page'),
    path('profile/', ProfilePageView.as_view(), name='profile-page'),
]
