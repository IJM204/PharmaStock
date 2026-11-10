"""URLs des pages HTML du module Fournisseurs."""

from django.urls import path

from .page_views import SupplierPageView


urlpatterns = [
    path('', SupplierPageView.as_view(), name='suppliers-page'),
]
