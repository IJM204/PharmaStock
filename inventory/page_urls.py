"""URLs des pages HTML du module Stock."""

from django.urls import path

from .page_views import (
    ExpiredPageView,
    InventoryPageView,
    LowStockPageView,
    MovementPageView,
)


urlpatterns = [
    path('', InventoryPageView.as_view(), name='inventory-page'),
    path(
        'movements/',
        MovementPageView.as_view(),
        name='inventory-movements-page',
    ),
    path(
        'low-stock/',
        LowStockPageView.as_view(),
        name='inventory-low-stock-page',
    ),
    path(
        'expired/',
        ExpiredPageView.as_view(),
        name='inventory-expired-page',
    ),
]
